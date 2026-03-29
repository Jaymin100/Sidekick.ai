from abc import ABC, abstractmethod
from typing import Generic, TypeVar

StateT = TypeVar("StateT")

class BaseNode(ABC, Generic[StateT]):
    def __init__(self) -> None:
        self.name = self.__class__.__name__

    @abstractmethod
    async def run(self, state: StateT) -> StateT:
        raise NotImplementedError
