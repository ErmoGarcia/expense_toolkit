from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from ..database import Base

class BankAccount(Base):
    __tablename__ = "bank_accounts"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)  # e.g., "Main Checking"
    bank_name = Column(String)  # e.g., "Barclays"
    account_type = Column(String)  # checking, savings, credit
    gocardless_requisition_id = Column(String)  # for Open Banking link
    last_synced_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())