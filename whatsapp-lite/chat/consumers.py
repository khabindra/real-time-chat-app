import uuid
from datetime import datetime, timezone
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from django.conf import settings
from django.utils import timezone as dj_timezone

from .models import Room, Message, Participant, User, Block
from .redis_client import get_async_redis
from .throttle import allow
from .services import mark_room_delivered

def presence_zset(): return "presence:online"

def _is_valid_uuid(val):
    if not isinstance(val, str): return False
    try: uuid.UUID(val); return True
    except ValueError: return False

class ChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        await self.accept(subprotocol="chat")
        self.user = self.scope.get("user")
        self.room_id = self.scope["url_route"]["kwargs"]["room_id"]
        self.group = f"chat_{self.room_id}"
        self.ready = False

        if self.user is None or not self.user.is_authenticated: await self.close(code=4401); return
        if not await self._is_participant(): await self.close(code=4403); return

        await self.channel_layer.group_add(self.group, self.channel_name)
        self.ready = True
        await self._set_online()
        await self._broadcast_presence(online=True)

    async def disconnect(self, code):
        if not getattr(self, "ready", False): return
        await self.channel_layer.group_discard(self.group, self.channel_name)
        await self._set_offline()
        await self._broadcast_presence(online=False)

    async def receive_json(self, content, **kwargs):
        if not isinstance(content, dict) or "type" not in content: return
        action = content["type"]

        if action in ("chat.message", "chat.edit", "chat.read", "chat.typing", "chat.stop_typing", "chat.mark_delivered", "chat.delete"):
            if not await self._guard_membership(): return

        if action == "chat.message":
            text = content.get("content")
            if not isinstance(text, str) or not text.strip() or len(text) > 4096: 
                await self.send_json({"type": "error", "detail": "invalid content"}); 
                return
            
            if not await allow(f"msg:{self.user.id}", limit=60, window=60): await self.send_json({"type": "error", "detail": "rate_limited"}); return
            await self._handle_new_message(text.strip(), content.get("temp_id"))

        elif action == "chat.typing":
            if not await allow(f"typing:{self.user.id}", limit=10, window=10): return
            await self._handle_typing()

        elif action == "chat.stop_typing": await self._handle_stop_typing()

        elif action == "chat.read":
            last_msg_id = content.get("last_message_id")
            if not _is_valid_uuid(last_msg_id): await self.send_json({"type": "error", "detail": "invalid last_message_id format"}); return
            await self._handle_read_receipt(last_msg_id)

        elif action == "chat.mark_delivered": await self._handle_mark_delivered()

        elif action == "heartbeat":
            if not await self._is_participant():
                await self.send_json({"type": "system.kicked", "reason": "removed_from_room"}); await self.close(code=4403); return
            r = await self._redis()
            now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
            await r.zadd(presence_zset(), {str(self.user.id): now_ms})

        elif action == "chat.delete":
            message_id = content.get("message_id")
            if not _is_valid_uuid(message_id): await self.send_json({"type": "error", "detail": "invalid message_id format"}); return
            await self._handle_delete(message_id)

    async def _handle_delete(self, message_id):
        msg = await self._delete_message(message_id)
        if msg is None: await self.send_json({"type": "error", "detail": "delete failed"}); return
        await self.channel_layer.group_send(self.group, {"type": "chat.message", "message": await self._serialize_message(msg)})

    @database_sync_to_async
    def _delete_message(self, message_id):
        msg = Message.objects.filter(id=message_id, sender=self.user, room_id=self.room_id).first()
        if not msg: return None
        msg.content = "🚫 This message was deleted"
        msg.is_deleted = True
        msg.save(update_fields=["content", "is_deleted"])
        return msg

    async def _handle_new_message(self, text, temp_id=None):
        msg = await self._save_message(text)
        msg_data = await self._serialize_message(msg)
        if temp_id: msg_data["temp_id"] = temp_id
        # Broadcast the message to the room
        await self.channel_layer.group_send(self.group, {"type": "chat.message", "message": msg_data})
        # FIX: Notify all participants to refresh their sidebar (in case the room was hidden)
        participant_ids = await self._get_participant_ids()
        for pid in participant_ids:
            if str(pid) != str(self.user.id): # Don't notify the sender
                await self.channel_layer.group_send(
                    f"notify_{pid}",
                    {"type": "new_room", "room_id": str(self.room_id)}
                )

    @database_sync_to_async
    def _get_participant_ids(self):
        return list(Participant.objects.filter(room_id=self.room_id).values_list("user_id", flat=True))

    async def _handle_typing(self):
        await self.channel_layer.group_send(self.group, {"type": "chat.typing", "user_id": str(self.user.id), "username": self.user.username, "is_typing": True})

    async def _handle_stop_typing(self):
        await self.channel_layer.group_send(self.group, {"type": "chat.typing", "user_id": str(self.user.id), "username": self.user.username, "is_typing": False})

    async def _handle_read_receipt(self, last_msg_id):
        updated = await self._mark_read_up_to(last_msg_id)
        if updated:
            await self.channel_layer.group_send(self.group, {"type": "chat.read", "reader_id": str(self.user.id), "reader": self.user.username, "last_message_id": last_msg_id, "read_at": datetime.now(timezone.utc).isoformat()})

    async def _handle_mark_delivered(self):
        delivered_ids = await self._mark_delivered()
        if delivered_ids: await self.channel_layer.group_send(self.group, {"type": "chat.delivered", "delivered_ids": delivered_ids})

    async def _guard_membership(self):
        if await self._is_participant(): return True
        await self.send_json({"type": "system.kicked", "reason": "removed_from_room"}); await self.close(code=4403); return False

    async def chat_message(self, event):
        # FIX: Ignore messages from users I have blocked
        sender_id = event["message"].get("sender_id")
        if await self._is_blocked_by_me(sender_id): return
        await self.send_json({"type": "chat.message", "message": event["message"]})

    async def chat_typing(self, event):
        if event["user_id"] == str(self.user.id): return
        # FIX: Ignore typing events from users I have blocked
        if await self._is_blocked_by_me(event["user_id"]): return

        await self.send_json({"type": "chat.typing", "user_id": event["user_id"], "username": event["username"], "is_typing": event["is_typing"]})

    async def presence_update(self, event):
        # FIX: Ignore presence updates from users I have blocked
        if await self._is_blocked_by_me(event["user_id"]): return

        await self.send_json({"type": "presence.update", "user_id": event["user_id"], "username": event["username"], "online": event["online"], "last_seen": event.get("last_seen")})
    # -----------------------------

    async def chat_read(self, event): await self.send_json({"type": "chat.read", "reader_id": event["reader_id"], "reader": event["reader"], "last_message_id": event["last_message_id"], "read_at": event["read_at"]})
    async def chat_delivered(self, event): await self.send_json({"type": "chat.delivered", "delivered_ids": event["delivered_ids"]})
    async def room_update(self, event):
        await self.send_json({"type": "room.update"})
    async def system_kicked(self, event):
        if event.get("user_id") == str(self.user.id): await self.send_json({"type": "system.kicked"}); await self.close(code=4403)

    # --- ADD THIS HELPER METHOD ---
    @database_sync_to_async
    def _is_blocked_by_me(self, sender_id):
        try:
            sender = User.objects.get(id=sender_id)
        except User.DoesNotExist:
            return False
        return Block.objects.filter(blocker=self.user, blocked=sender).exists()
    # -------------------------------

    @database_sync_to_async
    def _is_participant(self): 
        return Participant.objects.filter(room_id=self.room_id, user=self.user).exists()

    @database_sync_to_async
    def _save_message(self, text): 
        Participant.objects.filter(room_id=self.room_id).update(is_hidden=False)
        return Message.objects.create(room_id=self.room_id, sender=self.user, content=text)
    @database_sync_to_async
    def _serialize_message(self, msg):
        return {"id": str(msg.id), "room_id": str(msg.room_id), "sender_id": str(msg.sender_id), "sender": msg.sender.username, "content": msg.content, "status": msg.status, "edited_at": msg.edited_at.isoformat() if msg.edited_at else None, "is_deleted": msg.is_deleted, "created_at": msg.created_at.isoformat()}
    @database_sync_to_async
    def _mark_read_up_to(self, last_msg_id):
        from .services import mark_room_read
        return mark_room_read(Room.objects.get(id=self.room_id), self.user, last_msg_id)
    @database_sync_to_async
    def _mark_delivered(self): return mark_room_delivered(Room.objects.get(id=self.room_id), self.user)
    @database_sync_to_async
    def _my_room_ids(self): return list(Participant.objects.filter(user=self.user).values_list("room_id", flat=True))

    async def _redis(self): return get_async_redis()

    async def _set_online(self):
        r = await self._redis()
        now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
        await r.zadd(presence_zset(), {str(self.user.id): now_ms})
        await self._touch_last_seen()

    async def _set_offline(self):
        r = await self._redis()
        await r.zrem(presence_zset(), str(self.user.id))
        await self._touch_last_seen()

    @database_sync_to_async
    def _touch_last_seen(self): User.objects.filter(id=self.user.id).update(last_seen=datetime.now(timezone.utc))

    async def _broadcast_presence(self, online):
        room_ids = await self._my_room_ids()
        last_seen = datetime.now(timezone.utc).isoformat()
        for rid in room_ids:
            await self.channel_layer.group_send(f"chat_{rid}", {"type": "presence.update", "user_id": str(self.user.id), "username": self.user.username, "online": online, "last_seen": last_seen})