from abc import ABC, abstractmethod


class BaseSTTService(ABC):
    @abstractmethod
    async def transcribe(self, audio_path: str) -> str:
        raise NotImplementedError
