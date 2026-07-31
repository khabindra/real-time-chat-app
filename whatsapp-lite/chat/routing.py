from django.urls import re_path
from .consumers import ChatConsumer
from .notification_consumer import NotificationConsumer

UUID_RE = r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
websocket_urlpatterns = [
    re_path(rf"ws/chat/(?P<room_id>{UUID_RE})/$", ChatConsumer.as_asgi()),
    re_path(r"ws/notifications/$", NotificationConsumer.as_asgi()), # <-- ADD THIS
]