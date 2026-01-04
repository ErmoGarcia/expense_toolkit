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


def _process_notification_to_queue(
    notification: RawNotification,
    db: Session
) -> bool:
    """
    Parse a notification and create a RawExpense if it's a valid expense.
    Returns True if expense was created, False otherwise.
    """
    try:
        # Try to parse the notification
        parsed_data = NotificationParser.parse_notification(notification)
        
        if parsed_data:
            # Get or create bank account
            bank_account_name = parsed_data.get("bank_account_name", "Unknown")
            bank_account = db.query(BankAccount).filter(
                BankAccount.name == bank_account_name
            ).first()
            
            if not bank_account:
                bank_account = BankAccount(
                    name=bank_account_name,
                    bank_name=bank_account_name,
                    account_type="checking"
                )
                db.add(bank_account)
                db.flush()
            
            # Create raw expense
            raw_expense = RawExpense(
                bank_account_id=bank_account.id,
                external_id=f"notif_{notification.id}_{int(datetime.now().timestamp())}",
                transaction_date=parsed_data["transaction_date"],
                amount=Decimal(str(parsed_data["amount"])),
                currency=parsed_data["currency"],
                raw_merchant_name=parsed_data["merchant_name"],
                raw_description=parsed_data["raw_description"],
                source="notification",
                source_file=notification.source_file
            )
            
            db.add(raw_expense)
            db.flush()
            
            # Mark notification as processed
            notification.is_processed = True
            notification.is_expense = True
            notification.raw_expense_id = raw_expense.id
            
            return True
        else:
            # Not an expense notification
            notification.is_processed = True
            notification.is_expense = False
            return False
            
    except Exception as e:
        # Log the error and mark as failed
        print(f"Error parsing notification {notification.id}: {e}")
        notification.is_processed = True
        notification.is_expense = False
        notification.parse_error = str(e)
        return False


@router.post("/", response_model=BulkNotificationResponse)
async def receive_notifications(
    payload: list[NotificationPayload],
    db: Session = Depends(get_db)
):
    """
    Receive notifications from the Android app.
    Accepts a list of notifications, stores each raw payload, and immediately
    parses them to create RawExpense records for the queue.
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
        db.flush()
        
        # Immediately process the notification to create RawExpense
        _process_notification_to_queue(raw_notification, db)
        
        responses.append(NotificationResponse(
            id=raw_notification.id,
            status="received",
            message="Notification stored successfully",
            source_file=filename
        ))
    
    db.commit()
    
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
    Immediately processes loaded notifications to create RawExpense records.
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
    processed_count = 0
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
            db.flush()
            
            # Immediately process the notification
            if _process_notification_to_queue(notification, db):
                processed_count += 1
            
            loaded_count += 1
            
        except Exception as e:
            print(f"Error loading notification file {filename}: {e}")
            errors.append({"file": filename, "error": str(e)})
    
    db.commit()
    
    return {
        "message": f"Loaded {loaded_count} notifications from files, {processed_count} parsed as expenses",
        "loaded": loaded_count,
        "processed": processed_count,
        "skipped": skipped_count,
        "errors": errors
    }


@router.get("/unprocessed")
async def get_unprocessed_notifications(db: Session = Depends(get_db)):
    """Get all unprocessed notifications (for debugging)"""
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
    """Get all notifications with pagination (for debugging)"""
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
    """Get a specific notification by ID (for debugging)"""
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
