from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..database import Base

class ImportHistory(Base):
    __tablename__ = "import_history"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    bank_account_id = Column(Integer, ForeignKey("bank_accounts.id"))
    records_imported = Column(Integer)
    records_skipped = Column(Integer)  # duplicates
    imported_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    bank_account = relationship("BankAccount")