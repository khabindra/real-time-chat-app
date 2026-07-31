# chat/notification_consumer.py
from channels.generic.websocket import AsyncJsonWebsocketConsumer

class NotificationConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get("user")
        if self.user is None or not self.user.is_authenticated:
            await self.close(code=4401); return
        
        # Each user gets their own personal notification channel
        self.group_name = f"notify_{self.user.id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept(subprotocol="chat")
        self.ready = True

    async def disconnect(self, code):
        if not getattr(self, "ready", False): return
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    # Handler for new room creation
    async def new_room(self, event):
        await self.send_json({
            "type": "new_room",
            "room_id": event["room_id"]
        })