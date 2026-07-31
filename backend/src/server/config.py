"""Configuration: environment variables and constants for the voice agent."""

import os

from dotenv import load_dotenv

load_dotenv(override=True)

# Deepgram (STT)
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")

# Groq (LLM)
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

# ElevenLabs (TTS)
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "JBFqnCBsd6RMkjVDRZzb")

# CRM API (Node/TS backend - leads, calls, escalations)
CRM_API_BASE_URL = os.getenv("CRM_API_BASE_URL", "http://localhost:4000")
CRM_SERVICE_API_KEY = os.getenv("CRM_SERVICE_API_KEY")
