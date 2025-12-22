from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Numeric, Date, Boolean, Float, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..database import Base

class RawExpense(Base):
    __tablename__ = "raw_expenses"
    
    id = Column(Integer, primary_key=True, index=True)
    bank_account_id = Column(Integer, ForeignKey("bank_accounts.id"))
    external_id = Column(String)  # transaction ID from bank/import
    transaction_date = Column(Date, nullable=False, index=True)
    amount = Column(Numeric(10, 2), nullable=False)  # negative = expense, positive = income
    currency = Column(String, default="GBP")
    raw_merchant_name = Column(String)  # original merchant name
    raw_description = Column(String)  # original description from bank
    source = Column(String, nullable=False)  # 'xlsx_import' or 'open_banking'
    source_file = Column(String)  # filename if xlsx import
    type = Column(String, nullable=True)  # 'fixed', 'necessary variable', or 'discretionary'
    imported_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    bank_account = relationship("BankAccount")
    
    # Unique constraint
    __table_args__ = (
        UniqueConstraint('bank_account_id', 'external_id', name='uix_bank_external'),
    )

class Expense(Base):
    __tablename__ = "expenses"
    
    id = Column(Integer, primary_key=True, index=True)
    raw_expense_id = Column(Integer, ForeignKey("raw_expenses.id"), unique=True)  # link to original raw expense
    bank_account_id = Column(Integer, ForeignKey("bank_accounts.id"))
    transaction_date = Column(Date, nullable=False, index=True)
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String, default="GBP")
    merchant_alias_id = Column(Integer, ForeignKey("merchant_aliases.id"))  # resolved merchant
    category_id = Column(Integer, ForeignKey("categories.id"))
    description = Column(String)  # user-added description
    notes = Column(String)  # optional longer notes
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    parent_expense_id = Column(Integer, ForeignKey("expenses.id"), nullable=True)  # Legacy field, not used for merge functionality
    is_recurring = Column(Boolean, default=False)
    archived = Column(Boolean, default=False)  # Mark old expenses not manually processed
    type = Column(String, nullable=True)  # 'fixed', 'necessary variable', or 'discretionary'
    processed_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    raw_expense = relationship("RawExpense")
    bank_account = relationship("BankAccount")
    merchant_alias = relationship("MerchantAlias")
    category = relationship("Category")
    tags = relationship("Tag", secondary="expense_tags")
    # Self-referential relationship (legacy, not used for merge functionality)
    parent_expense = relationship("Expense", remote_side=[id], foreign_keys=[parent_expense_id], backref="child_expenses")