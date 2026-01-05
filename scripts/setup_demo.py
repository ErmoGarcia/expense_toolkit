#!/usr/bin/env python3
"""
Setup demo data for Expense Toolkit
"""

import sys
from pathlib import Path
from datetime import datetime, timedelta
import random
from decimal import Decimal

# Add project root to path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from app.database import SessionLocal, create_tables
from app.models import Category, Tag, BankAccount, RawExpense

def create_demo_data():
    """Create sample categories, tags, and raw expenses for demo"""
    
    # Create database tables
    create_tables()
    
    db = SessionLocal()
    try:
        # Create categories
        categories = [
            {"name": "Groceries", "color": "#28a745", "icon": "🛒"},
            {"name": "Transport", "color": "#007bff", "icon": "🚗"},
            {"name": "Utilities", "color": "#ffc107", "icon": "⚡"},
            {"name": "Entertainment", "color": "#e83e8c", "icon": "🎬"},
            {"name": "Restaurants", "color": "#fd7e14", "icon": "🍽️"},
            {"name": "Shopping", "color": "#6f42c1", "icon": "🛍️"},
            {"name": "Healthcare", "color": "#20c997", "icon": "🏥"},
            {"name": "Subscriptions", "color": "#17a2b8", "icon": "📱"},
        ]
        
        for cat_data in categories:
            if not db.query(Category).filter(Category.name == cat_data["name"]).first():
                category = Category(**cat_data)
                db.add(category)
        
        # Create tags
        tags = [
            {"name": "recurring", "color": "#6c757d"},
            {"name": "essential", "color": "#28a745"},
            {"name": "luxury", "color": "#dc3545"},
            {"name": "household", "color": "#007bff"},
            {"name": "work", "color": "#17a2b8"},
            {"name": "family", "color": "#e83e8c"},
        ]
        
        for tag_data in tags:
            if not db.query(Tag).filter(Tag.name == tag_data["name"]).first():
                tag = Tag(**tag_data)
                db.add(tag)
        
        # Create a bank account
        if not db.query(BankAccount).filter(BankAccount.name == "Main Checking").first():
            bank_account = BankAccount(
                name="Main Checking",
                bank_name="Barclays",
                account_type="checking"
            )
            db.add(bank_account)
        
        db.commit()
        
        # Get bank account ID
        bank_account = db.query(BankAccount).filter(BankAccount.name == "Main Checking").first()
        
        # Create sample raw expenses
        sample_expenses = [
            {"merchant": "TESCO STORES 1234", "amount": -45.67, "days_ago": 1},
            {"merchant": "AMZN MKTP UK*2X9Y1Z3", "amount": -23.99, "days_ago": 2},
            {"merchant": "SPOTIFY P12345678", "amount": -10.99, "days_ago": 3},
            {"merchant": "TFL TRAVEL CHARGE", "amount": -8.50, "days_ago": 4},
            {"merchant": "MCDONALD'S 1234", "amount": -12.45, "days_ago": 5},
            {"merchant": "SHELL 12345", "amount": -65.00, "days_ago": 6},
            {"merchant": "AMAZON PRIME", "amount": -8.99, "days_ago": 7},
            {"merchant": "JOHN LEWIS PLC", "amount": -89.50, "days_ago": 8},
            {"merchant": "UBER TRIP", "amount": -15.20, "days_ago": 9},
            {"merchant": "SAINSBURYS S/MKT", "amount": -32.10, "days_ago": 10},
        ]
        
        for i, expense_data in enumerate(sample_expenses):
            # Check if raw expense already exists
            existing = db.query(RawExpense).filter(
                RawExpense.external_id == f"demo_{i+1}"
            ).first()
            
            if not existing:
                raw_expense = RawExpense(
                    bank_account_id=bank_account.id,
                    external_id=f"demo_{i+1}",
                    transaction_date=(datetime.now() - timedelta(days=expense_data["days_ago"])).date(),
                    amount=Decimal(str(expense_data["amount"])),
                    currency="GBP",
                    raw_merchant_name=expense_data["merchant"],
                    raw_description=f"Card payment to {expense_data['merchant']}",
                    source="demo_data",
                    source_file="setup_demo.py"
                )
                db.add(raw_expense)
        
        db.commit()
        print("✅ Demo data created successfully!")
        print(f"📊 Created {len(categories)} categories")
        print(f"🏷️ Created {len(tags)} tags")
        print(f"🏦 Created 1 bank account")
        print(f"💳 Created {len(sample_expenses)} sample raw expenses")
        print("\n🚀 You can now run the server and start processing the queue!")
        
    except Exception as e:
        print(f"❌ Error creating demo data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_demo_data()