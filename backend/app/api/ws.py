"""Multiplexed WebSocket communication endpoint."""

import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.ws_manager import ws_manager

router = APIRouter(prefix="/v1", tags=["WebSocket"])
logger = logging.getLogger("app.api.ws")


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """Primary bidirectional WebSocket interface."""
    conn = await ws_manager.connect(websocket)
    if not conn:
        return

    try:
        while True:
            data = await websocket.receive_text()
            await ws_manager.handle_message(conn, data)
    except WebSocketDisconnect:
        logger.info("Client cleanly disconnected [conn_id=%s]", conn.connection_id)
        await ws_manager.disconnect(conn.connection_id)
    except Exception as e:
        logger.warning("WebSocket connection dropped [conn_id=%s]: %s", conn.connection_id, str(e))
        await ws_manager.disconnect(conn.connection_id)
