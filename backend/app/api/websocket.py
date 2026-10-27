import asyncio
import json
import logging
import time
from typing import Set, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger("mediguard.websocket")

router = APIRouter(prefix="/api/ws", tags=["WebSocket"])

_main_loop: Optional[asyncio.AbstractEventLoop] = None


def set_main_loop(loop: asyncio.AbstractEventLoop):
    """
    Lưu tham chiếu đến main asyncio event loop để các hàm đồng bộ (sync worker threads)
    gọi broadcast an toàn và tức thời.
    """
    global _main_loop
    _main_loop = loop


class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"WebSocket client connected. Total clients: {len(self.active_connections)}")
        # Gửi thông điệp kết nối thành công với time server
        await websocket.send_json({
            "type": "connection_established",
            "message": "Connected to MediGuard AI Real-time Hub (Zero-Latency Max Ping)",
            "timestamp": time.time(),
            "active_clients": len(self.active_connections)
        })

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        logger.info(f"WebSocket client disconnected. Total clients: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """
        Phát sóng song song (Parallel broadcast) tới tất cả client đang kết nối với zero-latency
        """
        if not self.active_connections:
            return

        dead_connections = set()

        async def _send(connection: WebSocket):
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.warning(f"Error sending message to websocket: {e}")
                dead_connections.add(connection)

        # Phát đồng thời tới tất cả connection thay vì tuần tự
        await asyncio.gather(
            *[_send(conn) for conn in list(self.active_connections)],
            return_exceptions=True
        )

        for dead in dead_connections:
            self.active_connections.discard(dead)


manager = ConnectionManager()
ws_manager = manager


def broadcast_sync(event_type: str, payload: dict):
    """
    Hàm tiện ích đồng bộ để gọi từ các route handlers sync hoặc background worker thread.
    Sử dụng run_coroutine_threadsafe đảm bảo tin nhắn được phát đi ngay lập tức.
    """
    message = {
        "type": event_type,
        "data": payload,
        "timestamp": time.time()
    }
    # 1. Thử dùng loop chính đã lưu từ startup lifespan
    global _main_loop
    if _main_loop and _main_loop.is_running():
        try:
            asyncio.run_coroutine_threadsafe(manager.broadcast(message), _main_loop)
            return
        except Exception as e:
            logger.debug(f"run_coroutine_threadsafe warning: {e}")

    # 2. Dự phòng nếu đang chạy trong async context hiện hành
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(manager.broadcast(message))
    except RuntimeError:
        pass


async def notify_realtime_update(event_type: str, data: dict):
    """
    Hàm phát sóng bất đồng bộ sự kiện qua WebSocket tới tất cả client đang kết nối.
    """
    message = {
        "type": event_type,
        "data": data,
        "timestamp": time.time()
    }
    await manager.broadcast(message)


@router.get("/ping")
def ws_ping_http():
    """
    Endpoint HTTP Ping siêu tốc phục vụ đo độ trễ mạng cực thấp (< 1ms trên localhost)
    """
    return {
        "status": "ok",
        "pong": True,
        "mode": "maxping",
        "timestamp": time.time(),
        "active_clients": len(manager.active_connections)
    }


@router.websocket("/updates")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Lắng nghe ping / message từ client để duy trì kết nối và tính RTT chuẩn xác
            data = await websocket.receive_text()
            try:
                parsed = json.loads(data)
                msg_type = parsed.get("type")
                if msg_type == "ping":
                    # Echo lại client_time để client tính chính xác Round-Trip-Time (RTT)
                    client_time = parsed.get("client_time")
                    await websocket.send_json({
                        "type": "pong",
                        "client_time": client_time,
                        "server_time": time.time(),
                        "active_clients": len(manager.active_connections)
                    })
                else:
                    await websocket.send_json({
                        "type": "ack",
                        "raw": data,
                        "timestamp": time.time()
                    })
            except Exception:
                await websocket.send_json({"type": "ack", "raw": data})
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)
