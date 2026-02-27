"""Real Deepgram STT client. Uses PIPELINE_STT_API_KEY."""

from __future__ import annotations

import asyncio
import logging
from typing import AsyncIterator

from app.core.config import settings
from app.services.stt_client import STTClient

logger = logging.getLogger(__name__)


class DeepgramSTTClient(STTClient):
    """Production Deepgram client. Uses REST for single-buffer transcription.

    Twilio sends mulaw 8kHz; we send one buffer per utterance and stream back
    a single final transcript (partials can be added later with live WebSocket).
    """

    def __init__(self, timeout_seconds: float = 10.0) -> None:
        self.timeout_seconds = timeout_seconds
        self._api_key = (settings.stt_api_key or "").strip()

    async def transcribe_stream(self, audio_chunks: AsyncIterator[bytes]) -> AsyncIterator[str]:
        if not self._api_key:
            raise ValueError("Deepgram API key not configured (PIPELINE_STT_API_KEY)")

        chunks: list[bytes] = []
        async for chunk in audio_chunks:
            chunks.append(chunk)
        if not chunks:
            return
        body = b"".join(chunks)

        try:
            import httpx
            url = "https://api.deepgram.com/v1/listen?encoding=mulaw&sample_rate=8000&channels=1"
            headers = {"Authorization": f"Token {self._api_key}"}

            def _transcribe() -> str:
                with httpx.Client(timeout=self.timeout_seconds) as client:
                    resp = client.post(
                        url,
                        content=body,
                        headers={**headers, "Content-Type": "audio/mu-law"},
                    )
                    resp.raise_for_status()
                    data = resp.json()
                    channel = (data.get("results") or {}).get("channels")
                    if channel and channel[0].get("alternatives"):
                        return (channel[0]["alternatives"][0].get("transcript") or "").strip()
                return ""

            transcript = await asyncio.wait_for(
                asyncio.to_thread(_transcribe),
                timeout=self.timeout_seconds + 2,
            )
        except asyncio.TimeoutError:
            logger.warning("Deepgram STT timeout")
            raise
        except Exception as e:
            logger.exception("Deepgram STT error (no API key in logs)")
            raise

        if transcript:
            yield transcript
        return
