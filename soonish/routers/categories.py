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


@router.post("/", response_model=Category)
@login_required
async def create_category(
    request: Request,
    category: CategoryCreate,
    session: AsyncSession = Depends(get_session),
):
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
    current_user = await get_current_user(request, session)
    result = await session.execute(
        select(CategoryModel).filter(CategoryModel.user_id == current_user.id)
    )
    categories = result.scalars().all()
    return categories


@router.get("/{category_id}", response_model=Category)
@login_required
async def get_category(
    request: Request, category_id: int, session: AsyncSession = Depends(get_session)
):
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
