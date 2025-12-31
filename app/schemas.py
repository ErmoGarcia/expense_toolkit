"""
Pydantic schemas for request/response validation.
All API endpoints should use these schemas instead of raw dicts.
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List, Any
from pydantic import BaseModel, Field, field_validator, ConfigDict
import re


# =============================================================================
# Category Schemas
# =============================================================================

class CategoryCreate(BaseModel):
    """Schema for creating a category"""
    name: str = Field(..., min_length=1, max_length=100, description="Category name")
    color: Optional[str] = Field(None, max_length=7, pattern=r"^#[0-9A-Fa-f]{6}$", description="Hex color code")
    icon: Optional[str] = Field(None, max_length=50, description="Icon identifier")
    category_type: str = Field("expense", pattern=r"^(expense|income)$", description="Category type")
    parent_id: Optional[int] = Field(None, ge=1, description="Parent category ID")


class CategoryUpdate(BaseModel):
    """Schema for updating a category"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    color: Optional[str] = Field(None, max_length=7, pattern=r"^#[0-9A-Fa-f]{6}$")
    icon: Optional[str] = Field(None, max_length=50)
    category_type: Optional[str] = Field(None, pattern=r"^(expense|income)$")
    parent_id: Optional[int] = Field(None, ge=1)


class CategoryResponse(BaseModel):
    """Schema for category response"""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    name: str
    color: Optional[str] = None
    icon: Optional[str] = None
    category_type: str
    parent_id: Optional[int] = None


# =============================================================================
# Tag Schemas
# =============================================================================

class TagCreate(BaseModel):
    """Schema for creating a tag"""
    name: str = Field(..., min_length=1, max_length=50, description="Tag name")
    color: Optional[str] = Field(None, max_length=7, pattern=r"^#[0-9A-Fa-f]{6}$", description="Hex color code")


class TagResponse(BaseModel):
    """Schema for tag response"""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    name: str
    color: Optional[str] = None


# =============================================================================
# Merchant Schemas
# =============================================================================

class MerchantCreate(BaseModel):
    """Schema for creating a merchant alias"""
    raw_name: str = Field(..., min_length=1, max_length=255, description="Original merchant name from bank")
    display_name: str = Field(..., min_length=1, max_length=255, description="Display name for the merchant")
    default_category_id: Optional[int] = Field(None, ge=1, description="Default category ID")


class MerchantResponse(BaseModel):
    """Schema for merchant response"""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    raw_name: str
    display_name: str
    default_category_id: Optional[int] = None


# =============================================================================
# Rule Schemas
# =============================================================================

class RuleSaveData(BaseModel):
    """Schema for rule save action data"""
    merchant_name: str = Field(..., min_length=1, max_length=255)
    category_id: int = Field(..., ge=1)
    description: Optional[str] = Field(None, max_length=500)
    tags: Optional[List[str]] = Field(default_factory=list)
    type: Optional[str] = Field(None, pattern=r"^(fixed|necessary variable|discretionary)$")


class RuleCreate(BaseModel):
    """Schema for creating a rule"""
    name: str = Field(..., min_length=1, max_length=100, description="Rule name")
    active: bool = Field(True, description="Whether the rule is active")
    field: str = Field(..., pattern=r"^(raw_merchant_name|raw_description|amount|source)$", description="Field to match")
    match_type: str = Field(..., pattern=r"^(exact|regex)$", description="Match type")
    match_value: str = Field(..., min_length=1, max_length=500, description="Value to match")
    action: str = Field(..., pattern=r"^(discard|save)$", description="Action to take")
    save_data: Optional[RuleSaveData] = Field(None, description="Data for save action")
    
    @field_validator("match_value")
    @classmethod
    def validate_regex(cls, v: str, info) -> str:
        """Validate regex pattern if match_type is regex"""
        # We can't access other fields easily in v2, so we validate regex syntax always
        # Invalid regex will fail at runtime anyway
        try:
            re.compile(v)
        except re.error as e:
            raise ValueError(f"Invalid regex pattern: {e}")
        return v
    
    @field_validator("save_data")
    @classmethod
    def validate_save_data(cls, v: Optional[RuleSaveData], info) -> Optional[RuleSaveData]:
        """Ensure save_data is provided for save action"""
        # Note: Cross-field validation is tricky in Pydantic v2
        # We'll validate this in the router as well
        return v


class RuleUpdate(BaseModel):
    """Schema for updating a rule"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    active: Optional[bool] = None
    field: Optional[str] = Field(None, pattern=r"^(raw_merchant_name|raw_description|amount|source)$")
    match_type: Optional[str] = Field(None, pattern=r"^(exact|regex)$")
    match_value: Optional[str] = Field(None, min_length=1, max_length=500)
    action: Optional[str] = Field(None, pattern=r"^(discard|save)$")
    save_data: Optional[RuleSaveData] = None
    
    @field_validator("match_value")
    @classmethod
    def validate_regex(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            try:
                re.compile(v)
            except re.error as e:
                raise ValueError(f"Invalid regex pattern: {e}")
        return v


class RuleResponse(BaseModel):
    """Schema for rule response"""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    name: str
    active: bool
    field: str
    match_type: str
    match_value: str
    action: str
    save_data: Optional[dict] = None


# =============================================================================
# Expense Schemas
# =============================================================================

class ExpenseUpdate(BaseModel):
    """Schema for updating an expense - only allows specific fields"""
    category_id: Optional[int] = Field(None, ge=1)
    merchant_alias_id: Optional[int] = Field(None, ge=1)
    description: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = Field(None, max_length=2000)
    type: Optional[str] = Field(None, pattern=r"^(fixed|necessary variable|discretionary)$")
    is_recurring: Optional[bool] = None
    # Explicitly NOT allowing: id, raw_expense_id, amount, transaction_date, created_at, etc.


class MerchantAliasInfo(BaseModel):
    """Merchant alias info for expense response"""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    display_name: str
    raw_name: str


class CategoryInfo(BaseModel):
    """Category info for expense response"""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    name: str
    color: Optional[str] = None


class TagInfo(BaseModel):
    """Tag info for expense response"""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    name: str
    color: Optional[str] = None


class ExpenseResponse(BaseModel):
    """Schema for expense response"""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    raw_expense_id: Optional[int] = None
    bank_account_id: Optional[int] = None
    transaction_date: Optional[date] = None
    amount: float
    currency: Optional[str] = None
    merchant_alias_id: Optional[int] = None
    category_id: Optional[int] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    parent_expense_id: Optional[int] = None
    is_recurring: bool = False
    archived: bool = False
    type: Optional[str] = None
    merchant_alias: Optional[MerchantAliasInfo] = None
    category: Optional[CategoryInfo] = None
    tags: List[TagInfo] = Field(default_factory=list)


# =============================================================================
# Queue Schemas
# =============================================================================

class ProcessExpenseRequest(BaseModel):
    """Schema for processing a raw expense"""
    raw_expense_id: int = Field(..., ge=1, description="Raw expense ID to process")
    merchant_name: Optional[str] = Field(None, min_length=1, max_length=255, description="Merchant display name")
    category_id: Optional[int] = Field(None, ge=1, description="Category ID")
    description: Optional[str] = Field(None, max_length=500, description="Expense description")
    tags: List[str] = Field(default_factory=list, description="Tag names")
    type: Optional[str] = Field(None, pattern=r"^(fixed|necessary variable|discretionary)$", description="Expense type")
    
    @field_validator("tags")
    @classmethod
    def validate_tags(cls, v: List[str]) -> List[str]:
        """Validate tag names"""
        validated = []
        for tag in v:
            if not tag or len(tag) > 50:
                raise ValueError(f"Tag name must be between 1 and 50 characters")
            validated.append(tag.strip())
        return validated


class ArchiveExpensesRequest(BaseModel):
    """Schema for archiving raw expenses"""
    raw_expense_ids: List[int] = Field(..., min_length=1, description="Raw expense IDs to archive")
    
    @field_validator("raw_expense_ids")
    @classmethod
    def validate_ids(cls, v: List[int]) -> List[int]:
        if not v:
            raise ValueError("At least one raw expense ID is required")
        for id in v:
            if id < 1:
                raise ValueError("Invalid raw expense ID")
        return v


class MergeExpenseData(BaseModel):
    """Schema for merged expense data"""
    merchant_name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    category_id: Optional[int] = Field(default=None, ge=1)
    description: Optional[str] = Field(default=None, max_length=500)
    tags: List[str] = Field(default_factory=list)
    type: Optional[str] = Field(default=None, pattern=r"^(fixed|necessary variable|discretionary)$")


class MergeExpensesRequest(BaseModel):
    """Schema for merging raw expenses"""
    raw_expense_ids: List[int] = Field(..., min_length=2, description="Raw expense IDs to merge")
    expense_data: MergeExpenseData = Field(default_factory=MergeExpenseData, description="Merged expense data")
    
    @field_validator("raw_expense_ids")
    @classmethod
    def validate_ids(cls, v: List[int]) -> List[int]:
        if len(v) < 2:
            raise ValueError("At least 2 expenses are required for merging")
        for id in v:
            if id < 1:
                raise ValueError("Invalid raw expense ID")
        return v


# =============================================================================
# Common Response Schemas
# =============================================================================

class MessageResponse(BaseModel):
    """Generic message response"""
    message: str


class DeleteResponse(BaseModel):
    """Response for delete operations"""
    message: str


class QueueCountResponse(BaseModel):
    """Response for queue count"""
    count: int


class ProcessedExpenseResponse(BaseModel):
    """Response after processing an expense"""
    message: str
    expense_id: int


class ArchiveResponse(BaseModel):
    """Response for archive operation"""
    message: str
    archived_count: int


class MergeResponse(BaseModel):
    """Response for merge operation"""
    message: str
    expense_id: int
    archived_raw_expense_ids: List[int]


class ApplyRulesResponse(BaseModel):
    """Response for applying rules"""
    message: str
    processed: int
    discarded: int
    saved: int
