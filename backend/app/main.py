from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request, status, Depends
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.db.session import init_db
from app.api.health import router as health_router
from app.api.replay import router as replay_router
from app.api.runs import router as runs_router
from app.api.workflows import router as workflows_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure database schema is initialized on startup
    init_db()
    yield


app = FastAPI(
    title="HoneyBee API",
    description="Backend foundation for AI agent trace recording, replaying, and debugging",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Standardized error handling matching API_CONTRACT.md:
# { "error": { "code": "...", "message": "..." } }
@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    if isinstance(exc.detail, dict) and "code" in exc.detail and "message" in exc.detail:
        error_payload = exc.detail
    else:
        error_payload = {
            "code": "HTTP_ERROR",
            "message": str(exc.detail),
        }
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": error_payload},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Invalid request payload or query parameters.",
            }
        },
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected server error occurred.",
            }
        },
    )


# Register API routers
app.include_router(health_router)
app.include_router(replay_router)
app.include_router(runs_router)
app.include_router(workflows_router)

# Top-level semantic audit and sample traces endpoints
from app.api.runs import audit_trace_endpoint, list_sample_traces
from app.schemas.evaluation import EvaluationResponse, SampleTraceItem

@app.post("/api/audit", response_model=EvaluationResponse, tags=["Audit"])
def top_level_audit(body: EvaluationResponse = Depends(audit_trace_endpoint)):
    return body

@app.get("/api/sample-traces", response_model=list[SampleTraceItem], tags=["Audit"])
def top_level_sample_traces():
    return list_sample_traces()
