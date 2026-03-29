from abc import ABC, abstractmethod


class BaseTTSService(ABC):
    @abstractmethod
    async def synthesize(self, text: str, output_path: str) -> str:
        raise NotImplementedError
    