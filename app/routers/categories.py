from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.category import Category

router = APIRouter()

@router.get("/")
async def get_categories(
    category_type: str = Query(None, description="Filter by category type: 'expense' or 'income'"),
    db: Session = Depends(get_db)
):
    """Get all categories, optionally filtered by type"""
    query = db.query(Category)
    
    if category_type:
        query = query.filter(Category.category_type == category_type)
    
    categories = query.order_by(Category.name).all()
    return categories

@router.post("/")
async def create_category(data: dict, db: Session = Depends(get_db)):
    """Create a new category"""
    parent_id = data.get("parent_id")
    
    # Validate parent category exists and is same type
    if parent_id:
        parent = db.query(Category).filter(Category.id == parent_id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent category not found")
        # Ensure parent is same type
        if parent.category_type != data.get("category_type", "expense"):
            raise HTTPException(status_code=400, detail="Parent category must be same type (expense/income)")
    
    category = Category(
        name=data["name"],
        color=data.get("color"),
        icon=data.get("icon"),
        category_type=data.get("category_type", "expense"),
        parent_id=parent_id
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category

@router.put("/{category_id}")
async def update_category(category_id: int, data: dict, db: Session = Depends(get_db)):
    """Update a category"""
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    for field, value in data.items():
        if hasattr(category, field):
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
    
    db.delete(category)
    db.commit()
    return {"message": "Category deleted successfully"}