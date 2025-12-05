import os
from pathlib import Path

class Settings:
    # Database
    DATABASE_URL = "sqlite:///./data/expenses.db"
    DATABASE_PATH = Path("./data/expenses.db")
    
    # Directories
    BASE_DIR = Path(__file__).parent.parent
    IMPORTS_DIR = BASE_DIR / "imports"
    STATIC_DIR = BASE_DIR / "app" / "static"
    
    # API Settings
    API_V1_STR = "/api"
    PROJECT_NAME = "Expense Toolkit"
    
    # GoCardless Bank Data API (Nordigen)
    GOCARDLESS_SECRET_ID = os.getenv("GOCARDLESS_SECRET_ID", "")
    GOCARDLESS_SECRET_KEY = os.getenv("GOCARDLESS_SECRET_KEY", "")
    GOCARDLESS_BASE_URL = "https://bankaccountdata.gocardless.com/api/v2"
    
    # Application settings
    DEFAULT_CURRENCY = "GBP"
    PAGE_SIZE = 50
    
    def __init__(self):
        # Ensure directories exist
        self.DATABASE_PATH.parent.mkdir(exist_ok=True)
        self.IMPORTS_DIR.mkdir(exist_ok=True)

settings = Settings()