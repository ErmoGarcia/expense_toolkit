from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models.category import Category
from ..schemas import CategoryCreate, CategoryUpdate, CategoryResponse

router = APIRouter()

@router.get("/", response_model=List[CategoryResponse])
async def get_categories(
    category_type: str = Query(None, description="Filter by category type: 'expense' or 'income'"),
    db: Session = Depends(get_db)
):
    """Get all categories, optionally filtered by type"""
    query = db.query(Category)
    
    if category_type:
        if category_type not in ("expense", "income"):
            raise HTTPException(status_code=400, detail="category_type must be 'expense' or 'income'")
        query = query.filter(Category.category_type == category_type)
    
    categories = query.order_by(Category.name).all()
    return categories

@router.post("/", response_model=CategoryResponse)
async def create_category(data: CategoryCreate, db: Session = Depends(get_db)):
    """Create a new category"""
    # Validate parent category exists and is same type
    if data.parent_id:
        parent = db.query(Category).filter(Category.id == data.parent_id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent category not found")
        # Ensure parent is same type
        if parent.category_type != data.category_type:
            raise HTTPException(status_code=400, detail="Parent category must be same type (expense/income)")
    
    # Check for duplicate name
    existing = db.query(Category).filter(Category.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Category with this name already exists")
    
    category = Category(
        name=data.name,
        color=data.color,
        icon=data.icon,
        category_type=data.category_type,
        parent_id=data.parent_id
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category

@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(category_id: int, data: CategoryUpdate, db: Session = Depends(get_db)):
    """Update a category"""
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Check for duplicate name if name is being changed
    if data.name is not None and data.name != category.name:
        existing = db.query(Category).filter(Category.name == data.name).first()
        if existing:
            raise HTTPException(status_code=400, detail="Category with this name already exists")
    
    # Validate parent if being changed
    if data.parent_id is not None:
        if data.parent_id == category_id:
            raise HTTPException(status_code=400, detail="Category cannot be its own parent")
        parent = db.query(Category).filter(Category.id == data.parent_id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent category not found")
        # Ensure parent is same type
        new_type = data.category_type if data.category_type is not None else category.category_type
        if parent.category_type != new_type:
            raise HTTPException(status_code=400, detail="Parent category must be same type (expense/income)")
    
    # Update only provided fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(category, field, value)
    
    db.commit()
    db.refresh(category)
    return category

@router.delete("/{category_id}")
async def delete_category(category_id: int, db: Session = Depends(get_db)):
    """Delete a category"""
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Check for child categories
    children = db.query(Category).filter(Category.parent_id == category_id).count()
    if children > 0:
        raise HTTPException(status_code=400, detail="Cannot delete category with child categories")
    
    db.delete(category)
    db.commit()
    return {"message": "Category deleted successfully"}
