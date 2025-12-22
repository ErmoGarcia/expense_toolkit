"""
Migration script to add type column to expenses and raw_expenses tables.
This removes periodic_expense functionality and adds expense types (fixed, necessary variable, discretionary).
"""
import sqlite3
from pathlib import Path

def migrate():
    # Use the correct database path
    db_path = Path(__file__).parent / "data" / "expenses.db"
    print(f"Using database: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Start transaction
        cursor.execute("BEGIN TRANSACTION")
        
        # 1. Drop the periodic_expenses table
        print("Dropping periodic_expenses table...")
        cursor.execute("DROP TABLE IF EXISTS periodic_expenses")
        
        # 2. Add type column to raw_expenses table (if it exists)
        print("Adding type column to raw_expenses...")
        # Check if raw_expenses table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='raw_expenses'")
        if cursor.fetchone():
            try:
                cursor.execute("""
                    ALTER TABLE raw_expenses 
                    ADD COLUMN type TEXT CHECK(type IN ('fixed', 'necessary variable', 'discretionary'))
                """)
                print("  Added type column to raw_expenses")
            except sqlite3.OperationalError as e:
                if "duplicate column" in str(e).lower():
                    print("  Column 'type' already exists in raw_expenses, skipping...")
                else:
                    raise
        else:
            print("  raw_expenses table doesn't exist yet, will be created with type column")
        
        # 3. Create new expenses table with type column and without periodic_expense_id
        print("Creating new expenses table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS expenses_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                raw_expense_id INTEGER UNIQUE,
                bank_account_id INTEGER,
                transaction_date DATE NOT NULL,
                amount NUMERIC(10, 2) NOT NULL,
                currency TEXT DEFAULT 'GBP',
                merchant_alias_id INTEGER,
                category_id INTEGER,
                description TEXT,
                notes TEXT,
                latitude REAL,
                longitude REAL,
                parent_expense_id INTEGER,
                is_recurring BOOLEAN DEFAULT 0,
                archived BOOLEAN DEFAULT 0,
                type TEXT CHECK(type IN ('fixed', 'necessary variable', 'discretionary')),
                processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (raw_expense_id) REFERENCES raw_expenses(id),
                FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id),
                FOREIGN KEY (merchant_alias_id) REFERENCES merchant_aliases(id),
                FOREIGN KEY (category_id) REFERENCES categories(id),
                FOREIGN KEY (parent_expense_id) REFERENCES expenses(id)
            )
        """)
        
        # 4. Copy data from old expenses table to new one (excluding periodic_expense_id)
        print("Copying data to new expenses table...")
        cursor.execute("""
            INSERT INTO expenses_new (
                id, raw_expense_id, bank_account_id, transaction_date, amount, currency,
                merchant_alias_id, category_id, description, notes, latitude, longitude,
                parent_expense_id, is_recurring, archived, processed_at, created_at, updated_at
            )
            SELECT 
                id, raw_expense_id, bank_account_id, transaction_date, amount, currency,
                merchant_alias_id, category_id, description, notes, latitude, longitude,
                parent_expense_id, is_recurring, archived, processed_at, created_at, updated_at
            FROM expenses
        """)
        
        # 5. Drop old expenses table and rename new one
        print("Replacing old expenses table...")
        cursor.execute("DROP TABLE expenses")
        cursor.execute("ALTER TABLE expenses_new RENAME TO expenses")
        
        # 6. Recreate indexes on expenses table
        print("Recreating indexes...")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_expenses_transaction_date ON expenses(transaction_date)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON expenses(category_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_expenses_merchant_alias_id ON expenses(merchant_alias_id)")
        
        # Commit transaction
        conn.commit()
        print("\nMigration completed successfully!")
        print("- Removed periodic_expenses table")
        print("- Removed periodic_expense_id column from expenses table")
        print("- Added type column to expenses table")
        print("- Added type column to raw_expenses table")
        
    except Exception as e:
        # Rollback on error
        conn.rollback()
        print(f"\nMigration failed: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
