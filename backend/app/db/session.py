from collections.abc import Generator
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import get_settings

settings = get_settings()

connect_args = {"check_same_thread": False} if "sqlite" in settings.database_url else {}
engine = create_engine(settings.database_url, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db(target_engine=None) -> None:
    # Import all models so metadata knows about all tables
    from app import models as _models  # noqa: F401

    e = target_engine or engine
    Base.metadata.create_all(bind=e)

    # Safe migration: ensure expected_workflow column exists on runs table
    try:
        with e.connect() as conn:
            conn.execute(text("ALTER TABLE runs ADD COLUMN expected_workflow VARCHAR(2048)"))
            conn.commit()
    except Exception:
        pass  # Column already exists

    # Safe migration: ensure new evaluation columns exist on evaluations table
    for col_def in [
        "ALTER TABLE evaluations ADD COLUMN status VARCHAR(32) DEFAULT 'passed'",
        "ALTER TABLE evaluations ADD COLUMN summary TEXT",
        "ALTER TABLE evaluations ADD COLUMN findings JSON DEFAULT '[]'",
        "ALTER TABLE evaluations ADD COLUMN provider_metadata JSON",
    ]:
        try:
            with e.connect() as conn:
                conn.execute(text(col_def))
                conn.commit()
        except Exception:
            pass
