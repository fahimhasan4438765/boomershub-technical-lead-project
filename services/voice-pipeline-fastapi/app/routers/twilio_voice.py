"""Twilio voice webhook: returns TwiML to stream the call to our pipeline."""

import logging
from fastapi import APIRouter, Request
from fastapi.responses import Response

from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/twilio", tags=["twilio"])


@router.post("/voice")
async def voice_webhook(_request: Request) -> Response:
    """Handle incoming Twilio voice call and return TwiML for media streaming."""
    logger.info("Twilio voice webhook called (incoming call)")
    ws_url = (settings.twilio_media_ws_url or "").strip()
    if not ws_url:
        logger.error("TWILIO_MEDIA_WS_URL is not set; cannot stream call")
        twiml = (
            '<?xml version="1.0" encoding="UTF-8"?><Response>'
            "<Say>Sorry, the voice agent is not configured. Goodbye.</Say></Response>"
        )
        return Response(content=twiml, media_type="application/xml")

    twiml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        "<Response>"
        "<Connect>"
        f'<Stream url="{ws_url}"/>'
        "</Connect>"
        "</Response>"
    )
    logger.info("Returning TwiML to stream call to WebSocket (url configured)")
    return Response(content=twiml, media_type="application/xml")
