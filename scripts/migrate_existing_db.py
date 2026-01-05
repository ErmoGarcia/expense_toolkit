"""
Migration helper for existing databases.
Run this ONCE if you have an existing database from before Alembic was set up.
"""
import subprocess
import sys
from pathlib import Path

def main():
    print("="*70)
    print("Expense Toolkit - Database Migration Helper")
    print("="*70)
    print()
    print("This script will mark your existing database as up-to-date with")
    print("the latest Alembic migrations.")
    print()
    print("⚠️  WARNING: Only run this if you have an EXISTING database that")
    print("   was created before Alembic was configured.")
    print()
    print("   If you're setting up a fresh database, just start the app -")
    print("   migrations will run automatically.")
    print()
    
    response = input("Continue? (yes/no): ").strip().lower()
    if response != 'yes':
        print("Cancelled.")
        return
    
    # Get project root (parent of scripts directory)
    project_root = Path(__file__).parent.parent
    db_path = project_root / "data" / "expenses.db"
    
    if not db_path.exists():
        print(f"\n❌ Database not found at {db_path}")
        print("   No migration needed. The database will be created automatically")
        print("   when you start the app.")
        return
    
    print(f"\n✓ Found database at {db_path}")
    print("\nStamping database as up-to-date...")
    
    try:
        # Stamp the database at the head revision
        subprocess.run(
            [".venv/bin/python", "-m", "alembic", "stamp", "head"],
            check=True,
            cwd=project_root
        )
        
        print("\n" + "="*70)
        print("✓ Migration complete!")
        print("="*70)
        print("\nYour database has been marked as up-to-date.")
        print("Future migrations will run automatically when you start the app.")
        print()
        
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Error during migration: {e}")
        print("\nPlease check the error message above and try again.")
        sys.exit(1)

if __name__ == "__main__":
    main()
