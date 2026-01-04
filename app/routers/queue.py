from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from decimal import Decimal
import re
from ..database import get_db
from ..models.expense import RawExpense, Expense
from ..models.merchant import MerchantAlias
from ..models.category import Category
from ..models.tag import Tag, ExpenseTag
from ..models.rule import Rule
from ..schemas import (
    ProcessExpenseRequest,
    ArchiveExpensesRequest,
    MergeExpensesRequest,
    QueueCountResponse,
    ProcessedExpenseResponse,
    ArchiveResponse,
    MergeResponse,
    ApplyRulesResponse,
    RawExpenseUpdate,
    BulkSaveRequest,
    BulkSaveResponse,
    CategoryTypeResponse
)

router = APIRouter()

# Maximum allowed limit for pagination
MAX_LIMIT = 500

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
    """Get all raw expenses to process (FIFO order) with auto-suggestions"""
    raw_expenses = db.query(RawExpense).filter(
        ~RawExpense.id.in_(
            db.query(Expense.raw_expense_id).filter(Expense.raw_expense_id.isnot(None))
        )
    ).order_by(RawExpense.imported_at.asc()).all()
    
    result = []
    for raw in raw_expenses:
        item = {
            "id": raw.id,
            "transaction_date": str(raw.transaction_date),
            "amount": float(raw.amount),
            "currency": raw.currency,
            "raw_merchant_name": raw.raw_merchant_name,
            "raw_description": raw.raw_description,
            "source": raw.source,
            # User-set values (from update mode)
            "category_id": raw.category_id,
            "merchant_alias_id": raw.merchant_alias_id,
            "type": raw.type,
            "tags": raw.tags or [],
            "description": raw.description,
            # Include set category info
            "category": None,
            # Include set merchant alias info
            "merchant_alias": None,
            # Suggestions
            "suggested_merchant_alias": None,
            "suggested_category_id": None,
            "suggested_type": "discretionary"
        }
        
        # Include set merchant alias info
        if raw.merchant_alias_id:
            merchant = db.query(MerchantAlias).filter(MerchantAlias.id == raw.merchant_alias_id).first()
            if merchant:
                item["merchant_alias"] = {
                    "id": merchant.id,
                    "display_name": merchant.display_name
                }
        
        # Include set category info
        if raw.category_id:
            category = db.query(Category).filter(Category.id == raw.category_id).first()
            if category:
                item["category"] = {
                    "id": category.id,
                    "name": category.name
                }
        
        # Auto-suggest merchant alias if not set
        if not raw.merchant_alias_id and raw.raw_merchant_name:
            merchant = db.query(MerchantAlias).filter(
                MerchantAlias.raw_name == raw.raw_merchant_name
            ).first()
            if merchant:
                item["suggested_merchant_alias"] = {
                    "id": merchant.id,
                    "display_name": merchant.display_name,
                    "default_category_id": merchant.default_category_id
                }
                # Auto-suggest category from merchant
                if merchant.default_category_id:
                    item["suggested_category_id"] = merchant.default_category_id
                    # Auto-suggest type from category history
                    type_expense = db.query(Expense).filter(
                        Expense.category_id == merchant.default_category_id,
                        Expense.type.isnot(None)
                    ).order_by(Expense.created_at.desc()).first()
                    if type_expense and type_expense.type:
                        item["suggested_type"] = type_expense.type
        
        result.append(item)
    
    return result

@router.get("/count", response_model=QueueCountResponse)
async def get_queue_count(db: Session = Depends(get_db)):
    """Get the number of unprocessed raw expenses"""
    count = db.query(RawExpense).filter(
        ~RawExpense.id.in_(
            db.query(Expense.raw_expense_id).filter(Expense.raw_expense_id.isnot(None))
        )
    ).count()
    
    return {"count": count}

@router.get("/suggestions/{raw_expense_id}")
async def get_suggestions(raw_expense_id: int, db: Session = Depends(get_db)):
    """Get suggestions for a raw expense based on merchant name.
    
    Returns:
    - merchant_alias: If a merchant with the same raw_name exists
    - category_id: If all expenses for that merchant have the same category
    - tags: If all expenses for that merchant have the same tags
    - type: If all expenses for that merchant have the same type
    - description: If all expenses for that merchant have the same description
    """
    # Get the raw expense
    raw_expense = db.query(RawExpense).filter(RawExpense.id == raw_expense_id).first()
    if not raw_expense:
        raise HTTPException(status_code=404, detail="Raw expense not found")
    
    suggestions = {
        "merchant_alias": None,
        "category_id": None,
        "tags": [],
        "type": None,
        "description": None
    }
    
    # Check if there's a merchant alias with this raw name
    if raw_expense.raw_merchant_name:
        merchant = db.query(MerchantAlias).filter(
            MerchantAlias.raw_name == raw_expense.raw_merchant_name
        ).first()
        
        if merchant:
            suggestions["merchant_alias"] = merchant.display_name
            
            # Find all saved expenses for this merchant
            expenses = db.query(Expense).filter(
                Expense.merchant_alias_id == merchant.id
            ).all()
            
            if expenses:
                # Check if all expenses have the same category
                category_ids = set(exp.category_id for exp in expenses if exp.category_id is not None)
                if len(category_ids) == 1:
                    suggestions["category_id"] = category_ids.pop()
                
                # Check if all expenses have the same type
                types = set(exp.type for exp in expenses if exp.type is not None)
                if len(types) == 1:
                    suggestions["type"] = types.pop()
                
                # Check if all expenses have the same description
                descriptions = set(exp.description for exp in expenses if exp.description is not None)
                if len(descriptions) == 1:
                    suggestions["description"] = descriptions.pop()
                
                # Check if all expenses have the same tags
                # Get tags for each expense
                expense_tag_sets = []
                for exp in expenses:
                    expense_tags = db.query(Tag).join(ExpenseTag).filter(
                        ExpenseTag.expense_id == exp.id
                    ).all()
                    tag_names = set(tag.name for tag in expense_tags)
                    expense_tag_sets.append(tag_names)
                
                # Only suggest tags if all expenses have the exact same set of tags
                if expense_tag_sets:
                    # Find the intersection of all tag sets
                    common_tags = expense_tag_sets[0]
                    for tag_set in expense_tag_sets[1:]:
                        common_tags = common_tags.intersection(tag_set)
                    
                    # Only suggest if all expenses have the same tags (intersection equals all sets)
                    if all(tag_set == common_tags for tag_set in expense_tag_sets):
                        suggestions["tags"] = sorted(list(common_tags))
    
    return suggestions

@router.post("/process", response_model=ProcessedExpenseResponse)
async def process_raw_expense(data: ProcessExpenseRequest, db: Session = Depends(get_db)):
    """Process a raw expense into a proper expense"""
    raw_expense_id = data.raw_expense_id
    merchant_name = data.merchant_name
    category_id = data.category_id
    description = data.description or ""
    tag_names = data.tags
    expense_type = data.type
    
    # Get raw expense
    raw_expense = db.query(RawExpense).filter(RawExpense.id == raw_expense_id).first()
    if not raw_expense:
        raise HTTPException(status_code=404, detail="Raw expense not found")
    
    # Check if already processed
    existing = db.query(Expense).filter(Expense.raw_expense_id == raw_expense_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Raw expense already processed")
    
    # Validate category exists if provided
    if category_id is not None:
        category = db.query(Category).filter(Category.id == category_id).first()
        if not category:
            raise HTTPException(status_code=400, detail="Category not found")
    
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
        description=description,
        type=expense_type
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

@router.post("/apply-rules", response_model=ApplyRulesResponse)
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
                    expense_type = save_data.get("type")

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
                        type=expense_type
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
            # Add timeout protection for regex (basic protection against ReDoS)
            # Note: For full protection, use the 'regex' library with timeout
            pattern = rule.match_value
            # Limit regex complexity by checking pattern length
            if len(pattern) > 500:
                return False
            return bool(re.search(pattern, field_value_str, re.IGNORECASE))
        except re.error:
            return False

    return False


@router.get("/find-duplicates")
async def find_duplicates(db: Session = Depends(get_db)):
    """Find duplicate raw expenses based on amount and date.
    
    Returns a map of raw_expense_id -> list of duplicate expenses (raw or saved).
    """
    # Get all unprocessed raw expenses
    raw_expenses = db.query(RawExpense).filter(
        ~RawExpense.id.in_(
            db.query(Expense.raw_expense_id).filter(Expense.raw_expense_id.isnot(None))
        )
    ).all()
    
    duplicates = {}
    
    for raw_expense in raw_expenses:
        # Find other raw expenses with same amount and date
        other_raw = db.query(RawExpense).filter(
            RawExpense.id != raw_expense.id,
            RawExpense.transaction_date == raw_expense.transaction_date,
            RawExpense.amount == raw_expense.amount
        ).all()
        
        # Find saved expenses with same amount and date
        saved = db.query(Expense).filter(
            Expense.transaction_date == raw_expense.transaction_date,
            Expense.amount == raw_expense.amount
        ).all()
        
        if other_raw or saved:
            duplicates[raw_expense.id] = {
                "raw_expense": {
                    "id": raw_expense.id,
                    "transaction_date": str(raw_expense.transaction_date),
                    "amount": float(raw_expense.amount),
                    "raw_merchant_name": raw_expense.raw_merchant_name,
                    "raw_description": raw_expense.raw_description,
                    "source": raw_expense.source,
                    "bank_account_id": raw_expense.bank_account_id
                },
                "duplicates": []
            }
            
            # Add other raw expenses
            for dup in other_raw:
                duplicates[raw_expense.id]["duplicates"].append({
                    "type": "raw",
                    "id": dup.id,
                    "transaction_date": str(dup.transaction_date),
                    "amount": float(dup.amount),
                    "raw_merchant_name": dup.raw_merchant_name,
                    "raw_description": dup.raw_description,
                    "source": dup.source,
                    "bank_account_id": dup.bank_account_id
                })
            
            # Add saved expenses
            for exp in saved:
                duplicates[raw_expense.id]["duplicates"].append({
                    "type": "saved",
                    "id": exp.id,
                    "transaction_date": str(exp.transaction_date),
                    "amount": float(exp.amount),
                    "merchant_alias": exp.merchant_alias.display_name if exp.merchant_alias else None,
                    "category": exp.category.name if exp.category else None,
                    "description": exp.description,
                    "archived": exp.archived
                })
    
    return duplicates


@router.post("/archive", response_model=ArchiveResponse)
async def archive_raw_expenses(data: ArchiveExpensesRequest, db: Session = Depends(get_db)):
    """Archive multiple raw expenses by creating expense records with archived=True"""
    raw_expense_ids = data.raw_expense_ids
    
    archived_count = 0
    
    for raw_id in raw_expense_ids:
        # Get raw expense
        raw_expense = db.query(RawExpense).filter(RawExpense.id == raw_id).first()
        if not raw_expense:
            continue
        
        # Check if already processed
        existing = db.query(Expense).filter(Expense.raw_expense_id == raw_id).first()
        if existing:
            continue
        
        # Create archived expense with minimal data
        expense = Expense(
            raw_expense_id=raw_id,
            bank_account_id=raw_expense.bank_account_id,
            transaction_date=raw_expense.transaction_date,
            amount=raw_expense.amount,
            currency=raw_expense.currency,
            archived=True
        )
        
        db.add(expense)
        archived_count += 1
    
    db.commit()
    
    return {"message": f"Archived {archived_count} expense(s)", "archived_count": archived_count}


@router.post("/merge", response_model=MergeResponse)
async def merge_expenses(data: MergeExpensesRequest, db: Session = Depends(get_db)):
    """Merge multiple raw expenses into a single expense.
    
    Creates a single expense with the sum of amounts and earliest date,
    then archives the original raw expenses.
    """
    raw_expense_ids = data.raw_expense_ids
    expense_data = data.expense_data
    
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
    
    # Get expense data
    merchant_name = expense_data.merchant_name
    category_id = expense_data.category_id
    description = expense_data.description or ""
    tag_names = expense_data.tags
    expense_type = expense_data.type
    
    # Validate category exists if provided
    if category_id is not None:
        category = db.query(Category).filter(Category.id == category_id).first()
        if not category:
            raise HTTPException(status_code=400, detail="Category not found")
    
    # Calculate merged amount (sum) and date (earliest)
    total_amount = sum(float(raw.amount) for raw in raw_expenses)
    earliest_date = min(raw.transaction_date for raw in raw_expenses)
    
    # Handle merchant alias
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
    
    # Create merged expense (no raw_expense_id since it represents multiple raw expenses)
    merged_expense = Expense(
        raw_expense_id=None,
        bank_account_id=raw_expenses[0].bank_account_id,
        transaction_date=earliest_date,
        amount=total_amount,
        currency=raw_expenses[0].currency,
        merchant_alias_id=merchant_alias.id if merchant_alias else None,
        category_id=category_id,
        description=description,
        type=expense_type
    )
    
    db.add(merged_expense)
    db.flush()
    
    # Handle tags
    for tag_name in tag_names:
        tag = db.query(Tag).filter(Tag.name == tag_name).first()
        if not tag:
            tag = Tag(name=tag_name)
            db.add(tag)
            db.flush()
        
        expense_tag = ExpenseTag(expense_id=merged_expense.id, tag_id=tag.id)
        db.add(expense_tag)
    
    # Archive the original raw expenses by creating archived expense records
    for raw_expense in raw_expenses:
        archived_expense = Expense(
            raw_expense_id=raw_expense.id,
            bank_account_id=raw_expense.bank_account_id,
            transaction_date=raw_expense.transaction_date,
            amount=raw_expense.amount,
            currency=raw_expense.currency,
            archived=True
        )
        db.add(archived_expense)
    
    db.commit()
    
    return {
        "message": f"Successfully merged {len(raw_expenses)} expenses",
        "expense_id": merged_expense.id,
        "archived_raw_expense_ids": raw_expense_ids
    }


@router.put("/{raw_expense_id}")
async def update_raw_expense(
    raw_expense_id: int,
    data: RawExpenseUpdate,
    db: Session = Depends(get_db)
):
    """Update a raw expense's editable fields (for update mode)"""
    raw_expense = db.query(RawExpense).filter(RawExpense.id == raw_expense_id).first()
    if not raw_expense:
        raise HTTPException(status_code=404, detail="Raw expense not found")
    
    # Check if already processed
    existing = db.query(Expense).filter(Expense.raw_expense_id == raw_expense_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Raw expense already processed")
    
    # Update fields if provided
    if data.category_id is not None:
        # Validate category exists
        category = db.query(Category).filter(Category.id == data.category_id).first()
        if not category:
            raise HTTPException(status_code=400, detail="Category not found")
        raw_expense.category_id = data.category_id
    
    if data.merchant_alias_id is not None:
        # Validate merchant exists
        merchant = db.query(MerchantAlias).filter(MerchantAlias.id == data.merchant_alias_id).first()
        if not merchant:
            raise HTTPException(status_code=400, detail="Merchant not found")
        raw_expense.merchant_alias_id = data.merchant_alias_id
    
    if data.type is not None:
        raw_expense.type = data.type
    
    if data.tags is not None:
        raw_expense.tags = data.tags
    
    if data.description is not None:
        raw_expense.description = data.description
    
    db.commit()
    db.refresh(raw_expense)
    
    return {"message": "Raw expense updated successfully", "id": raw_expense.id}


@router.get("/category-type/{category_id}", response_model=CategoryTypeResponse)
async def get_category_type(category_id: int, db: Session = Depends(get_db)):
    """Get the last used expense type for a category"""
    # Find most recent expense with this category
    expense = db.query(Expense).filter(
        Expense.category_id == category_id,
        Expense.type.isnot(None)
    ).order_by(Expense.created_at.desc()).first()
    
    if expense and expense.type:
        return {"type": expense.type}
    
    return {"type": "discretionary"}  # Default


@router.post("/bulk-save", response_model=BulkSaveResponse)
async def bulk_save_raw_expenses(data: BulkSaveRequest, db: Session = Depends(get_db)):
    """Bulk save raw expenses using their stored category, merchant, type, tags"""
    saved_count = 0
    failed_count = 0
    errors = []
    
    for raw_id in data.raw_expense_ids:
        raw_expense = db.query(RawExpense).filter(RawExpense.id == raw_id).first()
        if not raw_expense:
            errors.append(f"Raw expense {raw_id} not found")
            failed_count += 1
            continue
        
        # Check already processed
        existing = db.query(Expense).filter(Expense.raw_expense_id == raw_id).first()
        if existing:
            errors.append(f"Raw expense {raw_id} already processed")
            failed_count += 1
            continue
        
        # Check required fields - use stored or fall back to suggestions
        category_id = raw_expense.category_id
        merchant_alias_id = raw_expense.merchant_alias_id
        
        # If merchant not set, try to get from suggestion (via raw_merchant_name)
        if not merchant_alias_id and raw_expense.raw_merchant_name:
            merchant = db.query(MerchantAlias).filter(
                MerchantAlias.raw_name == raw_expense.raw_merchant_name
            ).first()
            if merchant:
                merchant_alias_id = merchant.id
                # Also get category from merchant if not set
                if not category_id and merchant.default_category_id:
                    category_id = merchant.default_category_id
        
        # Validate required fields
        if not category_id:
            errors.append(f"Raw expense {raw_id} missing category")
            failed_count += 1
            continue
        
        if not merchant_alias_id:
            errors.append(f"Raw expense {raw_id} missing merchant")
            failed_count += 1
            continue
        
        # Get type - use stored, or get from category history, or default
        expense_type = raw_expense.type
        if not expense_type:
            type_expense = db.query(Expense).filter(
                Expense.category_id == category_id,
                Expense.type.isnot(None)
            ).order_by(Expense.created_at.desc()).first()
            expense_type = type_expense.type if type_expense and type_expense.type else "discretionary"
        
        # Create expense
        expense = Expense(
            raw_expense_id=raw_id,
            bank_account_id=raw_expense.bank_account_id,
            transaction_date=raw_expense.transaction_date,
            amount=raw_expense.amount,
            currency=raw_expense.currency,
            merchant_alias_id=merchant_alias_id,
            category_id=category_id,
            description=raw_expense.description or raw_expense.raw_description or "",
            type=expense_type
        )
        db.add(expense)
        db.flush()
        
        # Handle tags
        for tag_name in (raw_expense.tags or []):
            tag = db.query(Tag).filter(Tag.name == tag_name).first()
            if not tag:
                tag = Tag(name=tag_name)
                db.add(tag)
                db.flush()
            expense_tag = ExpenseTag(expense_id=expense.id, tag_id=tag.id)
            db.add(expense_tag)
        
        saved_count += 1
    
    db.commit()
    
    return {
        "message": "Bulk save completed",
        "saved_count": saved_count,
        "failed_count": failed_count,
        "errors": errors
    }
