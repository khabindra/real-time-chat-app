from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken

User = get_user_model()

@database_sync_to_async
def _get_user_from_token(token_str):
    try:
        access = AccessToken(token_str)
        return User.objects.get(id=access["user_id"])
    except Exception:
        return AnonymousUser()

class JWTAuthMiddleware:
    def __init__(self, inner): self.inner = inner
    async def __call__(self, scope, receive, send):
        if scope["type"] != "websocket": return await self.inner(scope, receive, send)
        subprotocols = scope.get("subprotocols") or []
        token = next((proto for proto in subprotocols if proto != "chat"), None)
        scope["user"] = await _get_user_from_token(token) if token else AnonymousUser()
        return await self.inner(scope, receive, send)

def JWTAuthMiddlewareStack(inner):
    return JWTAuthMiddleware(inner)