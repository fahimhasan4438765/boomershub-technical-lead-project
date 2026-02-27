"""Convert TTS output to Twilio-compatible mulaw 8kHz."""

from __future__ import annotations

import audioop
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def pcm_16k_to_mulaw_8k(pcm_16k_bytes: bytes) -> Optional[bytes]:
    """Convert 16-bit PCM 16kHz mono to mulaw 8kHz for Twilio.
    ElevenLabs pcm_16000 is 16-bit LE mono. Downsample by 2 then lin2ulaw.
    """
    if not pcm_16k_bytes or len(pcm_16k_bytes) % 2 != 0:
        return None
    try:
        samples_8k = bytearray()
        for i in range(0, len(pcm_16k_bytes), 4):  # skip every other sample (4 bytes = 2 samples)
            if i + 2 <= len(pcm_16k_bytes):
                samples_8k.extend(pcm_16k_bytes[i : i + 2])
        pcm_8k = bytes(samples_8k)
        return audioop.lin2ulaw(pcm_8k, 2)
    except Exception as e:
        logger.warning("PCM to mulaw conversion failed: %s", type(e).__name__)
        return None
