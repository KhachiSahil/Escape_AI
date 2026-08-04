"""Configuration: environment variables and constants for the voice agent."""

import os

from dotenv import load_dotenv

load_dotenv(override=True)

# Deepgram (STT)
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")

# Groq (LLM). llama-3.3-70b-versatile - live testing on this account found
# llama-3.1-8b-instant carries a much lower per-key rate limit (6,000
# tokens/min vs. 70b's 12,000/min here), and streamed time-to-first-token
# was statistically the same between the two models on Groq's hardware in
# clean conditions - so the smaller model bought no real speed and actively
# throttled sooner in a real multi-turn conversation. Reproduced: TTFT
# climbed from 0.6s to 10s+ within 8 consecutive requests on the 8b model.
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
# Caps every response to a short, natural spoken reply instead of a long
# multi-question ramble - also directly cuts per-turn token usage, which
# matters given Groq's daily token quota (see bot.py's LLM construction).
GROQ_MAX_TOKENS = int(os.getenv("GROQ_MAX_TOKENS", "120"))

# ElevenLabs (TTS)
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "JBFqnCBsd6RMkjVDRZzb")

# CRM API (Node/TS backend - leads, calls, escalations)
CRM_API_BASE_URL = os.getenv("CRM_API_BASE_URL", "http://localhost:4000")
CRM_SERVICE_API_KEY = os.getenv("CRM_SERVICE_API_KEY")

# Twilio (outbound/cold-calling transport). Real values are business-supplied;
# placeholders here match how EDTECH_KNOWLEDGE_BASE handles unfilled specifics.
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER", "")
TWILIO_TWIML_WEBHOOK_URL = os.getenv("TWILIO_TWIML_WEBHOOK_URL", "")
