from loguru import logger
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.frames.frames import LLMRunFrame
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
from pipecat.workers.runner import WorkerRunner

import config
import tools.api_client as api_client
import tools.leads as leads
from prompts import build_system_prompt
from tools import register_all_tools, tools_schema


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

    context = LLMContext(tools=tools_schema)
    user_aggregator, assistant_aggregator = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(
            vad_analyzer=SileroVADAnalyzer(),
        ),
    )

    # Pipeline - assembled from reusable components
    pipeline = Pipeline(
        [
            transport.input(),
            stt,
            user_aggregator,
            llm,
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
