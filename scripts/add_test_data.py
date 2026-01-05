"""
Add test data to the database for testing duplicate detection and archive functionality.
"""
import sqlite3
from datetime import date, timedelta
from decimal import Decimal

DB_PATH = "data/expenses.db"

def add_test_data():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Get or create a test bank account
        cursor.execute("SELECT id FROM bank_accounts LIMIT 1")
        result = cursor.fetchone()
        
        if result:
            bank_account_id = result[0]
        else:
            cursor.execute("""
                INSERT INTO bank_accounts (name, account_number, bank_name, currency)
                VALUES ('Test Account', '12345678', 'Test Bank', 'GBP')
            """)
            bank_account_id = cursor.lastrowid
        
        # Add test raw expenses (unprocessed)
        test_date = date.today()
        
        print("Adding test raw expenses...")
        
        # Regular raw expenses
        raw_expenses = [
            (bank_account_id, 'RAW001', test_date - timedelta(days=1), -25.50, 'GBP', 'Tesco', 'Grocery shopping', 'test_import', 'test_data.csv'),
            (bank_account_id, 'RAW002', test_date - timedelta(days=2), -45.00, 'GBP', 'Shell Petrol', 'Fuel purchase', 'test_import', 'test_data.csv'),
            (bank_account_id, 'RAW003', test_date - timedelta(days=3), -12.99, 'GBP', 'Netflix', 'Monthly subscription', 'test_import', 'test_data.csv'),
            (bank_account_id, 'RAW004', test_date - timedelta(days=4), -89.99, 'GBP', 'Amazon', 'Online shopping', 'test_import', 'test_data.csv'),
            (bank_account_id, 'RAW005', test_date - timedelta(days=5), -15.75, 'GBP', 'Costa Coffee', 'Coffee and snacks', 'test_import', 'test_data.csv'),
            
            # DUPLICATE: Same as RAW001 (potential duplicate)
            (bank_account_id, 'RAW006', test_date - timedelta(days=1), -25.50, 'GBP', 'Tesco Metro', 'Grocery shopping duplicate', 'test_import', 'test_data.csv'),
            
            # DUPLICATE: Same as RAW002 (potential duplicate)
            (bank_account_id, 'RAW007', test_date - timedelta(days=2), -45.00, 'GBP', 'Shell', 'Fuel duplicate entry', 'test_import', 'test_data.csv'),
            
            # More regular expenses
            (bank_account_id, 'RAW008', test_date - timedelta(days=6), -67.50, 'GBP', 'Restaurant', 'Dinner with friends', 'test_import', 'test_data.csv'),
            (bank_account_id, 'RAW009', test_date - timedelta(days=7), -120.00, 'GBP', 'Gym Membership', 'Monthly gym fee', 'test_import', 'test_data.csv'),
            (bank_account_id, 'RAW010', test_date - timedelta(days=8), -8.50, 'GBP', 'Spotify', 'Music subscription', 'test_import', 'test_data.csv'),
        ]
        
        for raw_exp in raw_expenses:
            cursor.execute("""
                INSERT INTO raw_expenses 
                (bank_account_id, external_id, transaction_date, amount, currency, 
                 raw_merchant_name, raw_description, source, source_file)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, raw_exp)
        
        print(f"✓ Added {len(raw_expenses)} raw expenses")
        
        # Get or create test categories
        cursor.execute("SELECT id FROM categories WHERE name = 'Groceries' LIMIT 1")
        result = cursor.fetchone()
        if result:
            groceries_cat_id = result[0]
        else:
            cursor.execute("INSERT INTO categories (name, color) VALUES ('Groceries', '#28a745')")
            groceries_cat_id = cursor.lastrowid
        
        cursor.execute("SELECT id FROM categories WHERE name = 'Transport' LIMIT 1")
        result = cursor.fetchone()
        if result:
            transport_cat_id = result[0]
        else:
            cursor.execute("INSERT INTO categories (name, color) VALUES ('Transport', '#007bff')")
            transport_cat_id = cursor.lastrowid
        
        cursor.execute("SELECT id FROM categories WHERE name = 'Entertainment' LIMIT 1")
        result = cursor.fetchone()
        if result:
            entertainment_cat_id = result[0]
        else:
            cursor.execute("INSERT INTO categories (name, color) VALUES ('Entertainment', '#ffc107')")
            entertainment_cat_id = cursor.lastrowid
        
        # Get or create merchant aliases
        cursor.execute("SELECT id FROM merchant_aliases WHERE display_name = 'Tesco' LIMIT 1")
        result = cursor.fetchone()
        if result:
            tesco_merchant_id = result[0]
        else:
            cursor.execute("""
                INSERT INTO merchant_aliases (raw_name, display_name, default_category_id)
                VALUES ('Tesco', 'Tesco', ?)
            """, (groceries_cat_id,))
            tesco_merchant_id = cursor.lastrowid
        
        cursor.execute("SELECT id FROM merchant_aliases WHERE display_name = 'Shell' LIMIT 1")
        result = cursor.fetchone()
        if result:
            shell_merchant_id = result[0]
        else:
            cursor.execute("""
                INSERT INTO merchant_aliases (raw_name, display_name, default_category_id)
                VALUES ('Shell', 'Shell', ?)
            """, (transport_cat_id,))
            shell_merchant_id = cursor.lastrowid
        
        cursor.execute("SELECT id FROM merchant_aliases WHERE display_name = 'Netflix' LIMIT 1")
        result = cursor.fetchone()
        if result:
            netflix_merchant_id = result[0]
        else:
            cursor.execute("""
                INSERT INTO merchant_aliases (raw_name, display_name, default_category_id)
                VALUES ('Netflix', 'Netflix', ?)
            """, (entertainment_cat_id,))
            netflix_merchant_id = cursor.lastrowid
        
        print("✓ Created/verified categories and merchants")
        
        # Add some saved expenses (already processed)
        print("Adding saved expenses...")
        
        saved_expenses = [
            # Regular saved expenses
            (None, bank_account_id, test_date - timedelta(days=10), -35.99, 'GBP', 
             tesco_merchant_id, groceries_cat_id, 'Weekly groceries', None, False, False),
            
            (None, bank_account_id, test_date - timedelta(days=11), -55.00, 'GBP', 
             shell_merchant_id, transport_cat_id, 'Fuel', None, False, False),
            
            (None, bank_account_id, test_date - timedelta(days=12), -12.99, 'GBP', 
             netflix_merchant_id, entertainment_cat_id, 'Monthly Netflix', None, False, False),
            
            # DUPLICATE of RAW003 (saved expense with same amount and date)
            # This will show as duplicate when we run find duplicates
            (None, bank_account_id, test_date - timedelta(days=3), -12.99, 'GBP', 
             netflix_merchant_id, entertainment_cat_id, 'Netflix subscription', None, False, False),
            
            # Archived expenses (missing data but saved for analysis)
            (None, bank_account_id, test_date - timedelta(days=20), -50.00, 'GBP', 
             None, None, None, None, False, True),
            
            (None, bank_account_id, test_date - timedelta(days=21), -25.00, 'GBP', 
             None, None, None, None, False, True),
            
            (None, bank_account_id, test_date - timedelta(days=22), -100.00, 'GBP', 
             None, None, None, None, False, True),
        ]
        
        for exp in saved_expenses:
            cursor.execute("""
                INSERT INTO expenses 
                (raw_expense_id, bank_account_id, transaction_date, amount, currency,
                 merchant_alias_id, category_id, description, notes, is_recurring, archived)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, exp)
        
        print(f"✓ Added {len(saved_expenses)} saved expenses (including 3 archived and 1 duplicate)")
        
        conn.commit()
        
        print("\n" + "="*60)
        print("Test data added successfully!")
        print("="*60)
        print("\nTest scenarios:")
        print("1. DUPLICATES:")
        print("   - RAW001 & RAW006: Same amount (-£25.50) and date")
        print("   - RAW002 & RAW007: Same amount (-£45.00) and date")
        print("   - RAW003 & Saved Netflix: Same amount (-£12.99) and date")
        print("\n2. ARCHIVE:")
        print("   - 3 archived expenses with missing merchant/category data")
        print("\n3. REGULAR QUEUE:")
        print("   - 10 unprocessed raw expenses to test queue processing")
        print("\nGo to /queue and click Tools > Find Duplicates to test!")
        print("="*60)
        
    except Exception as e:
        print(f"Error adding test data: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    add_test_data()
