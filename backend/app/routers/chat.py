"""Chat router: channels, messages, DMs, groups, WebSocket real-time."""

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, WebSocketException
from sqlalchemy.orm import Session, joinedload
from typing import Optional, List, Set
from datetime import datetime, timezone
import json

from app.database import get_db, SessionLocal
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.chat import ChatChannel, ChatMember, ChatMessage

router = APIRouter()

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[int, list[WebSocket]] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket):
        if user_id in self.active_connections:
            self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def broadcast_to_user(self, user_id: int, message: dict):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except:
                    pass

manager = ConnectionManager()


@router.get("/channels")
async def list_channels(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all channels/DMs the user is a member of."""
    channels = db.query(ChatChannel).join(ChatMember).filter(
        ChatMember.user_id == current_user.id,
        ChatChannel.is_archived == False,
    ).options(
        joinedload(ChatChannel.members).joinedload(ChatMember.user),
        joinedload(ChatChannel.messages),
    ).all()

    return {
        "channels": [
            {
                "id": c.id,
                "name": c.name,
                "description": c.description,
                "channel_type": c.channel_type,
                "members": [{"id": m.user_id, "name": m.user.full_name} for m in c.members],
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "message_count": len(c.messages),
            }
            for c in channels
        ],
        "total": len(channels),
    }


@router.post("/channels")
async def create_channel(
    channel_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create DM, group, or channel.
    Payload: {
        "channel_type": "dm|group|channel",
        "name": str (optional, required for group/channel),
        "description": str (optional),
        "member_ids": [user_id, ...] (required, excludes current_user),
    }
    """
    channel_type = channel_data.get("channel_type", "dm")

    # Validate
    if channel_type in ["group", "channel"] and not channel_data.get("name"):
        raise HTTPException(status_code=400, detail="name required for group/channel")

    # Create channel
    channel = ChatChannel(
        name=channel_data.get("name"),
        description=channel_data.get("description"),
        channel_type=channel_type,
        created_by_id=current_user.id,
    )
    db.add(channel)
    db.flush()

    # Add creator as member
    creator_member = ChatMember(
        channel_id=channel.id,
        user_id=current_user.id,
    )
    db.add(creator_member)

    # Add other members
    member_ids = channel_data.get("member_ids", [])
    for member_id in member_ids:
        if member_id != current_user.id:
            member = ChatMember(
                channel_id=channel.id,
                user_id=member_id,
            )
            db.add(member)

    db.commit()

    return {
        "id": channel.id,
        "name": channel.name,
        "channel_type": channel_type,
        "created_at": channel.created_at,
    }


@router.get("/channels/{channel_id}/messages")
async def get_messages(
    channel_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get paginated messages from channel."""
    channel = db.query(ChatChannel).filter(ChatChannel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    # Check membership
    member = db.query(ChatMember).filter(
        ChatMember.channel_id == channel_id,
        ChatMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this channel")

    total = db.query(ChatMessage).filter(
        ChatMessage.channel_id == channel_id,
        ChatMessage.is_deleted == False,
    ).count()

    messages = db.query(ChatMessage).options(
        joinedload(ChatMessage.user)
    ).filter(
        ChatMessage.channel_id == channel_id,
        ChatMessage.is_deleted == False,
    ).order_by(ChatMessage.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()

    return {
        "messages": [
            {
                "id": m.id,
                "user_id": m.user_id,
                "user_name": m.user.full_name,
                "content": m.content,
                "message_type": m.message_type,
                "file_url": m.file_url,
                "file_name": m.file_name,
                "is_edited": m.is_edited,
                "created_at": m.created_at,
            }
            for m in reversed(messages)
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("/channels/{channel_id}/messages")
async def send_message(
    channel_id: int,
    message_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Send message to channel.
    Payload: {
        "content": str,
        "message_type": "text|file|image|case_ref" (optional, default "text"),
        "file_url": str (optional),
        "file_name": str (optional),
        "case_ref_type": str (optional),
        "case_ref_id": int (optional),
    }
    """
    channel = db.query(ChatChannel).filter(ChatChannel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    # Check membership
    member = db.query(ChatMember).filter(
        ChatMember.channel_id == channel_id,
        ChatMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this channel")

    message = ChatMessage(
        channel_id=channel_id,
        user_id=current_user.id,
        content=message_data.get("content"),
        message_type=message_data.get("message_type", "text"),
        file_url=message_data.get("file_url"),
        file_name=message_data.get("file_name"),
        case_ref_type=message_data.get("case_ref_type"),
        case_ref_id=message_data.get("case_ref_id"),
    )
    db.add(message)
    db.commit()

    # Broadcast to all members
    for m in channel.members:
        await manager.broadcast_to_user(m.user_id, {
            "type": "message",
            "channel_id": channel_id,
            "message_id": message.id,
            "user_id": current_user.id,
            "user_name": current_user.full_name,
            "content": message.content,
            "timestamp": message.created_at.isoformat(),
        })

    return {
        "id": message.id,
        "channel_id": channel_id,
        "user_id": current_user.id,
        "content": message.content,
        "created_at": message.created_at,
    }


@router.put("/channels/{channel_id}/read")
async def mark_channel_read(
    channel_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark channel as read for current user."""
    member = db.query(ChatMember).filter(
        ChatMember.channel_id == channel_id,
        ChatMember.user_id == current_user.id,
    ).first()

    if not member:
        raise HTTPException(status_code=404, detail="Not a member of this channel")

    member.last_read_at = datetime.now(timezone.utc)
    db.commit()

    return {"status": "marked_read", "channel_id": channel_id}


@router.websocket("/ws/{user_id}")
async def websocket_endpoint(
    user_id: int,
    websocket: WebSocket,
    token: Optional[str] = Query(None),
):
    """WebSocket for real-time messages. Requires token query param for authentication."""
    # Authenticate before accepting the connection
    if not token:
        await websocket.close(code=4001, reason="Authentication required")
        return

    # Validate token and resolve user
    from app.middleware.auth import verify_token  # noqa: PLC0415
    from jose import JWTError
    db = SessionLocal()
    try:
        payload = verify_token(token)
        sub = payload.get("sub")
        if not sub:
            await websocket.close(code=4001, reason="Invalid token payload")
            return
        auth_user = db.query(User).filter(User.id == int(sub)).first()
        if not auth_user:
            await websocket.close(code=4001, reason="User not found")
            return
        if auth_user.status != "active":
            await websocket.close(code=4003, reason="Account inactive")
            return
        # Ensure the user_id in the URL matches the authenticated user
        if auth_user.id != user_id:
            await websocket.close(code=4003, reason="Forbidden")
            return
    except Exception:
        await websocket.close(code=4001, reason="Authentication failed")
        return
    finally:
        db.close()

    await manager.connect(user_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            # Echo ping back to the same user
            if message_data.get("type") == "ping":
                await manager.broadcast_to_user(user_id, {
                    "type": "pong",
                    "data": message_data,
                })
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
