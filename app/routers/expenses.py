from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional, List
from ..database import get_db
from ..models.expense import Expense
from ..models.category import Category
from ..models.tag import Tag
from ..models.merchant import MerchantAlias

router = APIRouter()

def serialize_expense(expense):
    """Serialize an expense with its relationships"""
    return {
        "id": expense.id,
        "raw_expense_id": expense.raw_expense_id,
        "bank_account_id": expense.bank_account_id,
        "transaction_date": str(expense.transaction_date) if expense.transaction_date else None,
        "amount": float(expense.amount) if expense.amount else 0,
        "currency": expense.currency,
        "merchant_alias_id": expense.merchant_alias_id,
        "category_id": expense.category_id,
        "description": expense.description,
        "notes": expense.notes,
        "is_recurring": expense.is_recurring,
        "merchant_alias": {
            "id": expense.merchant_alias.id,
            "display_name": expense.merchant_alias.display_name,
            "raw_name": expense.merchant_alias.raw_name
        } if expense.merchant_alias else None,
        "category": {
            "id": expense.category.id,
            "name": expense.category.name,
            "color": expense.category.color
        } if expense.category else None,
        "tags": [
            {"id": tag.id, "name": tag.name, "color": tag.color}
            for tag in expense.tags
        ] if expense.tags else []
    }

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
    query = db.query(Expense).options(
        joinedload(Expense.merchant_alias),
        joinedload(Expense.category),
        joinedload(Expense.tags)
    )
    
    # Apply filters
    if category_id:
        query = query.filter(Expense.category_id == category_id)
    
    if search:
        query = query.filter(
            Expense.description.contains(search) |
            Expense.merchant_alias.has(MerchantAlias.display_name.contains(search))
        )
    
    if date_from:
        query = query.filter(Expense.transaction_date >= date_from)
    
    if date_to:
        query = query.filter(Expense.transaction_date <= date_to)
    
    # Order by date descending
    query = query.order_by(Expense.transaction_date.desc())
    
    # Get total count (need separate query for count with joinedload)
    count_query = db.query(Expense)
    if category_id:
        count_query = count_query.filter(Expense.category_id == category_id)
    if search:
        count_query = count_query.filter(
            Expense.description.contains(search) |
            Expense.merchant_alias.has(MerchantAlias.display_name.contains(search))
        )
    if date_from:
        count_query = count_query.filter(Expense.transaction_date >= date_from)
    if date_to:
        count_query = count_query.filter(Expense.transaction_date <= date_to)
    total = count_query.count()
    
    expenses = query.offset(skip).limit(limit).all()
    
    return {
        "expenses": [serialize_expense(e) for e in expenses],
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