import re
from datetime import datetime
from decimal import Decimal
from typing import Optional, Dict, Any
from ..models.notification import RawNotification


class NotificationParser:
    """Parse bank notification text into expense data"""
    
    # Regex patterns for different banks/apps
    PATTERNS = {
        "revolut_payment": {
            "regex": r"Has pagado ([\d,]+)\s*€ en (.+?)(?:\s*[🍽️🚎🍕🍔🍕🛍️💳]|$)",
            "type": "expense",
            "extract": lambda m: {
                "amount": m.group(1).replace(",", "."),
                "merchant": m.group(2).strip()
            }
        },
        "openbank_payment": {
            "regex": r"pago con tu tarjeta \*\*(\d+) el (\d+/\d+) (\d+:\d+) por ([\d,]+) EUR en (.+?)(?:\.|$)",
            "type": "expense",
            "extract": lambda m: {
                "amount": m.group(4).replace(",", "."),
                "merchant": m.group(5).strip().rstrip('.').strip(),
                "card_last_digits": m.group(1),
                "date_str": m.group(2),
                "time_str": m.group(3)
            }
        },
        "openbank_bizum_received": {
            "regex": r"Has recibido un Bizum de ([\d,]+) EUR de (.+?) por",
            "type": "income",
            "extract": lambda m: {
                "amount": m.group(1).replace(",", "."),
                "merchant": f"Bizum from {m.group(2).strip()}"
            }
        },
        "openbank_bizum_sent": {
            "regex": r"Has enviado un Bizum de ([\d,]+) EUR a (.+?) por",
            "type": "expense",
            "extract": lambda m: {
                "amount": m.group(1).replace(",", "."),
                "merchant": f"Bizum to {m.group(2).strip()}"
            }
        },
        "openbank_confirmation": {
            "regex": r"Código de confirmación [A-Z0-9]+ para consultar",
            "type": "non_expense",
            "extract": lambda m: {}
        }
    }
    
    # Non-expense patterns (to discard)
    NON_EXPENSE_KEYWORDS = [
        "código de confirmación",
        "confirmation code",
        "security code",
        "verificación",
        "verification",
        "balance",
        "saldo disponible"
    ]
    
    @classmethod
    def parse_notification(cls, notification: RawNotification) -> Optional[Dict[str, Any]]:
        """
        Parse a notification into expense data.
        Returns None if the notification is not an expense.
        Returns dict with expense data if it is an expense.
        """
        text = getattr(notification, "text", None)
        if not text:
            return None
        
        text_lower = text.lower()
        
        # Check for non-expense keywords first
        for keyword in cls.NON_EXPENSE_KEYWORDS:
            if keyword.lower() in text_lower:
                return None
        
        # Try each pattern
        for pattern_name, pattern_config in cls.PATTERNS.items():
            match = re.search(pattern_config["regex"], text, re.IGNORECASE)
            if match:
                if pattern_config["type"] == "non_expense":
                    return None
                
                try:
                    extracted = pattern_config["extract"](match)
                    
                    # Determine bank account based on app package
                    app_pkg = getattr(notification, "app_package", None)
                    bank_account_name = cls._get_bank_account_name(app_pkg)
                    
                    # Parse amount (negative for expenses, positive for income)
                    amount = Decimal(extracted["amount"])
                    if pattern_config["type"] == "expense":
                        amount = -abs(amount)
                    else:  # income
                        amount = abs(amount)
                    
                    # Use notification timestamp or current time
                    notification_ts = getattr(notification, "notification_timestamp", None)
                    transaction_date = notification_ts if notification_ts else datetime.now()
                    
                    # Extract location if available
                    raw_payload = getattr(notification, "raw_payload", None)
                    location = cls._extract_location(raw_payload) if raw_payload else {"latitude": None, "longitude": None}
                    
                    result = {
                        "merchant_name": extracted.get("merchant", "Unknown"),
                        "amount": float(amount),
                        "currency": "EUR",  # Default to EUR, can be enhanced
                        "transaction_date": transaction_date.date() if isinstance(transaction_date, datetime) else transaction_date,
                        "raw_description": text,
                        "source": "notification",
                        "bank_account_name": bank_account_name,
                        "latitude": location.get("latitude"),
                        "longitude": location.get("longitude"),
                        "notification_id": getattr(notification, "id", None),
                        "pattern_matched": pattern_name
                    }
                    
                    return result
                    
                except (ValueError, AttributeError, KeyError) as e:
                    # Failed to extract data properly
                    continue
        
        # No pattern matched
        return None
    
    @staticmethod
    def _get_bank_account_name(app_package: Optional[str]) -> str:
        """Map app package to bank account name"""
        if not app_package:
            return "Unknown"
        
        mapping = {
            "com.revolut.revolut": "Revolut",
            "es.openbank.mobile": "Openbank",
            "com.barclays.app": "Barclays",
            "com.santander.app": "Santander"
        }
        
        return mapping.get(app_package, app_package)
    
    @staticmethod
    def _extract_location(raw_payload: str) -> Dict[str, Optional[float]]:
        """Extract location from raw JSON payload"""
        try:
            import json
            data = json.loads(raw_payload)
            return {
                "latitude": data.get("latitude"),
                "longitude": data.get("longitude")
            }
        except:
            return {"latitude": None, "longitude": None}
    
    @classmethod
    def is_expense_notification(cls, notification: RawNotification) -> bool:
        """Quick check if notification might be an expense"""
        result = cls.parse_notification(notification)
        return result is not None
