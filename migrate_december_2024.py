"""
Database migration script for December 2024 schema changes.
Run this once to update your existing database.

Changes:
1. Add indexes on frequently filtered columns
2. Note: SQLite does not support altering foreign key constraints after table creation.
   The ondelete="SET NULL" constraints in models will only apply to newly created databases.
   For existing databases, the application handles orphaned references gracefully.
"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "data" / "expenses.db"


def check_index_exists(cursor, index_name):
    """Check if an index already exists."""
    cursor.execute("SELECT name FROM sqlite_master WHERE type='index' AND name=?", (index_name,))
    return cursor.fetchone() is not None


def check_column_exists(cursor, table_name, column_name):
    """Check if a column exists in a table."""
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = [row[1] for row in cursor.fetchall()]
    return column_name in columns


def migrate():
    if not DB_PATH.exists():
        print(f"Database not found at {DB_PATH}")
        print("If this is a fresh install, the schema will be created automatically when you start the app.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    changes_made = 0
    
    try:
        print("Starting December 2024 migration...")
        print("-" * 50)
        
        # 1. Add index on raw_expenses.source
        if not check_index_exists(cursor, "ix_raw_expenses_source"):
            print("Adding index on raw_expenses.source...")
            cursor.execute("CREATE INDEX ix_raw_expenses_source ON raw_expenses(source)")
            changes_made += 1
            print("  ✓ Index created")
        else:
            print("  Index ix_raw_expenses_source already exists")
        
        # 2. Add index on expenses.category_id
        if not check_index_exists(cursor, "ix_expenses_category_id"):
            print("Adding index on expenses.category_id...")
            cursor.execute("CREATE INDEX ix_expenses_category_id ON expenses(category_id)")
            changes_made += 1
            print("  ✓ Index created")
        else:
            print("  Index ix_expenses_category_id already exists")
        
        # 3. Add index on expenses.merchant_alias_id
        if not check_index_exists(cursor, "ix_expenses_merchant_alias_id"):
            print("Adding index on expenses.merchant_alias_id...")
            cursor.execute("CREATE INDEX ix_expenses_merchant_alias_id ON expenses(merchant_alias_id)")
            changes_made += 1
            print("  ✓ Index created")
        else:
            print("  Index ix_expenses_merchant_alias_id already exists")
        
        # 4. Add index on expenses.archived
        if not check_index_exists(cursor, "ix_expenses_archived"):
            print("Adding index on expenses.archived...")
            cursor.execute("CREATE INDEX ix_expenses_archived ON expenses(archived)")
            changes_made += 1
            print("  ✓ Index created")
        else:
            print("  Index ix_expenses_archived already exists")
        
        # 5. Add index on raw_notifications.is_processed
        if not check_index_exists(cursor, "ix_raw_notifications_is_processed"):
            print("Adding index on raw_notifications.is_processed...")
            cursor.execute("CREATE INDEX ix_raw_notifications_is_processed ON raw_notifications(is_processed)")
            changes_made += 1
            print("  ✓ Index created")
        else:
            print("  Index ix_raw_notifications_is_processed already exists")
        
        conn.commit()
        
        print("-" * 50)
        if changes_made > 0:
            print(f"Migration completed! {changes_made} change(s) applied.")
        else:
            print("No changes needed - database is already up to date.")
        
        print("\nNote: Foreign key ON DELETE constraints cannot be altered in SQLite.")
        print("The updated model constraints (ondelete='SET NULL') will apply to:")
        print("  - New databases created from scratch")
        print("  - The application handles orphaned references gracefully regardless")
        
    except Exception as e:
        print(f"Error during migration: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()


def show_current_indexes():
    """Display all current indexes in the database."""
    if not DB_PATH.exists():
        print(f"Database not found at {DB_PATH}")
        return
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL ORDER BY tbl_name")
        indexes = cursor.fetchall()
        
        print("\nCurrent indexes in database:")
        print("-" * 50)
        for name, table, sql in indexes:
            print(f"  {table}.{name}")
        print("-" * 50)
        print(f"Total: {len(indexes)} indexes")
        
    finally:
        conn.close()


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--show-indexes":
        show_current_indexes()
    else:
        migrate()
