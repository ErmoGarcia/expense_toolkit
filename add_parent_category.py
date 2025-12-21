"""
Migration script to add parent_id column to categories table for subcategory support.
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
        
        if "parent_id" in columns:
            print("Column 'parent_id' already exists. Skipping migration.")
            return
        
        # Add parent_id column
        print("Adding 'parent_id' column to categories table...")
        cursor.execute("""
            ALTER TABLE categories 
            ADD COLUMN parent_id INTEGER
        """)
        
        # Add foreign key index for better performance
        print("Creating index on parent_id...")
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_categories_parent_id 
            ON categories(parent_id)
        """)
        
        conn.commit()
        print("Migration completed successfully!")
        print("Categories now support parent-child relationships for subcategories.")
        
    except Exception as e:
        print(f"Error during migration: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
