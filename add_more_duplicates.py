"""
Add more test expenses with various duplicate scenarios for comprehensive testing.
"""
import sqlite3
from datetime import date, timedelta

DB_PATH = "data/expenses.db"

def add_duplicate_test_data():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Get bank account
        cursor.execute("SELECT id FROM bank_accounts LIMIT 1")
        result = cursor.fetchone()
        if not result:
            print("Error: No bank account found. Run add_test_data.py first.")
            return
        
        bank_account_id = result[0]
        test_date = date.today()
        
        print("Adding more duplicate test scenarios...")
        
        # Scenario 1: Triple duplicate - same amount and date (3 raw expenses)
        print("\n1. Triple Duplicate Scenario (-£15.99, same date):")
        duplicate_date_1 = test_date - timedelta(days=15)
        triple_dups = [
            (bank_account_id, 'DUP001', duplicate_date_1, -15.99, 'GBP', 'Starbucks Main St', 'Coffee', 'test_import', 'duplicates.csv'),
            (bank_account_id, 'DUP002', duplicate_date_1, -15.99, 'GBP', 'Starbucks Coffee', 'Morning coffee', 'test_import', 'duplicates.csv'),
            (bank_account_id, 'DUP003', duplicate_date_1, -15.99, 'GBP', 'Starbucks', 'Latte and muffin', 'test_import', 'duplicates.csv'),
        ]
        
        for dup in triple_dups:
            cursor.execute("""
                INSERT INTO raw_expenses 
                (bank_account_id, external_id, transaction_date, amount, currency, 
                 raw_merchant_name, raw_description, source, source_file)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, dup)
        
        print(f"   Added 3 raw expenses with -£15.99 on {duplicate_date_1}")
        
        # Scenario 2: Duplicate with saved expense - same amount and date
        print("\n2. Raw + Saved Duplicate Scenario (-£9.99, same date):")
        duplicate_date_2 = test_date - timedelta(days=18)
        
        # Add raw expense
        cursor.execute("""
            INSERT INTO raw_expenses 
            (bank_account_id, external_id, transaction_date, amount, currency, 
             raw_merchant_name, raw_description, source, source_file)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (bank_account_id, 'DUP004', duplicate_date_2, -9.99, 'GBP', 
              'Apple.com/bill', 'Apple subscription', 'test_import', 'duplicates.csv'))
        
        # Add matching saved expense
        cursor.execute("SELECT id FROM categories WHERE name = 'Entertainment' LIMIT 1")
        result = cursor.fetchone()
        entertainment_cat_id = result[0] if result else None
        
        cursor.execute("""
            INSERT INTO expenses 
            (raw_expense_id, bank_account_id, transaction_date, amount, currency,
             merchant_alias_id, category_id, description, notes, is_recurring, archived)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (None, bank_account_id, duplicate_date_2, -9.99, 'GBP', 
              None, entertainment_cat_id, 'Apple Subscription', None, False, False))
        
        print(f"   Added 1 raw + 1 saved expense with -£9.99 on {duplicate_date_2}")
        
        # Scenario 3: Multiple pairs of duplicates (different amounts, same dates within pairs)
        print("\n3. Multiple Duplicate Pairs:")
        
        # Pair A: -£35.00
        duplicate_date_3a = test_date - timedelta(days=16)
        pair_a = [
            (bank_account_id, 'DUP005', duplicate_date_3a, -35.00, 'GBP', 'Sainsburys', 'Groceries', 'test_import', 'duplicates.csv'),
            (bank_account_id, 'DUP006', duplicate_date_3a, -35.00, 'GBP', "Sainsbury's Local", 'Weekly shop', 'xlsx_import', 'bank_export.xlsx'),
        ]
        
        for dup in pair_a:
            cursor.execute("""
                INSERT INTO raw_expenses 
                (bank_account_id, external_id, transaction_date, amount, currency, 
                 raw_merchant_name, raw_description, source, source_file)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, dup)
        
        print(f"   Pair A: 2 raw expenses with -£35.00 on {duplicate_date_3a}")
        
        # Pair B: -£7.50
        duplicate_date_3b = test_date - timedelta(days=17)
        pair_b = [
            (bank_account_id, 'DUP007', duplicate_date_3b, -7.50, 'GBP', 'Pret A Manger', 'Lunch', 'test_import', 'duplicates.csv'),
            (bank_account_id, 'DUP008', duplicate_date_3b, -7.50, 'GBP', 'Pret', 'Sandwich and drink', 'test_import', 'duplicates.csv'),
        ]
        
        for dup in pair_b:
            cursor.execute("""
                INSERT INTO raw_expenses 
                (bank_account_id, external_id, transaction_date, amount, currency, 
                 raw_merchant_name, raw_description, source, source_file)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, dup)
        
        print(f"   Pair B: 2 raw expenses with -£7.50 on {duplicate_date_3b}")
        
        # Scenario 4: Positive amount duplicates (income)
        print("\n4. Positive Amount Duplicates (Income):")
        income_date = test_date - timedelta(days=19)
        income_dups = [
            (bank_account_id, 'DUP009', income_date, 500.00, 'GBP', 'Freelance Client Ltd', 'Payment received', 'test_import', 'duplicates.csv'),
            (bank_account_id, 'DUP010', income_date, 500.00, 'GBP', 'Freelance Client', 'Invoice payment', 'xlsx_import', 'bank_export.xlsx'),
        ]
        
        for dup in income_dups:
            cursor.execute("""
                INSERT INTO raw_expenses 
                (bank_account_id, external_id, transaction_date, amount, currency, 
                 raw_merchant_name, raw_description, source, source_file)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, dup)
        
        print(f"   Added 2 raw expenses with +£500.00 on {income_date}")
        
        # Scenario 5: Near-duplicates (same date, slightly different amounts) - NOT duplicates
        print("\n5. Near-Duplicates (for comparison - NOT actual duplicates):")
        near_dup_date = test_date - timedelta(days=20)
        near_dups = [
            (bank_account_id, 'NEAR001', near_dup_date, -20.00, 'GBP', 'Uber Ride', 'Trip to airport', 'test_import', 'duplicates.csv'),
            (bank_account_id, 'NEAR002', near_dup_date, -20.50, 'GBP', 'Uber', 'Ride home', 'test_import', 'duplicates.csv'),
        ]
        
        for dup in near_dups:
            cursor.execute("""
                INSERT INTO raw_expenses 
                (bank_account_id, external_id, transaction_date, amount, currency, 
                 raw_merchant_name, raw_description, source, source_file)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, dup)
        
        print(f"   Added 2 near-duplicates (different amounts) on {near_dup_date}")
        
        # Scenario 6: Same amount, different dates - NOT duplicates
        print("\n6. Same Amount, Different Dates (for comparison - NOT duplicates):")
        same_amount = [
            (bank_account_id, 'SAME001', test_date - timedelta(days=21), -10.00, 'GBP', 'Fast Food A', 'Lunch', 'test_import', 'duplicates.csv'),
            (bank_account_id, 'SAME002', test_date - timedelta(days=22), -10.00, 'GBP', 'Fast Food B', 'Dinner', 'test_import', 'duplicates.csv'),
        ]
        
        for dup in same_amount:
            cursor.execute("""
                INSERT INTO raw_expenses 
                (bank_account_id, external_id, transaction_date, amount, currency, 
                 raw_merchant_name, raw_description, source, source_file)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, dup)
        
        print(f"   Added 2 expenses with -£10.00 on different dates")
        
        conn.commit()
        
        print("\n" + "="*70)
        print("Additional duplicate test data added successfully!")
        print("="*70)
        print("\nDuplicate Scenarios Summary:")
        print("1. Triple duplicate: 3 raw expenses with -£15.99 on same date")
        print("2. Raw + Saved: 1 raw + 1 saved expense with -£9.99 on same date")
        print("3. Multiple pairs: 2 pairs of duplicates (different amounts)")
        print("4. Income duplicate: 2 raw expenses with +£500.00 (positive amount)")
        print("5. Near-duplicates: Similar amounts, same date (NOT duplicates)")
        print("6. Same amount: -£10.00 on different dates (NOT duplicates)")
        print("\nTotal new raw expenses added: 15")
        print("\nTo test:")
        print("1. Go to /queue")
        print("2. Click Tools > Find Duplicates")
        print("3. Check 'Show Duplicates Only' filter")
        print("4. Review all duplicate scenarios!")
        print("="*70)
        
    except Exception as e:
        print(f"Error adding test data: {e}")
        import traceback
        traceback.print_exc()
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    add_duplicate_test_data()
