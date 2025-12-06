import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models.notification import RawNotification

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
