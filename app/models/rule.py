from sqlalchemy import Column, Integer, String, Boolean, Text, JSON
from sqlalchemy.sql import func
from ..database import Base

class Rule(Base):
    __tablename__ = "rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    active = Column(Boolean, default=True)
    field = Column(String, nullable=False)  # raw_expense field to match on
    match_type = Column(String, nullable=False)  # 'exact' or 'regex'
    match_value = Column(String, nullable=False)
    action = Column(String, nullable=False)  # 'discard' or 'save'
    save_data = Column(JSON)  # JSON with merchant_name, category_id, description, tags for save action
    created_at = Column(Text, server_default=func.now())
    updated_at = Column(Text, server_default=func.now(), onupdate=func.now())