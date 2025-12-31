from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from fuzzywuzzy import fuzz
from ..database import get_db
from ..models.merchant import MerchantAlias
from ..schemas import MerchantCreate, MerchantResponse

router = APIRouter()

@router.get("/", response_model=List[MerchantResponse])
async def get_merchants(q: Optional[str] = Query(None, max_length=255), db: Session = Depends(get_db)):
    """Get all merchant aliases, optionally filtered by query"""
    query = db.query(MerchantAlias)
    if q:
        # Escape SQL wildcards in search string
        escaped_q = q.replace("%", r"\%").replace("_", r"\_")
        query = query.filter(MerchantAlias.display_name.ilike(f"%{escaped_q}%"))
    merchants = query.order_by(MerchantAlias.display_name).all()
    return merchants

@router.post("/", response_model=MerchantResponse)
async def create_merchant(data: MerchantCreate, db: Session = Depends(get_db)):
    """Create a new merchant alias"""
    # Check for duplicate raw_name
    existing = db.query(MerchantAlias).filter(MerchantAlias.raw_name == data.raw_name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Merchant with this raw name already exists")
    
    merchant = MerchantAlias(
        raw_name=data.raw_name,
        display_name=data.display_name,
        default_category_id=data.default_category_id
    )
    db.add(merchant)
    db.commit()
    db.refresh(merchant)
    return merchant

@router.get("/suggest")
async def suggest_merchant(raw_name: str = Query(..., min_length=1, max_length=255), db: Session = Depends(get_db)):
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
