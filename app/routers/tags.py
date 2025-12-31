from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..models.tag import Tag
from ..schemas import TagCreate, TagResponse

router = APIRouter()

@router.get("/", response_model=List[TagResponse])
async def get_tags(q: Optional[str] = Query(None, max_length=50), db: Session = Depends(get_db)):
    """Get all tags, optionally filtered by query"""
    query = db.query(Tag)
    if q:
        # Escape SQL wildcards in search string
        escaped_q = q.replace("%", r"\%").replace("_", r"\_")
        query = query.filter(Tag.name.ilike(f"%{escaped_q}%"))
    tags = query.order_by(Tag.name).all()
    return tags

@router.post("/", response_model=TagResponse)
async def create_tag(data: TagCreate, db: Session = Depends(get_db)):
    """Create a new tag"""
    # Check for duplicate name
    existing = db.query(Tag).filter(Tag.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Tag with this name already exists")
    
    tag = Tag(name=data.name, color=data.color)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag

@router.delete("/{tag_id}")
async def delete_tag(tag_id: int, db: Session = Depends(get_db)):
    """Delete a tag"""
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    
    db.delete(tag)
    db.commit()
    return {"message": "Tag deleted successfully"}
