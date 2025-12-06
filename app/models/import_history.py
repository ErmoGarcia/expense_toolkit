from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..database import Base


class ImportHistory(Base):
    __tablename__ = "import_history"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)  # original filename
    stored_filename = Column(String)  # unique filename on disk
    bank_account_id = Column(Integer, ForeignKey("bank_accounts.id"))
    file_size = Column(Integer)  # file size in bytes
    status = Column(String, default="pending")  # pending, processing, completed, failed
    records_imported = Column(Integer)
    records_skipped = Column(Integer)  # duplicates
    error_message = Column(String)  # error details if failed
    imported_at = Column(DateTime(timezone=True), server_default=func.now())
    processed_at = Column(DateTime(timezone=True))  # when parsing completed
    
    # Relationships
    bank_account = relationship("BankAccount")
