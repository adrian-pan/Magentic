import re

import modal
from fastapi import FastAPI
from pydantic import BaseModel

app = modal.App("magentic-planner")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "fastapi==0.116.1",
        "pydantic==2.11.7",
        "vllm==0.7.2",
        "transformers==4.49.0",
        "tokenizers>=0.21.0",
        "sentencepiece>=0.2.0",
    )
)

web_app = FastAPI()
_llm = None


class GenerateRequest(BaseModel):
    system: str
    user: str
    max_tokens: int = 1200
    temperature: float = 0.2


def _strip_thinking_tokens(text: str) -> str:
    return re.sub(r"<think>[\s\S]*?</think>", "", text or "").strip()


@app.function(
    image=image,
    gpu="A100-80GB",
    timeout=600,
    scaledown_window=300,
)
@modal.asgi_app()
def serve():
    @web_app.on_event("startup")
    def startup():
        global _llm
        if _llm is None:
            from vllm import LLM
            _llm = LLM(
                model="Qwen/Qwen2.5-14B-Instruct",
                dtype="bfloat16",
                gpu_memory_utilization=0.95,
                max_model_len=8192,
                enable_prefix_caching=True,
                trust_remote_code=True,
            )

    @web_app.get("/health")
    def health():
        return {"status": "ok", "model": "Qwen/Qwen2.5-14B-Instruct"}

    @web_app.post("/generate")
    def generate(req: GenerateRequest):
        from vllm import SamplingParams
        prompt = (
            f"<|im_start|>system\n{req.system}<|im_end|>\n"
            f"<|im_start|>user\n{req.user}<|im_end|>\n"
            f"<|im_start|>assistant\n"
        )
        params = SamplingParams(
            max_tokens=req.max_tokens,
            temperature=req.temperature,
            stop=["<|im_end|>"],
        )
        outputs = _llm.generate([prompt], params)
        raw_text = outputs[0].outputs[0].text
        return {"text": _strip_thinking_tokens(raw_text), "raw_text": raw_text}

    return web_app
