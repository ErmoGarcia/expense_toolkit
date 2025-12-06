from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import re
from ..database import get_db
from ..models.expense import RawExpense, Expense
from ..models.merchant import MerchantAlias
from ..models.category import Category
from ..models.tag import Tag, ExpenseTag
from ..models.periodic_expense import PeriodicExpense
from ..models.rule import Rule

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

@router.get("/all")
async def get_all_raw_expenses(db: Session = Depends(get_db)):
    """Get all raw expenses to process (FIFO order)"""
    raw_expenses = db.query(RawExpense).filter(
        ~RawExpense.id.in_(
            db.query(Expense.raw_expense_id).filter(Expense.raw_expense_id.isnot(None))
        )
    ).order_by(RawExpense.imported_at.asc()).all()
    
    return raw_expenses

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
    periodic_expense_name = data.get("periodic_expense_name")
    
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

    # Handle periodic expense
    periodic_expense = None
    if periodic_expense_name:
        # Try to find existing periodic expense
        periodic_expense = db.query(PeriodicExpense).filter(
            PeriodicExpense.name == periodic_expense_name
        ).first()

        if not periodic_expense:
            # Create new periodic expense
            periodic_expense = PeriodicExpense(name=periodic_expense_name)
            db.add(periodic_expense)
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
        description=description,
        periodic_expense_id=periodic_expense.id if periodic_expense else None
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

@router.post("/apply-rules")
async def apply_rules(db: Session = Depends(get_db)):
    """Apply all active rules to raw expenses in the queue"""
    # Get all active rules
    active_rules = db.query(Rule).filter(Rule.active == True).all()

    if not active_rules:
        return {"message": "No active rules to apply", "processed": 0, "discarded": 0, "saved": 0}

    # Get all raw expenses in queue
    raw_expenses = db.query(RawExpense).filter(
        ~RawExpense.id.in_(
            db.query(Expense.raw_expense_id).filter(Expense.raw_expense_id.isnot(None))
        )
    ).all()

    processed_count = 0
    discarded_count = 0
    saved_count = 0

    for raw_expense in raw_expenses:
        # Check each rule in order
        for rule in active_rules:
            if _matches_rule(raw_expense, rule):
                if rule.action == "discard":
                    db.delete(raw_expense)
                    discarded_count += 1
                elif rule.action == "save":
                    # Process the expense using save_data
                    save_data = rule.save_data
                    merchant_name = save_data["merchant_name"]
                    category_id = save_data["category_id"]
                    description = save_data.get("description", "")
                    tag_names = save_data.get("tags", [])
                    periodic_expense_name = save_data.get("periodic_expense_name")

                    # Handle merchant alias
                    merchant_alias = None
                    if merchant_name:
                        merchant_alias = db.query(MerchantAlias).filter(
                            MerchantAlias.display_name == merchant_name
                        ).first()

                        if not merchant_alias:
                            merchant_alias = MerchantAlias(
                                raw_name=raw_expense.raw_merchant_name or merchant_name,
                                display_name=merchant_name,
                                default_category_id=category_id
                            )
                            db.add(merchant_alias)
                            db.flush()

                    # Handle periodic expense
                    periodic_expense = None
                    if periodic_expense_name:
                        periodic_expense = db.query(PeriodicExpense).filter(
                            PeriodicExpense.name == periodic_expense_name
                        ).first()

                        if not periodic_expense:
                            periodic_expense = PeriodicExpense(name=periodic_expense_name)
                            db.add(periodic_expense)
                            db.flush()

                    # Create the expense
                    expense = Expense(
                        raw_expense_id=raw_expense.id,
                        bank_account_id=raw_expense.bank_account_id,
                        transaction_date=raw_expense.transaction_date,
                        amount=raw_expense.amount,
                        currency=raw_expense.currency,
                        merchant_alias_id=merchant_alias.id if merchant_alias else None,
                        category_id=category_id,
                        description=description,
                        periodic_expense_id=periodic_expense.id if periodic_expense else None
                    )

                    db.add(expense)
                    db.flush()

                    # Handle tags
                    for tag_name in tag_names:
                        tag = db.query(Tag).filter(Tag.name == tag_name).first()
                        if not tag:
                            tag = Tag(name=tag_name)
                            db.add(tag)
                            db.flush()

                        expense_tag = ExpenseTag(expense_id=expense.id, tag_id=tag.id)
                        db.add(expense_tag)

                    saved_count += 1

                processed_count += 1
                break  # Stop checking other rules for this expense

    db.commit()
    return {
        "message": f"Applied {len(active_rules)} active rules",
        "processed": processed_count,
        "discarded": discarded_count,
        "saved": saved_count
    }

def _matches_rule(raw_expense: RawExpense, rule: Rule) -> bool:
    """Check if a raw expense matches a rule"""
    # Get the field value from the raw expense
    field_value = getattr(raw_expense, rule.field, None)
    if field_value is None:
        return False

    # Convert to string for matching
    field_value_str = str(field_value)

    if rule.match_type == "exact":
        return field_value_str == rule.match_value
    elif rule.match_type == "regex":
        try:
            return bool(re.search(rule.match_value, field_value_str, re.IGNORECASE))
        except re.error:
            return False

    return False


@router.post("/group")
async def create_expense_group(data: dict, db: Session = Depends(get_db)):
    """Create a grouped expense from multiple raw expenses.
    
    Creates a parent expense with the sum of amounts and earliest date,
    and links all child expenses to it.
    """
    raw_expense_ids = data.get("raw_expense_ids", [])
    parent_data = data.get("parent", {})
    children_data = data.get("children", [])
    
    if len(raw_expense_ids) < 2:
        raise HTTPException(status_code=400, detail="At least 2 expenses are required for grouping")
    
    # Validate all raw expenses exist and are not processed
    raw_expenses = []
    for raw_id in raw_expense_ids:
        raw_expense = db.query(RawExpense).filter(RawExpense.id == raw_id).first()
        if not raw_expense:
            raise HTTPException(status_code=404, detail=f"Raw expense {raw_id} not found")
        
        existing = db.query(Expense).filter(Expense.raw_expense_id == raw_id).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Raw expense {raw_id} already processed")
        
        raw_expenses.append(raw_expense)
    
    # Get parent expense data
    merchant_name = parent_data.get("merchant_name")
    category_id = parent_data.get("category_id")
    description = parent_data.get("description", "")
    tag_names = parent_data.get("tags", [])
    periodic_expense_name = parent_data.get("periodic_expense_name")
    
    # Calculate parent amount (sum) and date (earliest)
    total_amount = sum(float(raw.amount) for raw in raw_expenses)
    earliest_date = min(raw.transaction_date for raw in raw_expenses)
    
    # Handle merchant alias for parent
    merchant_alias = None
    if merchant_name:
        merchant_alias = db.query(MerchantAlias).filter(
            MerchantAlias.display_name == merchant_name
        ).first()
        
        if not merchant_alias:
            merchant_alias = MerchantAlias(
                raw_name=merchant_name,
                display_name=merchant_name,
                default_category_id=category_id
            )
            db.add(merchant_alias)
            db.flush()
    
    # Handle periodic expense
    periodic_expense = None
    if periodic_expense_name:
        periodic_expense = db.query(PeriodicExpense).filter(
            PeriodicExpense.name == periodic_expense_name
        ).first()
        
        if not periodic_expense:
            periodic_expense = PeriodicExpense(name=periodic_expense_name)
            db.add(periodic_expense)
            db.flush()
    
    # Create parent expense (no raw_expense_id since it's synthetic)
    parent_expense = Expense(
        raw_expense_id=None,
        bank_account_id=raw_expenses[0].bank_account_id,
        transaction_date=earliest_date,
        amount=total_amount,
        currency=raw_expenses[0].currency,
        merchant_alias_id=merchant_alias.id if merchant_alias else None,
        category_id=category_id,
        description=description,
        periodic_expense_id=periodic_expense.id if periodic_expense else None
    )
    
    db.add(parent_expense)
    db.flush()
    
    # Handle tags for parent
    for tag_name in tag_names:
        tag = db.query(Tag).filter(Tag.name == tag_name).first()
        if not tag:
            tag = Tag(name=tag_name)
            db.add(tag)
            db.flush()
        
        expense_tag = ExpenseTag(expense_id=parent_expense.id, tag_id=tag.id)
        db.add(expense_tag)
    
    # Create child expenses
    children_by_raw_id = {c.get("raw_expense_id"): c for c in children_data}
    child_expenses = []
    
    for raw_expense in raw_expenses:
        child_data = children_by_raw_id.get(raw_expense.id, {})
        
        # Child merchant - use individual if provided, else use parent's
        child_merchant_name = child_data.get("merchant_name") or merchant_name
        child_merchant_alias = None
        if child_merchant_name:
            child_merchant_alias = db.query(MerchantAlias).filter(
                MerchantAlias.display_name == child_merchant_name
            ).first()
            
            if not child_merchant_alias:
                child_merchant_alias = MerchantAlias(
                    raw_name=raw_expense.raw_merchant_name or child_merchant_name,
                    display_name=child_merchant_name,
                    default_category_id=child_data.get("category_id") or category_id
                )
                db.add(child_merchant_alias)
                db.flush()
        
        child_expense = Expense(
            raw_expense_id=raw_expense.id,
            bank_account_id=raw_expense.bank_account_id,
            transaction_date=raw_expense.transaction_date,
            amount=raw_expense.amount,
            currency=raw_expense.currency,
            merchant_alias_id=child_merchant_alias.id if child_merchant_alias else None,
            category_id=child_data.get("category_id") or category_id,
            description=child_data.get("description") or "",
            parent_expense_id=parent_expense.id
        )
        
        db.add(child_expense)
        db.flush()
        
        # Handle tags for child
        child_tag_names = child_data.get("tags", [])
        for tag_name in child_tag_names:
            tag = db.query(Tag).filter(Tag.name == tag_name).first()
            if not tag:
                tag = Tag(name=tag_name)
                db.add(tag)
                db.flush()
            
            expense_tag = ExpenseTag(expense_id=child_expense.id, tag_id=tag.id)
            db.add(expense_tag)
        
        child_expenses.append(child_expense)
    
    db.commit()
    
    return {
        "message": "Expense group created successfully",
        "parent_expense_id": parent_expense.id,
        "child_expense_ids": [c.id for c in child_expenses]
    }