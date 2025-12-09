import json
import uuid
from datetime import datetime, date
from pathlib import Path
from typing import Optional
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..config import settings
from ..database import get_db
from ..models.notification import RawNotification
from ..models.expense import RawExpense
from ..models.bank_account import BankAccount
from ..services.notification_parser import NotificationParser

router = APIRouter()


class NotificationPayload(BaseModel):
    """Schema for incoming notification from Android app"""
    id: Optional[int] = None  # notification id from device
    packageName: Optional[str] = None  # e.g., "com.barclays.app"
    appName: Optional[str] = None  # e.g., "Barclays"
    title: Optional[str] = None  # notification title
    text: Optional[str] = None  # notification body text
    timestamp: Optional[int] = None  # unix timestamp in milliseconds
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class NotificationResponse(BaseModel):
    id: int
    status: str
    message: str
    source_file: str


class BulkNotificationResponse(BaseModel):
    status: str
    message: str
    count: int
    notifications: list[NotificationResponse]


@router.post("/", response_model=BulkNotificationResponse)
async def receive_notifications(
    payload: list[NotificationPayload],
    db: Session = Depends(get_db)
):
    """
    Receive notifications from the Android app.
    Accepts a list of notifications and stores each raw payload for later parsing.
    """
    responses = []
    
    for notification in payload:
        # Generate unique filename
        timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = uuid.uuid4().hex[:8]
        filename = f"{timestamp_str}_{unique_id}.json"
        filepath = settings.NOTIFICATIONS_DIR / filename
        
        # Convert timestamp if provided
        notification_time = None
        if notification.timestamp:
            notification_time = datetime.fromtimestamp(notification.timestamp / 1000)
        
        # Save raw JSON to file
        raw_payload = notification.model_dump()
        with open(filepath, "w") as f:
            json.dump(raw_payload, f, indent=2, default=str)
        
        # Store in database
        raw_notification = RawNotification(
            app_package=notification.packageName,
            app_name=notification.appName,
            title=notification.title,
            text=notification.text,
            notification_timestamp=notification_time,
            raw_payload=json.dumps(raw_payload),
            source_file=filename,
            is_processed=False
        )
        
        db.add(raw_notification)
        db.commit()
        db.refresh(raw_notification)
        
        responses.append(NotificationResponse(
            id=raw_notification.id,
            status="received",
            message="Notification stored successfully",
            source_file=filename
        ))
    
    return BulkNotificationResponse(
        status="received",
        message=f"Successfully stored {len(responses)} notifications",
        count=len(responses),
        notifications=responses
    )


@router.post("/load-from-files")
async def load_notifications_from_files(db: Session = Depends(get_db)):
    """
    Load notification JSON files from the imports/notifications directory.
    Skips files that are already in the database.
    """
    notifications_dir = settings.NOTIFICATIONS_DIR
    
    if not notifications_dir.exists():
        raise HTTPException(status_code=404, detail="Notifications directory not found")
    
    json_files = list(notifications_dir.glob("*.json"))
    
    # Get existing source files
    existing_files = set(
        row[0] for row in db.query(RawNotification.source_file).all()
    )
    
    loaded_count = 0
    skipped_count = 0
    errors = []
    
    for json_file in json_files:
        filename = json_file.name
        
        # Skip if already loaded
        if filename in existing_files:
            skipped_count += 1
            continue
        
        try:
            with open(json_file, 'r') as f:
                data = json.load(f)
            
            # Convert timestamp if provided
            notification_time = None
            if data.get('timestamp'):
                notification_time = datetime.fromtimestamp(data['timestamp'] / 1000)
            
            # Create notification record
            notification = RawNotification(
                app_package=data.get('packageName'),
                app_name=data.get('appName'),
                title=data.get('title'),
                text=data.get('text'),
                notification_timestamp=notification_time,
                raw_payload=json.dumps(data),
                source_file=filename,
                is_processed=False
            )
            
            db.add(notification)
            loaded_count += 1
            
        except Exception as e:
            errors.append({"file": filename, "error": str(e)})
    
    db.commit()
    
    return {
        "message": f"Loaded {loaded_count} notifications from files",
        "loaded": loaded_count,
        "skipped": skipped_count,
        "errors": errors
    }


@router.get("/unprocessed")
async def get_unprocessed_notifications(db: Session = Depends(get_db)):
    """Get all unprocessed notifications"""
    notifications = db.query(RawNotification).filter(
        RawNotification.is_processed == False
    ).order_by(RawNotification.received_at.desc()).all()
    
    return notifications


@router.get("/")
async def get_all_notifications(
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """Get all notifications with pagination"""
    notifications = db.query(RawNotification).order_by(
        RawNotification.received_at.desc()
    ).offset(offset).limit(limit).all()
    
    total = db.query(RawNotification).count()
    
    return {
        "notifications": notifications,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.get("/{notification_id}")
async def get_notification(notification_id: int, db: Session = Depends(get_db)):
    """Get a specific notification by ID"""
    notification = db.query(RawNotification).filter(
        RawNotification.id == notification_id
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return notification


@router.delete("/{notification_id}")
async def delete_notification(notification_id: int, db: Session = Depends(get_db)):
    """Delete a notification"""
    notification = db.query(RawNotification).filter(
        RawNotification.id == notification_id
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    # Optionally delete the source file
    if notification.source_file:
        filepath = settings.NOTIFICATIONS_DIR / notification.source_file
        if filepath.exists():
            filepath.unlink()
    
    db.delete(notification)
    db.commit()
    
    return {"message": "Notification deleted"}


class ParsedExpense(BaseModel):
    """Schema for a parsed expense from notification"""
    notification_id: int
    merchant_name: str
    amount: float
    currency: str
    transaction_date: str
    raw_description: str
    bank_account_name: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    pattern_matched: str


class ParseAllResponse(BaseModel):
    """Response for parse all notifications"""
    total_notifications: int
    parsed_count: int
    discarded_count: int
    already_processed_count: int
    parsed_expenses: list[ParsedExpense]


@router.post("/parse-all", response_model=ParseAllResponse)
async def parse_all_notifications(db: Session = Depends(get_db)):
    """
    Parse all unprocessed notifications and return the list of parsed expenses.
    Does not save to database yet - user can review and edit before accepting.
    """
    # Get all unprocessed notifications
    notifications = db.query(RawNotification).filter(
        RawNotification.is_processed == False
    ).all()
    
    parsed_expenses = []
    discarded_count = 0
    already_processed_count = 0
    
    for notification in notifications:
        # Skip if already linked to a raw expense
        if notification.raw_expense_id:
            already_processed_count += 1
            continue
        
        # Try to parse
        parsed_data = NotificationParser.parse_notification(notification)
        
        if parsed_data:
            # Convert date to string for JSON serialization
            parsed_data["transaction_date"] = str(parsed_data["transaction_date"])
            parsed_expenses.append(ParsedExpense(**parsed_data))
        else:
            # Mark as not an expense
            notification.is_expense = False
            discarded_count += 1
    
    db.commit()
    
    return ParseAllResponse(
        total_notifications=len(notifications),
        parsed_count=len(parsed_expenses),
        discarded_count=discarded_count,
        already_processed_count=already_processed_count,
        parsed_expenses=parsed_expenses
    )


class AcceptExpenseRequest(BaseModel):
    """Request to accept and save a parsed expense"""
    notification_id: int
    merchant_name: str
    amount: float
    currency: str
    transaction_date: str
    raw_description: str
    bank_account_name: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None


@router.post("/accept-expense")
async def accept_expense(request: AcceptExpenseRequest, db: Session = Depends(get_db)):
    """
    Accept a parsed expense and create a RawExpense from it.
    Marks the notification as processed.
    """
    # Get the notification
    notification = db.query(RawNotification).filter(
        RawNotification.id == request.notification_id
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    if notification.is_processed:
        raise HTTPException(status_code=400, detail="Notification already processed")
    
    # Get or create bank account
    bank_account = db.query(BankAccount).filter(
        BankAccount.name == request.bank_account_name
    ).first()
    
    if not bank_account:
        # Create new bank account
        bank_account = BankAccount(
            name=request.bank_account_name,
            bank_name=request.bank_account_name,
            account_type="checking"
        )
        db.add(bank_account)
        db.flush()
    
    # Create raw expense
    raw_expense = RawExpense(
        bank_account_id=bank_account.id,
        external_id=f"notif_{notification.id}_{int(datetime.now().timestamp())}",
        transaction_date=datetime.strptime(request.transaction_date, "%Y-%m-%d").date(),
        amount=Decimal(str(request.amount)),
        currency=request.currency,
        raw_merchant_name=request.merchant_name,
        raw_description=request.raw_description,
        source="notification",
        source_file=notification.source_file
    )
    
    db.add(raw_expense)
    db.flush()
    
    # Mark notification as processed
    notification.is_processed = True
    notification.is_expense = True
    notification.raw_expense_id = raw_expense.id
    
    db.commit()
    db.refresh(raw_expense)
    
    return {
        "message": "Expense accepted and saved",
        "raw_expense_id": raw_expense.id,
        "notification_id": notification.id
    }


@router.post("/accept-all")
async def accept_all_expenses(expenses: list[AcceptExpenseRequest], db: Session = Depends(get_db)):
    """
    Accept multiple parsed expenses at once.
    """
    results = []
    
    for expense_req in expenses:
        try:
            # Get the notification
            notification = db.query(RawNotification).filter(
                RawNotification.id == expense_req.notification_id
            ).first()
            
            if not notification or notification.is_processed:
                continue
            
            # Get or create bank account
            bank_account = db.query(BankAccount).filter(
                BankAccount.name == expense_req.bank_account_name
            ).first()
            
            if not bank_account:
                bank_account = BankAccount(
                    name=expense_req.bank_account_name,
                    bank_name=expense_req.bank_account_name,
                    account_type="checking"
                )
                db.add(bank_account)
                db.flush()
            
            # Create raw expense
            raw_expense = RawExpense(
                bank_account_id=bank_account.id,
                external_id=f"notif_{notification.id}_{int(datetime.now().timestamp())}",
                transaction_date=datetime.strptime(expense_req.transaction_date, "%Y-%m-%d").date(),
                amount=Decimal(str(expense_req.amount)),
                currency=expense_req.currency,
                raw_merchant_name=expense_req.merchant_name,
                raw_description=expense_req.raw_description,
                source="notification",
                source_file=notification.source_file
            )
            
            db.add(raw_expense)
            db.flush()
            
            # Mark notification as processed
            notification.is_processed = True
            notification.is_expense = True
            notification.raw_expense_id = raw_expense.id
            
            results.append({
                "notification_id": notification.id,
                "raw_expense_id": raw_expense.id,
                "success": True
            })
            
        except Exception as e:
            results.append({
                "notification_id": expense_req.notification_id,
                "success": False,
                "error": str(e)
            })
    
    db.commit()
    
    return {
        "message": f"Processed {len(results)} expenses",
        "results": results
    }


@router.post("/discard/{notification_id}")
async def discard_notification(notification_id: int, db: Session = Depends(get_db)):
    """
    Mark a notification as not an expense (discarded).
    This is used when a user removes an expense from the parsed list.
    """
    notification = db.query(RawNotification).filter(
        RawNotification.id == notification_id
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    # Mark as processed and not an expense
    notification.is_processed = True
    notification.is_expense = False
    
    db.commit()
    
    return {
        "message": "Notification marked as not an expense",
        "notification_id": notification_id
    }
