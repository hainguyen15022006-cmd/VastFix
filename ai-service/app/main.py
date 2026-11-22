import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .ranking import DEFAULT_MIN_SCORE, LexicalScorer, rank
from .schemas import DuplicateRequest, DuplicateResponse, HealthResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    model_dir = os.getenv("VASTFIX_EMBEDDING_DIR")
    if model_dir:
        from .embedding import E5Scorer

        app.state.scorer = E5Scorer(Path(model_dir))
    else:
        app.state.scorer = LexicalScorer()
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
    return HealthResponse(model_version=app.state.scorer.version)


@app.post("/duplicates")
def duplicates(request: DuplicateRequest) -> DuplicateResponse:
    scorer = app.state.scorer
    return DuplicateResponse(
        request_id=request.request_id,
        suggestions=rank(request, scorer, app.state.min_score),
        model_version=scorer.version,
    )
