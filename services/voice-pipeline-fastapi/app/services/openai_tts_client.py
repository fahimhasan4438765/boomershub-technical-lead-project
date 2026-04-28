"""OpenAI TTS client.

Generates speech audio from text using OpenAI and returns PCM 16kHz mono bytes.
We request WAV from OpenAI then resample to 16kHz so the rest of the pipeline
can remain Twilio-compatible (mulaw 8k conversion assumes 16k PCM input).
"""

from __future__ import annotations

import io
import logging
import wave
import audioop
from typing import AsyncIterator

from app.core.config import settings
from app.services.tts_client import TTSClient

logger = logging.getLogger(__name__)


class OpenAITTSClient(TTSClient):
    """Production OpenAI TTS via OpenAI SDK."""

    def __init__(self, timeout_seconds: float = 20.0) -> None:
        self.timeout_seconds = timeout_seconds
        self._api_key = (settings.tts_api_key or settings.llm_api_key or "").strip()
        self._model = (settings.tts_model or "gpt-4o-mini-tts").strip()
        self._voice = (settings.tts_voice or "alloy").strip()

    async def synthesize_stream(self, text_chunks: AsyncIterator[str]) -> AsyncIterator[bytes]:
        if not self._api_key:
            raise ValueError("OpenAI API key not configured (PIPELINE_TTS_API_KEY or PIPELINE_LLM_API_KEY)")

        text_parts: list[str] = []
        async for chunk in text_chunks:
            text_parts.append(chunk)
        text = "".join(text_parts).strip()
        if not text:
            return

        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=self._api_key)
        try:
            # Request WAV so we can robustly resample to 16k PCM.
            resp = await client.audio.speech.create(
                model=self._model,
                voice=self._voice,
                input=text,
                response_format="wav",
                timeout=float(self.timeout_seconds),
            )

            wav_bytes: bytes | None = getattr(resp, "content", None)
            if wav_bytes is None:
                # Some SDK versions return bytes directly.
                if isinstance(resp, (bytes, bytearray)):
                    wav_bytes = bytes(resp)
                else:
                    # Best-effort fallback.
                    wav_bytes = bytes(getattr(resp, "data", b"") or b"")

            if not wav_bytes:
                return

            pcm_16k = _wav_to_pcm16k_mono(wav_bytes)
            if not pcm_16k:
                return

            # Yield in chunks so downstream callers can stream.
            chunk_size = 3200  # 100ms at 16kHz * 2 bytes
            for i in range(0, len(pcm_16k), chunk_size):
                yield pcm_16k[i : i + chunk_size]
        except Exception:
            logger.exception("OpenAI TTS error (no API key in logs)")
            raise


def _wav_to_pcm16k_mono(wav_bytes: bytes) -> bytes | None:
    """Convert WAV bytes to PCM 16kHz mono 16-bit LE."""
    try:
        with wave.open(io.BytesIO(wav_bytes), "rb") as wf:
            nchannels = wf.getnchannels()
            sampwidth = wf.getsampwidth()
            framerate = wf.getframerate()
            nframes = wf.getnframes()
            pcm = wf.readframes(nframes)

        if not pcm:
            return None

        # Ensure 16-bit samples.
        if sampwidth != 2:
            # Convert to 16-bit if possible.
            pcm = audioop.lin2lin(pcm, sampwidth, 2)
            sampwidth = 2

        # Downmix to mono.
        if nchannels and nchannels > 1:
            pcm = audioop.tomono(pcm, sampwidth, 0.5, 0.5)

        # Resample to 16k.
        if framerate and framerate != 16000:
            pcm, _state = audioop.ratecv(pcm, sampwidth, 1, framerate, 16000, None)

        return pcm
    except Exception:
        return None

