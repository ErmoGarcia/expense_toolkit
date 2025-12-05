from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from ..database import get_db
from ..models.expense import Expense
from ..models.category import Category
from ..models.tag import Tag

router = APIRouter()

@router.get("/")
async def get_expenses(
    skip: int = Query(0, description="Number of records to skip"),
    limit: int = Query(50, description="Number of records to return"),
    category_id: Optional[int] = Query(None, description="Filter by category"),
    search: Optional[str] = Query(None, description="Search in description/merchant"),
    date_from: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    """Get expenses with optional filters"""
    query = db.query(Expense)
    
    # Apply filters
    if category_id:
        query = query.filter(Expense.category_id == category_id)
    
    if search:
        query = query.filter(
            Expense.description.contains(search) |
            Expense.merchant_alias.has(display_name=search)
        )
    
    if date_from:
        query = query.filter(Expense.transaction_date >= date_from)
    
    if date_to:
        query = query.filter(Expense.transaction_date <= date_to)
    
    # Order by date descending
    query = query.order_by(Expense.transaction_date.desc())
    
    total = query.count()
    expenses = query.offset(skip).limit(limit).all()
    
    return {
        "expenses": expenses,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@router.get("/{expense_id}")
async def get_expense(expense_id: int, db: Session = Depends(get_db)):
    """Get a single expense by ID"""
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    return expense

@router.put("/{expense_id}")
async def update_expense(expense_id: int, expense_data: dict, db: Session = Depends(get_db)):
    """Update an existing expense"""
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    # Update fields
    for field, value in expense_data.items():
        if hasattr(expense, field):
            setattr(expense, field, value)
    
    db.commit()
    db.refresh(expense)
    return expense

@router.delete("/{expense_id}")
async def delete_expense(expense_id: int, db: Session = Depends(get_db)):
    """Delete an expense"""
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    db.delete(expense)
    db.commit()
    return {"message": "Expense deleted successfully"}