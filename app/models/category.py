from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from ..database import Base

class Category(Base):
    __tablename__ = "categories"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    color = Column(String)  # hex color for UI
    icon = Column(String)   # optional icon identifier
    category_type = Column(String, default="expense")  # 'expense' or 'income'
    created_at = Column(DateTime(timezone=True), server_default=func.now())