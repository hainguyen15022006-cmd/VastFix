import os
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .ranking import DEFAULT_MIN_SCORE, LexicalScorer, rank
from .schemas import DuplicateRequest, DuplicateResponse, HealthResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    model_dir = os.getenv("VASTFIX_EMBEDDING_DIR")
    mode = os.getenv("VASTFIX_AI_RUNTIME", "e5" if model_dir else "baseline")
    if mode not in {"baseline", "e5"}:
        raise ValueError("VASTFIX_AI_RUNTIME must be baseline or e5")
    app.state.scorer = None
    app.state.model_version = "baseline-v1" if mode == "baseline" else "multilingual-e5-small-q8-v1"
    try:
        if mode == "e5":
            from .embedding import E5Scorer

            if not model_dir:
                raise ValueError("MODEL_DIRECTORY_REQUIRED")
            app.state.scorer = E5Scorer(Path(model_dir))
            app.state.scorer.similarities("Đèn hỏng", ["The light is broken"])
        else:
            app.state.scorer = LexicalScorer()
    except Exception as error:
        app.state.scorer = None
        logging.getLogger(__name__).error("Model unavailable (%s)", type(error).__name__)
    min_score = float(os.getenv("VASTFIX_DUPLICATE_MIN_SCORE", str(DEFAULT_MIN_SCORE)))
    if not 0 <= min_score <= 1:
        raise ValueError("VASTFIX_DUPLICATE_MIN_SCORE must be in [0, 1]")
    app.state.min_score = min_score
    yield


app = FastAPI(title="VastFix AI", version="1.0.0", lifespan=lifespan)


@app.exception_handler(RequestValidationError)
async def invalid_request(_request, error: RequestValidationError):
    fields = [{"loc": item["loc"], "type": item["type"]} for item in error.errors()]
    return JSONResponse(status_code=422, content={"detail": fields})


@app.get("/health")
def health() -> HealthResponse:
    if app.state.scorer is None:
        return JSONResponse(status_code=503, content={
            "status": "unavailable", "model_version": app.state.model_version,
        })
    return HealthResponse(model_version=app.state.scorer.version)


@app.get("/ready")
def ready():
    return health()


@app.post("/duplicates")
def duplicates(request: DuplicateRequest) -> DuplicateResponse:
    scorer = app.state.scorer
    if scorer is None:
        raise HTTPException(status_code=503, detail="MODEL_UNAVAILABLE")
    return DuplicateResponse(
        request_id=request.request_id,
        suggestions=rank(request, scorer, app.state.min_score),
        model_version=scorer.version,
    )
