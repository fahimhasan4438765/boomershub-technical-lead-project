"""Voice Pipeline FastAPI application.

Real-time STT → LLM → TTS pipeline for Voice AI calls.
Uses Deepgram, OpenAI, ElevenLabs when API keys are set; mocks otherwise.
"""

import logging

from fastapi import FastAPI

from app.core.config import settings
from app.routers import pipeline
from app.routers import twilio_voice

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Real-time Voice AI pipeline: Twilio audio → STT → LLM → TTS",
)

app.include_router(pipeline.router)
app.include_router(twilio_voice.router)


@app.on_event("startup")
def _log_provider_status() -> None:
    """Log which providers are active (never log keys)."""
    stt = "real (Deepgram)" if (settings.stt_api_key or "").strip() else "mock"
    llm = "real (OpenAI)" if (settings.llm_api_key or "").strip() else "mock"
    tts_provider = (settings.tts_provider or "").strip().lower()
    if tts_provider == "openai":
        tts = "real (OpenAI)" if (settings.tts_api_key or settings.llm_api_key or "").strip() else "mock"
    else:
        tts = "real (ElevenLabs)" if ((settings.tts_api_key or "").strip() and (settings.tts_voice_id or "").strip()) else "mock"
    logger.info("Pipeline providers: STT=%s, LLM=%s, TTS=%s", stt, llm, tts)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "voice-pipeline"}
