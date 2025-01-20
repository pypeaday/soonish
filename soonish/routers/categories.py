"""
Categories router module for Soonish.

This module handles all category-related API endpoints and default category creation.
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from soonish.database import get_session
from soonish.models import Category as CategoryModel
from soonish.schemas import Category, CategoryCreate
from soonish.auth import get_current_user
from soonish.dependencies import login_required

router = APIRouter()

DEFAULT_CATEGORIES = [
    {"name": "Work", "color": "#3B82F6"},  # Blue
    {"name": "Personal", "color": "#10B981"},  # Green
    {"name": "Family", "color": "#F59E0B"},  # Yellow
    {"name": "Health", "color": "#EF4444"},  # Red
    {"name": "Social", "color": "#8B5CF6"},  # Purple
    {"name": "Holiday", "color": "#6366F1"},  # Indigo
]


async def create_default_categories(user_id: int, session: AsyncSession):
    """Create default categories for a new user."""
    categories = []
    for cat in DEFAULT_CATEGORIES:
        category = CategoryModel(name=cat["name"], color=cat["color"], user_id=user_id)
        categories.append(category)

    session.add_all(categories)
    await session.commit()
    return categories


@router.post("/", response_model=Category)
@login_required
async def create_category(
    request: Request,
    category: CategoryCreate,
    session: AsyncSession = Depends(get_session),
):
    """
    Create a new category.

    Parameters:
    - category: Category data including name and color

    Returns:
    - Category: Created category object

    Raises:
    - 401: Unauthorized
    - 422: Validation Error
    """
    current_user = await get_current_user(request, session)
    db_category = CategoryModel(**category.model_dump(), user_id=current_user.id)
    session.add(db_category)
    await session.commit()
    await session.refresh(db_category)
    return db_category


@router.get("/", response_model=List[Category])
@login_required
async def list_categories(
    request: Request, session: AsyncSession = Depends(get_session)
):
    """
    List all categories for the current user.
    Creates default categories if none exist.

    Returns:
    - List[Category]: List of category objects

    Raises:
    - 401: Unauthorized
    """
    current_user = await get_current_user(request, session)

    # Get existing categories
    result = await session.execute(
        select(CategoryModel).filter(CategoryModel.user_id == current_user.id)
    )
    categories = result.scalars().all()

    # Create default categories if none exist
    if not categories:
        categories = await create_default_categories(current_user.id, session)

    return categories


@router.get("/{category_id}", response_model=Category)
@login_required
async def get_category(
    request: Request, category_id: int, session: AsyncSession = Depends(get_session)
):
    """
    Get a specific category by ID.

    Parameters:
    - category_id: ID of the category to retrieve

    Returns:
    - Category: Category object if found

    Raises:
    - 401: Unauthorized
    - 404: Category not found
    """
    current_user = await get_current_user(request, session)
    result = await session.execute(
        select(CategoryModel).filter(
            CategoryModel.id == category_id, CategoryModel.user_id == current_user.id
        )
    )
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


@router.delete("/{category_id}")
@login_required
async def delete_category(
    request: Request, category_id: int, session: AsyncSession = Depends(get_session)
):
    """
    Delete a category.

    Parameters:
    - category_id: ID of the category to delete

    Returns:
    - dict: Success message

    Raises:
    - 401: Unauthorized
    - 404: Category not found
    """
    current_user = await get_current_user(request, session)
    result = await session.execute(
        select(CategoryModel).filter(
            CategoryModel.id == category_id, CategoryModel.user_id == current_user.id
        )
    )
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    await session.delete(category)
    await session.commit()
    return {"message": "Category deleted"}
