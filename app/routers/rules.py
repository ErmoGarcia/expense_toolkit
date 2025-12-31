from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models.rule import Rule
from ..schemas import RuleCreate, RuleUpdate, RuleResponse

router = APIRouter()

@router.get("/", response_model=List[RuleResponse])
async def get_all_rules(db: Session = Depends(get_db)):
    """Get all rules"""
    rules = db.query(Rule).order_by(Rule.created_at.desc()).all()
    return rules

@router.post("/", response_model=RuleResponse)
async def create_rule(rule_data: RuleCreate, db: Session = Depends(get_db)):
    """Create a new rule"""
    # Validate save_data is provided for save action
    if rule_data.action == "save" and not rule_data.save_data:
        raise HTTPException(status_code=400, detail="save_data is required for save action")

    rule = Rule(
        name=rule_data.name,
        active=rule_data.active,
        field=rule_data.field,
        match_type=rule_data.match_type,
        match_value=rule_data.match_value,
        action=rule_data.action,
        save_data=rule_data.save_data.model_dump() if rule_data.save_data else None
    )

    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule

@router.put("/{rule_id}", response_model=RuleResponse)
async def update_rule(rule_id: int, rule_data: RuleUpdate, db: Session = Depends(get_db)):
    """Update a rule"""
    rule = db.query(Rule).filter(Rule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    # Determine the final action value
    final_action = rule_data.action if rule_data.action is not None else rule.action
    final_save_data = rule_data.save_data if rule_data.save_data is not None else rule.save_data

    # Validate save_data if action is save
    if final_action == "save":
        if not final_save_data:
            raise HTTPException(status_code=400, detail="save_data is required for save action")
        # Validate required fields in save_data
        if isinstance(final_save_data, dict):
            if "merchant_name" not in final_save_data or "category_id" not in final_save_data:
                raise HTTPException(status_code=400, detail="save_data must include merchant_name and category_id")

    # Update only provided fields
    update_data = rule_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "save_data" and value is not None:
            # Convert Pydantic model to dict
            setattr(rule, field, value.model_dump() if hasattr(value, 'model_dump') else value)
        else:
            setattr(rule, field, value)

    db.commit()
    db.refresh(rule)
    return rule

@router.delete("/{rule_id}")
async def delete_rule(rule_id: int, db: Session = Depends(get_db)):
    """Delete a rule"""
    rule = db.query(Rule).filter(Rule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    db.delete(rule)
    db.commit()
    return {"message": "Rule deleted"}
