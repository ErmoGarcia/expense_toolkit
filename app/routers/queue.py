from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.expense import RawExpense, Expense
from ..models.merchant import MerchantAlias
from ..models.category import Category
from ..models.tag import Tag, ExpenseTag

router = APIRouter()

@router.get("/")
async def get_next_raw_expense(db: Session = Depends(get_db)):
    """Get the next raw expense to process (FIFO)"""
    raw_expense = db.query(RawExpense).filter(
        ~RawExpense.id.in_(
            db.query(Expense.raw_expense_id).filter(Expense.raw_expense_id.isnot(None))
        )
    ).order_by(RawExpense.imported_at.asc()).first()
    
    if not raw_expense:
        return {"message": "No raw expenses to process"}
    
    return raw_expense

@router.get("/count")
async def get_queue_count(db: Session = Depends(get_db)):
    """Get the number of unprocessed raw expenses"""
    count = db.query(RawExpense).filter(
        ~RawExpense.id.in_(
            db.query(Expense.raw_expense_id).filter(Expense.raw_expense_id.isnot(None))
        )
    ).count()
    
    return {"count": count}

@router.post("/process")
async def process_raw_expense(data: dict, db: Session = Depends(get_db)):
    """Process a raw expense into a proper expense"""
    raw_expense_id = data.get("raw_expense_id")
    merchant_name = data.get("merchant_name")
    category_id = data.get("category_id")
    description = data.get("description", "")
    tag_names = data.get("tags", [])
    
    # Get raw expense
    raw_expense = db.query(RawExpense).filter(RawExpense.id == raw_expense_id).first()
    if not raw_expense:
        raise HTTPException(status_code=404, detail="Raw expense not found")
    
    # Check if already processed
    existing = db.query(Expense).filter(Expense.raw_expense_id == raw_expense_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Raw expense already processed")
    
    # Handle merchant alias
    merchant_alias = None
    if merchant_name:
        # Try to find existing alias
        merchant_alias = db.query(MerchantAlias).filter(
            MerchantAlias.display_name == merchant_name
        ).first()
        
        if not merchant_alias:
            # Create new merchant alias
            merchant_alias = MerchantAlias(
                raw_name=raw_expense.raw_merchant_name or merchant_name,
                display_name=merchant_name,
                default_category_id=category_id
            )
            db.add(merchant_alias)
            db.flush()  # Get the ID
    
    # Create the expense
    expense = Expense(
        raw_expense_id=raw_expense_id,
        bank_account_id=raw_expense.bank_account_id,
        transaction_date=raw_expense.transaction_date,
        amount=raw_expense.amount,
        currency=raw_expense.currency,
        merchant_alias_id=merchant_alias.id if merchant_alias else None,
        category_id=category_id,
        description=description
    )
    
    db.add(expense)
    db.flush()  # Get the expense ID
    
    # Handle tags
    for tag_name in tag_names:
        # Get or create tag
        tag = db.query(Tag).filter(Tag.name == tag_name).first()
        if not tag:
            tag = Tag(name=tag_name)
            db.add(tag)
            db.flush()
        
        # Link expense to tag
        expense_tag = ExpenseTag(expense_id=expense.id, tag_id=tag.id)
        db.add(expense_tag)
    
    db.commit()
    
    return {"message": "Raw expense processed successfully", "expense_id": expense.id}

@router.delete("/{raw_expense_id}")
async def discard_raw_expense(raw_expense_id: int, db: Session = Depends(get_db)):
    """Discard a raw expense without processing"""
    raw_expense = db.query(RawExpense).filter(RawExpense.id == raw_expense_id).first()
    if not raw_expense:
        raise HTTPException(status_code=404, detail="Raw expense not found")
    
    db.delete(raw_expense)
    db.commit()
    return {"message": "Raw expense discarded"}