"""
Migration script to add update-mode fields to raw_expenses table.
Adds: tags, category_id, merchant_alias_id, description
Run this script once to update the database schema.
"""

import sqlite3
from pathlib import Path

# Get database path
db_path = Path(__file__).parent / "data" / "expenses.db"

def migrate():
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check existing columns
        cursor.execute("PRAGMA table_info(raw_expenses)")
        columns = [col[1] for col in cursor.fetchall()]
        
        # Add tags column (JSON stored as TEXT in SQLite)
        if "tags" not in columns:
            print("Adding 'tags' column...")
            cursor.execute("ALTER TABLE raw_expenses ADD COLUMN tags TEXT DEFAULT '[]'")
        else:
            print("Column 'tags' already exists. Skipping.")
        
        # Add category_id column
        if "category_id" not in columns:
            print("Adding 'category_id' column...")
            cursor.execute("ALTER TABLE raw_expenses ADD COLUMN category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL")
        else:
            print("Column 'category_id' already exists. Skipping.")
        
        # Add merchant_alias_id column
        if "merchant_alias_id" not in columns:
            print("Adding 'merchant_alias_id' column...")
            cursor.execute("ALTER TABLE raw_expenses ADD COLUMN merchant_alias_id INTEGER REFERENCES merchant_aliases(id) ON DELETE SET NULL")
        else:
            print("Column 'merchant_alias_id' already exists. Skipping.")
        
        # Add description column
        if "description" not in columns:
            print("Adding 'description' column...")
            cursor.execute("ALTER TABLE raw_expenses ADD COLUMN description TEXT")
        else:
            print("Column 'description' already exists. Skipping.")
        
        conn.commit()
        print("\nMigration completed successfully!")
        print("New fields added to raw_expenses table for update mode functionality.")
        
    except Exception as e:
        print(f"Error during migration: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
