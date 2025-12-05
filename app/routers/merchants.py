from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from fuzzywuzzy import fuzz
from ..database import get_db
from ..models.merchant import MerchantAlias

router = APIRouter()

@router.get("/")
async def get_merchants(db: Session = Depends(get_db)):
    """Get all merchant aliases"""
    merchants = db.query(MerchantAlias).order_by(MerchantAlias.display_name).all()
    return merchants

@router.post("/")
async def create_merchant(data: dict, db: Session = Depends(get_db)):
    """Create a new merchant alias"""
    merchant = MerchantAlias(
        raw_name=data["raw_name"],
        display_name=data["display_name"],
        default_category_id=data.get("default_category_id")
    )
    db.add(merchant)
    db.commit()
    db.refresh(merchant)
    return merchant

@router.get("/suggest")
async def suggest_merchant(raw_name: str = Query(...), db: Session = Depends(get_db)):
    """Suggest a merchant alias for a raw merchant name using fuzzy matching"""
    merchants = db.query(MerchantAlias).all()
    
    best_match = None
    best_score = 0
    
    for merchant in merchants:
        # Try matching against both raw_name and display_name
        raw_score = fuzz.ratio(raw_name.lower(), merchant.raw_name.lower())
        display_score = fuzz.ratio(raw_name.lower(), merchant.display_name.lower())
        score = max(raw_score, display_score)
        
        if score > best_score and score > 70:  # threshold for fuzzy match
            best_score = score
            best_match = merchant
    
    return {
        "suggestion": best_match.display_name if best_match else None,
        "merchant": best_match,
        "confidence": best_score
    }