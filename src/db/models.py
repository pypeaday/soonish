from sqlalchemy import String, Boolean, LargeBinary, Text, ForeignKey, DateTime, Index, event as sa_event
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional, List
from datetime import datetime, timedelta, timezone
import secrets

from src.db.base import Base, TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "users"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # Relationships
    integrations: Mapped[List["Integration"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan"
    )
    subscriptions: Mapped[List["Subscription"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan"
    )
    organized_events: Mapped[List["Event"]] = relationship(
        back_populates="organizer",
        foreign_keys="Event.organizer_user_id"
    )
    
    def __repr__(self):
        return f"<User(id={self.id}, email={self.email}, verified={self.is_verified})>"


class Event(Base, TimestampMixin):
    __tablename__ = "events"
    __table_args__ = (
        Index('ix_events_start_date', 'start_date'),
        Index('ix_events_public_start', 'is_public', 'start_date'),
    )
    
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    start_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    timezone: Mapped[str] = mapped_column(String(64), default="UTC", nullable=False)
    location: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    temporal_workflow_id: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    organizer_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), index=True, nullable=False
    )
    
    # Relationships
    organizer: Mapped["User"] = relationship(
        back_populates="organized_events",
        foreign_keys=[organizer_user_id]
    )
    subscriptions: Mapped[List["Subscription"]] = relationship(
        back_populates="event",
        cascade="all, delete-orphan"
    )
    invitations: Mapped[List["EventInvitation"]] = relationship(
        cascade="all, delete-orphan"
    )
    
    def __repr__(self):
        return f"<Event(id={self.id}, name={self.name}, start={self.start_date})>"


class Integration(Base, TimestampMixin):
    __tablename__ = "integrations"
    __table_args__ = (
        Index('ix_integrations_user_name_tag', 'user_id', 'name', 'tag', unique=True),
    )
    
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    apprise_url_encrypted: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    tag: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    # Phase 15: Integration type and original config storage
    integration_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)  # "gotify", "email", "ntfy", etc.
    config_json_encrypted: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)  # Encrypted original config
    
    # Relationships
    user: Mapped["User"] = relationship(back_populates="integrations")
    subscription_selectors: Mapped[List["SubscriptionSelector"]] = relationship(
        back_populates="integration",
        cascade="all, delete-orphan"
    )
    
    # Property for transparent encryption/decryption
    @property
    def apprise_url(self) -> str:
        """Decrypt and return the Apprise URL"""
        from src.db.encryption import decrypt_field
        return decrypt_field(self.apprise_url_encrypted)
    
    @apprise_url.setter
    def apprise_url(self, value: str):
        """Encrypt and store the Apprise URL"""
        from src.db.encryption import encrypt_field
        self.apprise_url_encrypted = encrypt_field(value)
    
    @property
    def config_json(self) -> Optional[str]:
        """Decrypt and return the config JSON"""
        if not self.config_json_encrypted:
            return None
        from src.db.encryption import decrypt_field
        return decrypt_field(self.config_json_encrypted)
    
    @config_json.setter
    def config_json(self, value: Optional[str]):
        """Encrypt and store the config JSON"""
        if value is None:
            self.config_json_encrypted = None
        else:
            from src.db.encryption import encrypt_field
            self.config_json_encrypted = encrypt_field(value)
    
    def __repr__(self):
        return f"<Integration(id={self.id}, name={self.name}, tag={self.tag}, type={self.integration_type}, active={self.is_active})>"


# Automatically lowercase tags on insert/update
@sa_event.listens_for(Integration, "before_insert")
@sa_event.listens_for(Integration, "before_update")
def lowercase_tag(mapper, connection, target):
    if target.tag:
        target.tag = target.tag.lower()


class Subscription(Base, TimestampMixin):
    __tablename__ = "subscriptions"
    __table_args__ = (
        Index('ix_subscriptions_event_user', 'event_id', 'user_id', unique=True),
    )
    
    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"), index=True, nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    
    # Relationships
    event: Mapped["Event"] = relationship(back_populates="subscriptions")
    user: Mapped["User"] = relationship(back_populates="subscriptions")
    selectors: Mapped[List["SubscriptionSelector"]] = relationship(
        back_populates="subscription",
        cascade="all, delete-orphan"
    )
    reminders: Mapped[List["SubscriptionReminder"]] = relationship(
        back_populates="subscription",
        cascade="all, delete-orphan"
    )
    
    def __repr__(self):
        return f"<Subscription(id={self.id}, event_id={self.event_id}, user_id={self.user_id})>"


class SubscriptionSelector(Base):
    __tablename__ = "subscription_selectors"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    subscription_id: Mapped[int] = mapped_column(
        ForeignKey("subscriptions.id"), index=True, nullable=False
    )
    integration_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("integrations.id"), nullable=True
    )
    tag: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    
    # Relationships
    subscription: Mapped["Subscription"] = relationship(back_populates="selectors")
    integration: Mapped[Optional["Integration"]] = relationship(
        back_populates="subscription_selectors"
    )
    
    def __repr__(self):
        target = f"integration_id={self.integration_id}" if self.integration_id else f"tag={self.tag}"
        return f"<SubscriptionSelector(id={self.id}, {target})>"


# Automatically lowercase tags on insert/update
@sa_event.listens_for(SubscriptionSelector, "before_insert")
@sa_event.listens_for(SubscriptionSelector, "before_update")
def lowercase_selector_tag(mapper, connection, target):
    if target.tag:
        target.tag = target.tag.lower()


class UnsubscribeToken(Base):
    __tablename__ = "unsubscribe_tokens"
    __table_args__ = (
        Index('ix_unsubscribe_expires', 'expires_at'),
    )
    
    token: Mapped[str] = mapped_column(String(64), primary_key=True)
    subscription_id: Mapped[int] = mapped_column(
        ForeignKey("subscriptions.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    used_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False
    )
    
    @classmethod
    def generate(cls, subscription_id: int) -> "UnsubscribeToken":
        """Generate a new unsubscribe token with 60-day expiration"""
        now = datetime.now(timezone.utc)
        return cls(
            token=secrets.token_urlsafe(48),
            subscription_id=subscription_id,
            created_at=now,
            expires_at=now + timedelta(days=60)
        )
    
    def is_valid(self) -> bool:
        """Check if token is valid (not used and not expired)"""
        now = datetime.now(timezone.utc)
        return self.used_at is None and self.expires_at > now
    
    def mark_used(self):
        """Mark token as used"""
        self.used_at = datetime.now(timezone.utc)


class SubscriptionReminder(Base):
    __tablename__ = "subscription_reminders"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    subscription_id: Mapped[int] = mapped_column(
        ForeignKey("subscriptions.id"), index=True, nullable=False
    )
    offset_seconds: Mapped[int] = mapped_column(nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    
    # Relationship
    subscription: Mapped["Subscription"] = relationship(back_populates="reminders")
    
    def __repr__(self):
        return f"<SubscriptionReminder(id={self.id}, subscription_id={self.subscription_id}, offset_seconds={self.offset_seconds})>"


class EventInvitation(Base, TimestampMixin):
    __tablename__ = "event_invitations"
    __table_args__ = (
        Index('ix_event_invitations_token', 'token', unique=True),
        Index('ix_event_invitations_event', 'event_id'),
    )
    
    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    token: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    invited_by_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    event: Mapped["Event"] = relationship(overlaps="invitations")
    invited_by: Mapped["User"] = relationship()
    
    def is_valid(self) -> bool:
        """Check if invitation is still valid"""
        if self.used_at:
            return False
        
        # Ensure both datetimes are timezone-aware for comparison
        now = datetime.now(timezone.utc)
        expires = self.expires_at
        
        # If expires_at is naive (from SQLite), make it UTC-aware
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        
        if now > expires:
            return False
        return True
    
    def __repr__(self):
        return f"<EventInvitation(id={self.id}, event_id={self.event_id}, email={self.email}, valid={self.is_valid()})>"
