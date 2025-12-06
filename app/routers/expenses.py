from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional, List
from ..database import get_db
from ..models.expense import Expense
from ..models.category import Category
from ..models.tag import Tag
from ..models.merchant import MerchantAlias
from ..models.periodic_expense import PeriodicExpense

router = APIRouter()

def serialize_expense(expense, include_children=False):
    """Serialize an expense with its relationships"""
    # Check if this expense has children (is a group parent)
    child_expenses = getattr(expense, 'child_expenses', None) or []
    is_group = len(child_expenses) > 0
    
    result = {
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
        "latitude": expense.latitude,
        "longitude": expense.longitude,
        "periodic_expense_id": expense.periodic_expense_id,
        "parent_expense_id": expense.parent_expense_id,
        "is_recurring": expense.is_recurring,
        "is_group": is_group,
        "merchant_alias": {
            "id": expense.merchant_alias.id,
            "display_name": expense.merchant_alias.display_name,
            "raw_name": expense.merchant_alias.raw_name
        } if expense.merchant_alias else None,
        "periodic_expense": {
            "id": expense.periodic_expense.id,
            "name": expense.periodic_expense.name
        } if expense.periodic_expense else None,
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
    
    # Include child expenses if requested
    if include_children and child_expenses:
        result["child_expenses"] = [
            serialize_expense(child, include_children=False) 
            for child in child_expenses
        ]
    
    return result

@router.get("/")
async def get_expenses(
    skip: int = Query(0, description="Number of records to skip"),
    limit: int = Query(50, description="Number of records to return"),
    category_id: Optional[int] = Query(None, description="Filter by category"),
    search: Optional[str] = Query(None, description="Search in description/merchant"),
    date_from: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    include_children: bool = Query(False, description="Include child expenses in grouped expenses"),
    db: Session = Depends(get_db)
):
    """Get expenses with optional filters. Child expenses are excluded by default."""
    query = db.query(Expense).options(
        joinedload(Expense.merchant_alias),
        joinedload(Expense.category),
        joinedload(Expense.periodic_expense),
        joinedload(Expense.tags),
        joinedload(Expense.child_expenses)
    )
    
    # Exclude child expenses (those with parent_expense_id)
    query = query.filter(Expense.parent_expense_id == None)
    
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
    count_query = db.query(Expense).filter(Expense.parent_expense_id == None)
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
        "expenses": [serialize_expense(e, include_children=include_children) for e in expenses],
        "total": total,
        "skip": skip,
        "limit": limit
    }

@router.get("/{expense_id}")
async def get_expense(expense_id: int, db: Session = Depends(get_db)):
    """Get a single expense by ID with its child expenses if it's a group"""
    expense = db.query(Expense).options(
        joinedload(Expense.merchant_alias),
        joinedload(Expense.category),
        joinedload(Expense.periodic_expense),
        joinedload(Expense.tags),
        joinedload(Expense.child_expenses).joinedload(Expense.merchant_alias),
        joinedload(Expense.child_expenses).joinedload(Expense.category),
        joinedload(Expense.child_expenses).joinedload(Expense.tags)
    ).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    return serialize_expense(expense, include_children=True)

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