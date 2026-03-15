"""SQLAlchemy async engine, session factory, and declarative Base."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from config import DATABASE_URL

# Engine configuration tuning for Cloud environments (Postgres)
engine_args = {
    "echo": False,
    "future": True,
}

if DATABASE_URL.startswith("postgresql"):
    # Postgres specific tuning for Render/Supabase (Pgbouncer compatibility)
    engine_args.update({
        "pool_size": 10,
        "max_overflow": 20,
        "pool_recycle": 1800,
        "pool_pre_ping": True,
        "connect_args": {
            "statement_cache_size": 0,
        }
    })

engine = create_async_engine(DATABASE_URL, **engine_args)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

class Base(DeclarativeBase):
    """Declarative base for all ORM models."""

async def init_db() -> None:
    """Create all tables if they do not exist."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def get_session() -> AsyncSession:  # type: ignore[misc]
    """FastAPI dependency — yields an async session."""
    async with async_session_factory() as session:
        yield session
