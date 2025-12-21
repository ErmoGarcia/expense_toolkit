"""
Migration script to add category_type column to categories table.
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
        # Check if column already exists
        cursor.execute("PRAGMA table_info(categories)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if "category_type" in columns:
            print("Column 'category_type' already exists. Skipping migration.")
            return
        
        # Add category_type column with default value 'expense'
        print("Adding 'category_type' column to categories table...")
        cursor.execute("""
            ALTER TABLE categories 
            ADD COLUMN category_type VARCHAR DEFAULT 'expense'
        """)
        
        # Update existing categories to be 'expense' type
        cursor.execute("""
            UPDATE categories 
            SET category_type = 'expense'
            WHERE category_type IS NULL
        """)
        
        conn.commit()
        print("Migration completed successfully!")
        print("All existing categories have been set to 'expense' type.")
        print("You can now manually update any categories that should be 'income' type.")
        
    except Exception as e:
        print(f"Error during migration: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
