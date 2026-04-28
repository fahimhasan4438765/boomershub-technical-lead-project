"""Application settings loaded from environment variables."""

from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Pipeline configuration."""

    app_name: str = "Voice Pipeline"
    debug: bool = False

    call_session_url: str = "http://localhost:3001"
    redis_url: str = "redis://localhost:6379/0"

    stt_provider: str = "deepgram"
    stt_api_key: str = ""

    llm_provider: str = "openai"
    llm_api_key: str = ""
    llm_model: str = "gpt-4o"

    tts_provider: str = "elevenlabs"
    tts_api_key: str = ""
    tts_voice_id: str = Field("", env="PIPELINE_TTS_VOICE_ID")
    tts_voice: str = "alloy"
    tts_model: str = "gpt-4o-mini-tts"

    stt_timeout_ms: int = 400
    llm_timeout_ms: int = 500
    tts_timeout_ms: int = 400

    twilio_media_ws_url: str = Field("", env="TWILIO_MEDIA_WS_URL")

    # Load local dev values from service-level `.env` when present.
    # Docker Compose also injects env vars, which take precedence.
    model_config = {"env_prefix": "PIPELINE_", "env_file": ".env", "extra": "ignore"}


settings = Settings()
