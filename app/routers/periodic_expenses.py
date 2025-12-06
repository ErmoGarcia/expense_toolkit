from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from fuzzywuzzy import fuzz
from ..database import get_db
from ..models.periodic_expense import PeriodicExpense

router = APIRouter()

@router.get("/")
async def get_periodic_expenses(q: str = None, db: Session = Depends(get_db)):
    """Get all periodic expenses, optionally filtered by query"""
    query = db.query(PeriodicExpense)
    if q:
        query = query.filter(PeriodicExpense.name.ilike(f"%{q}%"))
    periodic_expenses = query.order_by(PeriodicExpense.name).all()
    return periodic_expenses

@router.post("/")
async def create_periodic_expense(data: dict, db: Session = Depends(get_db)):
    """Create a new periodic expense"""
    periodic_expense = PeriodicExpense(
        name=data["name"]
    )
    db.add(periodic_expense)
    db.commit()
    db.refresh(periodic_expense)
    return periodic_expense

@router.get("/suggest")
async def suggest_periodic_expense(name: str = Query(...), db: Session = Depends(get_db)):
    """Suggest a periodic expense for a name using fuzzy matching"""
    periodic_expenses = db.query(PeriodicExpense).all()
    
    best_match = None
    best_score = 0
    
    for pe in periodic_expenses:
        score = fuzz.ratio(name.lower(), pe.name.lower())
        
        if score > best_score and score > 70:  # threshold for fuzzy match
            best_score = score
            best_match = pe
    
    return {
        "suggestion": best_match.name if best_match else None,
        "periodic_expense": best_match,
        "confidence": best_score
    }