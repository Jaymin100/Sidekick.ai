from abc import ABC, abstractmethod
from typing import Type, TypeVar, Generic
from pydantic import BaseModel

InputT = TypeVar("InputT", bound=BaseModel)
OutputT = TypeVar("OutputT", bound=BaseModel)

class BaseAgent(ABC, Generic[InputT, OutputT]):

    def __init__(self, llm, output_schema: Type[OutputT]):
        self.llm = llm
        self.output_schema = output_schema
        self.llm_with_structured_output = llm.with_structured_output(output_schema)

    @abstractmethod
    def build_system_prompt(self) -> str:
        raise NotImplementedError

    @abstractmethod
    def build_user_prompt(self, input_data: str) -> str:
        raise NotImplementedError

    async def run(self, input_data: InputT) -> OutputT:
        system_prompt = self.build_system_prompt()
        user_prompt = self.build_user_prompt(input_data)

        response = await self.llm_with_structured_output.ainvoke(
            [
                ("system", system_prompt),
                ("human", user_prompt),
            ]
        )
        return response
