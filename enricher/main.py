import json
from datetime import datetime

from dotenv import load_dotenv
from fastapi import FastAPI
from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai.chat_models import ChatOpenAI
from langfuse.langchain import CallbackHandler

from models import AIGeneratedLeadData, RequestBody
from prompt import SYSTEM_PROMPT

load_dotenv()

app = FastAPI()

parser = PydanticOutputParser(pydantic_object=AIGeneratedLeadData)
model = ChatOpenAI(model="openai/gpt-5-nano", base_url="https://openrouter.ai/api/v1")
prompt = ChatPromptTemplate([("user", SYSTEM_PROMPT)])
callback_handler = CallbackHandler()

chain = prompt | model | parser


@app.post("/enrich", response_model=AIGeneratedLeadData)
async def enrich_tender(request: RequestBody):
    """
    Enrich tender data with AI-generated lead information.
    Takes tender input and generates lead scoring, product recommendations,
    signals, next actions, and sales routing.
    """
    data_dict = request.model_dump(exclude_none=True)
    data_json = json.dumps(data_dict, indent=2, ensure_ascii=False)

    result = await chain.ainvoke(
        {"input": data_json, "output_format": parser.get_format_instructions()},
        config={
            "callbacks": callback_handler,
            "metadata": {
                "langfuse_tag": request.tenderId
            }
        }
    )
    return result


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}
