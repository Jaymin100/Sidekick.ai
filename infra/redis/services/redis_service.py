import json
import redis


class RedisService:
    def __init__(
            self,
            redis_host: str,
            redis_port: int,
            redis_db: int,
            redis_decode_responses: bool
        ) -> None:
        self.client = redis.Redis(
            host=redis_host,
            port=redis_port,
            db=redis_db,
            decode_responses=redis_decode_responses,
        )

    def set_value(self, key: str, value: str, ex: int | None = None) -> None:
        self.client.set(name=key, value=value, ex=ex)

    def get_value(self, key: str) -> str | None:
        return self.client.get(name=key)

    def delete_value(self, key: str) -> None:
        self.client.delete(key)

    def set_json(self, key: str, value: dict, ex: int | None = None) -> None:
        self.set_value(key, json.dumps(value), ex=ex)

    def get_json(self, key: str) -> dict | None:
        value = self.get_value(key)
        if value is None:
            return None
        return json.loads(value)

    def publish(self, channel: str, message: dict) -> None:
        self.client.publish(channel, json.dumps(message))

    def get_pubsub(self):
        return self.client.pubsub()
