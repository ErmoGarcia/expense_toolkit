from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..database import Base


class RawNotification(Base):
    """Stores raw notification payloads from Android app before parsing"""
    __tablename__ = "raw_notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    app_package = Column(String)  # e.g., "com.barclays.app"
    app_name = Column(String)  # e.g., "Barclays"
    title = Column(String)  # notification title
    text = Column(Text)  # notification body text
    notification_timestamp = Column(DateTime(timezone=True))  # when notification was received on phone
    raw_payload = Column(Text)  # full JSON payload for debugging/reprocessing
    source_file = Column(String)  # JSON file where this was saved
    
    # Processing status
    is_processed = Column(Boolean, default=False, index=True)
    is_expense = Column(Boolean)  # null = not determined, True = expense, False = not an expense
    raw_expense_id = Column(Integer, ForeignKey("raw_expenses.id", ondelete="SET NULL"), nullable=True)  # link to created RawExpense if parsed successfully
    parse_error = Column(String)  # error message if parsing failed
    
    received_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    raw_expense = relationship("RawExpense")
