"""
Database migration script to add archived column to expenses table.
Run this once to update your existing database.
"""
import sqlite3

DB_PATH = "data/expenses.db"

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check if column exists
        cursor.execute("PRAGMA table_info(expenses)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if "archived" not in columns:
            print("Adding 'archived' column to expenses table...")
            cursor.execute("ALTER TABLE expenses ADD COLUMN archived BOOLEAN DEFAULT 0")
            conn.commit()
            print("✓ Column added successfully!")
        else:
            print("'archived' column already exists. No migration needed.")
    
    except Exception as e:
        print(f"Error during migration: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
