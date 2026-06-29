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
                "created_by_id": c.created_by_id,
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
    member_ids_in = channel_data.get("member_ids", []) or []

    # Validate
    if channel_type in ["group", "channel"] and not channel_data.get("name"):
        raise HTTPException(status_code=400, detail="name required for group/channel")

    # DM dedup: if a 1-on-1 DM already exists between these two users, reuse it
    if channel_type == "dm" and len(member_ids_in) >= 1:
        other_id = member_ids_in[0]
        wanted = {current_user.id, other_id}
        existing_dms = db.query(ChatChannel).join(ChatMember).filter(
            ChatChannel.channel_type == "dm",
            ChatChannel.is_archived == False,
            ChatMember.user_id == current_user.id,
        ).all()
        for dm in existing_dms:
            member_set = {m.user_id for m in dm.members}
            if member_set == wanted:
                return {
                    "id": dm.id,
                    "name": dm.name,
                    "channel_type": dm.channel_type,
                    "created_at": dm.created_at,
                    "existing": True,
                }

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
    for member_id in member_ids_in:
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


def _can_manage_members(user: User, channel: ChatChannel) -> bool:
    """Creator, admins and teamleaders may manage channel members."""
    return (
        channel.created_by_id == user.id
        or user.role in ("admin_pay", "admin_trade")
        or bool(getattr(user, "is_teamleader", False))
    )


@router.post("/channels/{channel_id}/members")
async def add_channel_members(
    channel_id: int,
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add one or more users to an existing channel/group. Payload: user_ids list."""
    channel = db.query(ChatChannel).filter(ChatChannel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    if channel.channel_type == "dm":
        raise HTTPException(status_code=400, detail="Cannot add members to a direct message")

    me = db.query(ChatMember).filter(
        ChatMember.channel_id == channel_id, ChatMember.user_id == current_user.id
    ).first()
    if not me:
        raise HTTPException(status_code=403, detail="Not a member of this channel")
    if not _can_manage_members(current_user, channel):
        raise HTTPException(status_code=403, detail="Only the channel owner can manage members")

    user_ids = payload.get("user_ids", []) or []
    existing = {m.user_id for m in channel.members}
    added = []
    for uid in user_ids:
        if uid in existing:
            continue
        user = db.query(User).filter(User.id == uid, User.status == "active").first()
        if not user:
            continue
        db.add(ChatMember(channel_id=channel_id, user_id=uid))
        added.append(uid)
    db.commit()
    return {"status": "ok", "added": added}


@router.delete("/channels/{channel_id}/members/{user_id}")
async def remove_channel_member(
    channel_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a member from a channel/group. Owner/admin can remove anyone; anyone may remove themselves (leave)."""
    channel = db.query(ChatChannel).filter(ChatChannel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    if channel.channel_type == "dm":
        raise HTTPException(status_code=400, detail="Cannot remove members from a direct message")

    is_self = user_id == current_user.id
    if not is_self and not _can_manage_members(current_user, channel):
        raise HTTPException(status_code=403, detail="Only the channel owner can remove other members")

    member = db.query(ChatMember).filter(
        ChatMember.channel_id == channel_id, ChatMember.user_id == user_id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    db.delete(member)
    db.commit()
    return {"status": "ok", "removed": user_id}


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
