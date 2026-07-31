import redis.asyncio as aioredis
import redis
from django.conf import settings

_async_pool = aioredis.ConnectionPool(host=settings.REDIS_HOST, port=settings.REDIS_PORT, db=0, max_connections=200, decode_responses=True, health_check_interval=30)
_sync_pool = redis.ConnectionPool(host=settings.REDIS_HOST, port=settings.REDIS_PORT, db=0, max_connections=50, decode_responses=True)

def get_async_redis(): return aioredis.Redis(connection_pool=_async_pool)
def get_sync_redis(): return redis.Redis(connection_pool=_sync_pool)