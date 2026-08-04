"""Configuration: environment variables and constants for the voice agent."""

import os

from dotenv import load_dotenv

load_dotenv(override=True)

# Deepgram (STT)
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")

# Groq (LLM). llama-3.1-8b-instant trades some reasoning depth for
# meaningfully faster generation - important for a live voice conversation
# where every extra second of "thinking" reads as an unnatural pause.
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

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
