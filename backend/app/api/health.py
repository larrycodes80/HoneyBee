from fastapi import APIRouter

router = APIRouter(tags=["Health"])


@router.get("/health")
@router.get("/api/health")
def get_health() -> dict[str, str]:
    return {"status": "ok"}
