import time
from .redis_client import get_async_redis

_LUA = """
local key    = KEYS[1]
local window = tonumber(ARGV[1])
local limit  = tonumber(ARGV[2])
local now    = tonumber(ARGV[3])
local cutoff = now - window * 1000

redis.call('ZREMRANGEBYSCORE', key, '-inf', cutoff)
local count = redis.call('ZCARD', key)
if count >= limit then return 0 end
redis.call('ZADD', key, now, now .. ':' .. math.random())
redis.call('EXPIRE', key, window + 1)
return 1
"""

_client = get_async_redis()
_SLIDING_WINDOW = _client.register_script(_LUA)

async def allow(key: str, limit: int, window: int) -> bool:
    allowed = await _SLIDING_WINDOW(keys=[f"throttle:{key}"], args=[window, limit, int(time.time() * 1000)])
    return bool(int(allowed))