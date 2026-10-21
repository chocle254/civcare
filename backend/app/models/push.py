import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text
from app.database import Base


class PushSubscription(Base):
    """
    One browser or installed app that agreed to receive notifications.
    The endpoint belongs to the browser maker's push service (Google, Apple,
    Mozilla); messages to it are end-to-end encrypted with p256dh/auth.
    """
    __tablename__ = "push_subscriptions"

    id           = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id     = Column(String, index=True, nullable=False)   # patient or doctor id
    owner_role   = Column(String, nullable=False)               # patient / doctor
    endpoint     = Column(Text, unique=True, nullable=False)
    p256dh       = Column(String, nullable=False)
    auth         = Column(String, nullable=False)
    user_agent   = Column(String, nullable=True)
    created_at   = Column(DateTime, default=datetime.utcnow)
    last_seen_at = Column(DateTime, default=datetime.utcnow)


class AppSecret(Base):
    """Server-generated secrets kept in the database (e.g. the push signing key)."""
    __tablename__ = "app_secrets"

    key        = Column(String, primary_key=True)
    value      = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
