from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..database import Base

class MerchantAlias(Base):
    __tablename__ = "merchant_aliases"
    
    id = Column(Integer, primary_key=True, index=True)
    raw_name = Column(String, unique=True, index=True, nullable=False)  # e.g., "AMZN*1234XYZ"
    display_name = Column(String, nullable=False)  # e.g., "Amazon"
    default_category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)  # auto-suggest category
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationship
    # When default category is deleted, merchant keeps existing but loses auto-suggest
    default_category = relationship("Category")