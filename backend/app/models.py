"""SQLAlchemy ORM models for CyberHash Toolkit."""
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Integer, String, Text

from app.database import Base


class HistoryEntry(Base):
    """A single logged operation, shown in the History module."""

    __tablename__ = "history"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    operation = Column(String(64), nullable=False)      # e.g. "Hash Generation"
    algorithm = Column(String(32), nullable=True)        # e.g. "SHA256"
    input_type = Column(String(32), nullable=False)      # "text" | "file" | "hash" | "n/a"
    input_preview = Column(String(120), nullable=True)   # short, truncated preview only
    result = Column(Text, nullable=True)                 # short result summary
    status = Column(String(32), nullable=False, default="success")  # success | error | match | no_match
