from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from typing import Optional, List

from src.db.models import User, Event, Integration, Subscription


class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def get_by_id(self, user_id: int) -> Optional[User]:
        return await self.session.get(User, user_id)
    
    async def get_by_email(self, email: str) -> Optional[User]:
        result = await self.session.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()
    
    async def create(self, user: User) -> User:
        self.session.add(user)
        await self.session.flush()
        return user
    
    async def get_or_create_by_email(self, email: str, name: str) -> tuple[User, bool]:
        """
        Get existing user or create new one.
        Returns (user, created) tuple.
        """
        user = await self.get_by_email(email)
        if user:
            return user, False
        
        # Create new user (unverified)
        user = User(
            email=email,
            name=name,
            is_verified=False
        )
        self.session.add(user)
        await self.session.flush()
        return user, True


class EventRepository:
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def get_by_id(self, event_id: int) -> Optional[Event]:
        return await self.session.get(Event, event_id)
    
    async def get_by_workflow_id(self, workflow_id: str) -> Optional[Event]:
        result = await self.session.execute(
            select(Event).where(Event.temporal_workflow_id == workflow_id)
        )
        return result.scalar_one_or_none()
    
    async def create(self, event: Event) -> Event:
        self.session.add(event)
        await self.session.flush()
        return event
    
    async def update(self, event: Event) -> Event:
        await self.session.flush()
        return event
    
    async def delete(self, event: Event) -> None:
        await self.session.delete(event)
        await self.session.flush()
    
    async def list_public_events(self, skip: int = 0, limit: int = 100) -> List[Event]:
        result = await self.session.execute(
            select(Event).where(Event.is_public).offset(skip).limit(limit)
        )
        return list(result.scalars().all())


class IntegrationRepository:
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def get_by_id(self, integration_id: int) -> Optional[Integration]:
        return await self.session.get(Integration, integration_id)
    
    async def get_by_user(self, user_id: int, active_only: bool = True) -> List[Integration]:
        query = select(Integration).where(Integration.user_id == user_id)
        if active_only:
            query = query.where(Integration.is_active)
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_by_user_and_tag(
        self, user_id: int, tag: str, active_only: bool = True
    ) -> List[Integration]:
        """Get integrations matching a tag (case-insensitive)"""
        query = select(Integration).where(
            and_(
                Integration.user_id == user_id,
                Integration.tag == tag.lower()
            )
        )
        if active_only:
            query = query.where(Integration.is_active)
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def create(self, integration: Integration) -> Integration:
        self.session.add(integration)
        await self.session.flush()
        return integration


class SubscriptionRepository:
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def get_by_id(self, subscription_id: int) -> Optional[Subscription]:
        """Get subscription by ID with selectors eagerly loaded"""
        result = await self.session.execute(
            select(Subscription)
            .where(Subscription.id == subscription_id)
            .options(selectinload(Subscription.selectors))
        )
        return result.scalar_one_or_none()
    
    async def get_by_event(self, event_id: int) -> List[Subscription]:
        """Get all subscriptions for an event with selectors and user loaded"""
        result = await self.session.execute(
            select(Subscription)
            .where(Subscription.event_id == event_id)
            .options(
                selectinload(Subscription.selectors),
                selectinload(Subscription.user).selectinload(User.integrations)
            )
        )
        return list(result.scalars().all())
    
    async def get_by_event_and_user(
        self, event_id: int, user_id: int
    ) -> Optional[Subscription]:
        result = await self.session.execute(
            select(Subscription).where(
                and_(
                    Subscription.event_id == event_id,
                    Subscription.user_id == user_id
                )
            )
        )
        return result.scalar_one_or_none()
    
    async def create(self, subscription: Subscription) -> Subscription:
        self.session.add(subscription)
        await self.session.flush()
        return subscription
    
    async def delete(self, subscription: Subscription):
        await self.session.delete(subscription)
        await self.session.flush()
