import os
from pathlib import Path

class Settings:
    # Directories
    BASE_DIR = Path(__file__).parent.parent
    
    # Database - use absolute path based on BASE_DIR
    DATA_DIR = BASE_DIR / "data"
    DATABASE_PATH = DATA_DIR / "expenses.db"
    DATABASE_URL = f"sqlite:///{DATABASE_PATH}"
    IMPORTS_DIR = BASE_DIR / "imports"
    XLSX_DIR = IMPORTS_DIR / "xlsx"
    NOTIFICATIONS_DIR = IMPORTS_DIR / "notifications"
    STATIC_DIR = BASE_DIR / "app" / "static"
    LOG_DIR = BASE_DIR / "logs"
    
    # Environment
    ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
    
    # Server settings
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", "8000"))
    
    # API Settings
    API_V1_STR = "/api"
    PROJECT_NAME = "Expense Toolkit"
    VERSION = "1.0.0"
    
    # Logging
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    
    # GoCardless Bank Data API (Nordigen) - keeping for potential future use
    GOCARDLESS_SECRET_ID = os.getenv("GOCARDLESS_SECRET_ID", "")
    GOCARDLESS_SECRET_KEY = os.getenv("GOCARDLESS_SECRET_KEY", "")
    GOCARDLESS_BASE_URL = "https://bankaccountdata.gocardless.com/api/v2"
    
    # Application settings
    DEFAULT_CURRENCY = "GBP"
    PAGE_SIZE = 50
    
    def __init__(self):
        # Ensure directories exist
        self.DATA_DIR.mkdir(exist_ok=True)
        self.IMPORTS_DIR.mkdir(exist_ok=True)
        self.XLSX_DIR.mkdir(exist_ok=True)
        self.NOTIFICATIONS_DIR.mkdir(exist_ok=True)
        
        # Create log directory only in development mode
        if self.ENVIRONMENT == "development":
            self.LOG_DIR.mkdir(exist_ok=True)

settings = Settings()
