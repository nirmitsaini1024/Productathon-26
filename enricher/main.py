import json
from datetime import datetime, timedelta, timezone

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

ist = timezone(timedelta(hours=5, minutes=30))
now_ist = datetime.now(ist).strftime("%Y-%m-%d %H:%M:%S %Z")

parser = PydanticOutputParser(pydantic_object=AIGeneratedLeadData)
model = ChatOpenAI(
    model="google/gemini-2.5-flash-lite", base_url="https://openrouter.ai/api/v1"
)
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
        {
            "input": data_json,
            "output_format": parser.get_format_instructions(),
            "current_time": datetime.now(ist).strftime("%Y-%m-%d %H:%M:%S %Z"),
        },
        config={"callbacks": [callback_handler]},
    )
    return result


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
