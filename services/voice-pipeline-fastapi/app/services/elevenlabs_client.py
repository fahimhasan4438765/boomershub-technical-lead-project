"""Real ElevenLabs TTS client. Uses PIPELINE_TTS_API_KEY and PIPELINE_TTS_VOICE_ID."""

from __future__ import annotations

import logging
from typing import AsyncIterator

import httpx
from app.core.config import settings
from app.services.tts_client import TTSClient

logger = logging.getLogger(__name__)

ELEVENLABS_FALLBACK_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"


class ElevenLabsTTSClient(TTSClient):
    """Production ElevenLabs TTS via REST API (avoids SDK API drift)."""

    def __init__(self, timeout_seconds: float = 15.0) -> None:
        self.timeout_seconds = timeout_seconds
        self._api_key = (settings.tts_api_key or "").strip()
        self._voice_id = (settings.tts_voice_id or "").strip()

    async def _do_request(self, voice_id: str, payload: dict, headers: dict) -> httpx.Response:
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            return await client.post(url, json=payload, headers=headers)

    async def synthesize_stream(self, text_chunks: AsyncIterator[str]) -> AsyncIterator[bytes]:
        if not self._api_key:
            raise ValueError("ElevenLabs API key not configured (PIPELINE_TTS_API_KEY)")
        if not self._voice_id:
            raise ValueError("ElevenLabs voice ID not configured (PIPELINE_TTS_VOICE_ID)")

        text_parts: list[str] = []
        async for chunk in text_chunks:
            text_parts.append(chunk)
        text = "".join(text_parts).strip()
        if not text:
            return

        headers = {
            "xi-api-key": self._api_key,
            "Content-Type": "application/json",
        }
        payload = {
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "output_format": "pcm_16000",
        }

        voice_id = self._voice_id
        try:
            resp = await self._do_request(voice_id, payload, headers)
            if resp.status_code == 402:
                err_body = resp.text or ""
                if "library voices" in err_body.lower() or "paid_plan_required" in err_body.lower():
                    if voice_id != ELEVENLABS_FALLBACK_VOICE_ID:
                        logger.warning(
                            "ElevenLabs: library/paid voice not allowed on your plan. "
                            "Retrying with default voice (Rachel). Set PIPELINE_TTS_VOICE_ID to a "
                            "non-library voice or upgrade to use your chosen voice."
                        )
                        voice_id = ELEVENLABS_FALLBACK_VOICE_ID
                        resp = await self._do_request(voice_id, payload, headers)
            if resp.status_code >= 400:
                try:
                    err_body = resp.text
                except Exception:
                    err_body = "(unable to read body)"
                logger.error(
                    "ElevenLabs TTS HTTP %s: %s",
                    resp.status_code,
                    (err_body or resp.reason_phrase or "")[:500],
                )
            resp.raise_for_status()
            body = resp.content
            if body:
                yield body
        except httpx.HTTPStatusError:
            raise
        except Exception:
            logger.exception("ElevenLabs TTS error (no API key in logs)")
            raise
