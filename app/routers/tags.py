from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.tag import Tag

router = APIRouter()

@router.get("/")
async def get_tags(db: Session = Depends(get_db)):
    """Get all tags"""
    tags = db.query(Tag).order_by(Tag.name).all()
    return tags

@router.post("/")
async def create_tag(data: dict, db: Session = Depends(get_db)):
    """Create a new tag"""
    tag = Tag(name=data["name"], color=data.get("color"))
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