from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings

# Create engine
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False}  # SQLite specific
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create base class for models
Base = declarative_base()

def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def run_migrations():
    """Run any pending database migrations"""
    with engine.connect() as conn:
        # Check if parent_expense_id column exists in expenses table
        result = conn.execute(text("PRAGMA table_info(expenses)"))
        columns = [row[1] for row in result.fetchall()]
        
        if "parent_expense_id" not in columns:
            conn.execute(text("ALTER TABLE expenses ADD COLUMN parent_expense_id INTEGER REFERENCES expenses(id)"))
            conn.commit()

def create_tables():
    """Create all database tables"""
    Base.metadata.create_all(bind=engine)
    run_migrations()