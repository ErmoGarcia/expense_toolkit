from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.rule import Rule

router = APIRouter()

@router.get("/")
async def get_all_rules(db: Session = Depends(get_db)):
    """Get all rules"""
    rules = db.query(Rule).order_by(Rule.created_at.desc()).all()
    return rules

@router.post("/")
async def create_rule(rule_data: dict, db: Session = Depends(get_db)):
    """Create a new rule"""
    required_fields = ["name", "field", "match_type", "match_value", "action"]
    for field in required_fields:
        if field not in rule_data:
            raise HTTPException(status_code=400, detail=f"Missing required field: {field}")

    if rule_data["action"] == "save":
        if "save_data" not in rule_data:
            raise HTTPException(status_code=400, detail="save_data required for save action")
        save_data = rule_data["save_data"]
        required_save_fields = ["merchant_name", "category_id"]
        for field in required_save_fields:
            if field not in save_data:
                raise HTTPException(status_code=400, detail=f"Missing required save_data field: {field}")

    rule = Rule(
        name=rule_data["name"],
        active=rule_data.get("active", True),
        field=rule_data["field"],
        match_type=rule_data["match_type"],
        match_value=rule_data["match_value"],
        action=rule_data["action"],
        save_data=rule_data.get("save_data")
    )

    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule

@router.put("/{rule_id}")
async def update_rule(rule_id: int, rule_data: dict, db: Session = Depends(get_db)):
    """Update a rule"""
    rule = db.query(Rule).filter(Rule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    # Validate save_data if action is save
    if rule_data.get("action") == "save" or (rule.action == "save" and "action" not in rule_data):
        save_data = rule_data.get("save_data", rule.save_data)
        if not save_data:
            raise HTTPException(status_code=400, detail="save_data required for save action")
        required_save_fields = ["merchant_name", "category_id"]
        for field in required_save_fields:
            if field not in save_data:
                raise HTTPException(status_code=400, detail=f"Missing required save_data field: {field}")

    # Update fields
    for field in ["name", "active", "field", "match_type", "match_value", "action", "save_data"]:
        if field in rule_data:
            setattr(rule, field, rule_data[field])

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