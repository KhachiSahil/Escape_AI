from loguru import logger
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.frames.frames import LLMRunFrame, LLMTextFrame, TTSSpeakFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.worker import PipelineParams, PipelineWorker
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.processors.frameworks.rtvi import (
    RTVIFunctionCallReportLevel,
    RTVIObserverParams,
)
from pipecat.runner.types import (
    RunnerArguments,
    SmallWebRTCRunnerArguments,
    WebSocketRunnerArguments,
)
from pipecat.runner.utils import create_transport
from pipecat.services.deepgram.stt import DeepgramSTTService
from pipecat.services.elevenlabs.tts import ElevenLabsTTSService
from pipecat.services.groq.llm import GroqLLMService
from pipecat.transports.base_transport import BaseTransport, TransportParams
from pipecat.transports.smallwebrtc.connection import SmallWebRTCConnection
from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport
from pipecat.transports.websocket.fastapi import FastAPIWebsocketParams
from pipecat.turns.user_stop import SpeechTimeoutUserTurnStopStrategy
from pipecat.turns.user_turn_strategies import UserTurnStrategies
from pipecat.workers.runner import WorkerRunner

import config
import tools.api_client as api_client
import tools.leads as leads
from prompts import build_system_prompt
from tools import register_all_tools, tools_schema
from tools.completion_retry_policy import CompletionRetryPolicy, RetryAction
from tools.leaked_tool_call_filter import LeakedToolCallFilter


async def run_bot(transport: BaseTransport):
    """Main bot logic: assemble services, pipeline, and event handlers."""
    logger.info("Starting bot")

    # Speech-to-Text service
    stt = DeepgramSTTService(api_key=config.DEEPGRAM_API_KEY,model="nova-3", language="multi",detect_language=True)

    # Text-to-Speech service
    tts = ElevenLabsTTSService(
        api_key=config.ELEVENLABS_API_KEY,
        voice_id=config.ELEVENLABS_VOICE_ID,
    )

    # LLM service
    llm = GroqLLMService(
        api_key=config.GROQ_API_KEY,
        model=config.GROQ_MODEL,
    )
    register_all_tools(llm)

    # tool_choice is set explicitly (rather than left as pipecat's implicit
    # NOT_GIVEN default) as one mitigation for a documented Groq/Llama
    # tool-calling quirk - see tools/leaked_tool_call_filter.py's module
    # docstring for the full failure mode this and that filter both guard
    # against.
    context = LLMContext(tools=tools_schema, tool_choice="auto")
    user_aggregator, assistant_aggregator = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(
            vad_analyzer=SileroVADAnalyzer(params=VADParams(stop_secs=0.5)),
            # Default turn-stop detection uses a prosody-aware ML model with a
            # 3s silence fallback, stacked under a 5s user_turn_stop_timeout
            # ceiling - together these can leave several seconds of dead air
            # before the agent even starts thinking, which reads as "slow" and
            # breaks the feel of a live conversation. Swapping to a plain
            # VAD-silence timeout (user speaks, pauses ~0.6s, turn ends) trades
            # a small risk of cutting in in exchange for a much snappier,
            # more natural back-and-forth.
            user_turn_strategies=UserTurnStrategies(
                stop=[SpeechTimeoutUserTurnStopStrategy(user_speech_timeout=0.6)],
            ),
            user_turn_stop_timeout=2.0,
        ),
    )

    # Pipeline - assembled from reusable components. leaked_tool_call_filter
    # sits between llm and tts as a safety net for a documented Groq/Llama
    # tool-calling quirk where a real tool call occasionally leaks as raw
    # <function=name>{json}</function> text instead of firing through the
    # normal structured tool-call path - see tools/leaked_tool_call_filter.py.
    leaked_tool_call_filter = LeakedToolCallFilter()
    pipeline = Pipeline(
        [
            transport.input(),
            stt,
            user_aggregator,
            llm,
            leaked_tool_call_filter,
            tts,
            transport.output(),
            assistant_aggregator,
        ]
    )

    worker = PipelineWorker(
        pipeline,
        params=PipelineParams(
            enable_metrics=True,
            enable_usage_metrics=True,
        ),
        observers=[],
        rtvi_observer_params=RTVIObserverParams(
            function_call_report_level={"*": RTVIFunctionCallReportLevel.DISABLED}
        ),
    )

    @worker.rtvi.event_handler("on_client_ready")
    async def on_client_ready(rtvi):
        context.add_message({"role": "system", "content": build_system_prompt()})
        await worker.queue_frames([LLMRunFrame()])

    # See tools/completion_retry_policy.py: Groq's tool-call parser
    # occasionally rejects a completion outright with a "tool_use_failed"
    # 400 (same underlying quirk as leaked_tool_call_filter.py, just
    # surfacing as an error response instead of leaked text). Without this
    # handler that turn produces total silence - pipecat logs the error but
    # neither retries nor says anything, which reads as the agent hanging.
    retry_policy = CompletionRetryPolicy()
    worker.add_reached_downstream_filter((LLMTextFrame,))

    @worker.event_handler("on_frame_reached_downstream")
    async def on_frame_reached_downstream(worker, frame):
        retry_policy.on_success()

    @worker.event_handler("on_pipeline_error")
    async def on_pipeline_error(worker, frame):
        action = retry_policy.on_error(str(frame.error))
        if action is RetryAction.RETRY:
            logger.warning(f"LLM completion failed, retrying once: {frame.error}")
            await worker.queue_frames([LLMRunFrame()])
        elif action is RetryAction.FALLBACK:
            logger.error(
                f"LLM completion failed again after retry, giving up on this turn: {frame.error}"
            )
            await worker.queue_frames(
                [TTSSpeakFrame("Sorry, could you say that again for me?")]
            )

    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        logger.info("Client connected")

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.info("Client disconnected")
        if leads.current_lead_id and not leads.call_summary_finalized:
            # Fallback: the LLM never got to call finalize_call_summary
            # (e.g. an abrupt disconnect) - log a minimal record rather
            # than losing the call entirely.
            await leads.log_call_summary(
                lead_id=leads.current_lead_id,
                call_type="AI_INBOUND",
            )
        await worker.cancel()

    runner = WorkerRunner(handle_sigint=False)

    await runner.add_workers(worker)
    try:
        await runner.run()
    finally:
        await api_client.aclose_client()


# Telephony transport params (Twilio Media Streams). Twilio, Telnyx, Plivo,
# and Exotel all arrive as WebSocketRunnerArguments - create_transport()
# auto-detects the provider from the first WS message and picks the right
# entry here; add_wav_header/serializer are wired up automatically for the
# detected provider.
TRANSPORT_PARAMS = {
    "webrtc": lambda: TransportParams(
        audio_in_enabled=True,
        audio_out_enabled=True,
    ),
    "twilio": lambda: FastAPIWebsocketParams(
        audio_in_enabled=True,
        audio_out_enabled=True,
    ),
}


async def bot(runner_args: RunnerArguments):
    """Main bot entry point."""

    match runner_args:
        case SmallWebRTCRunnerArguments():
            webrtc_connection: SmallWebRTCConnection = runner_args.webrtc_connection

            transport = SmallWebRTCTransport(
                webrtc_connection=webrtc_connection,
                params=TransportParams(
                    audio_in_enabled=True,
                    audio_out_enabled=True,
                ),
            )
        case WebSocketRunnerArguments():
            # Covers both inbound and outbound-originated Twilio calls -
            # once Twilio opens the Media Streams WebSocket, the two are
            # indistinguishable at this layer. See
            # tools/outbound.py/trigger_outbound_call.py for call origination.
            transport = await create_transport(runner_args, TRANSPORT_PARAMS)
        case _:
            logger.error(f"Unsupported runner arguments type: {type(runner_args)}")
            return

    await run_bot(transport)


if __name__ == "__main__":
    from pipecat.runner.run import main

    main()
