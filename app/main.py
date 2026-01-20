from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from .config import settings
from .database import create_tables
from .routers import expenses, queue, categories, tags, merchants, import_xlsx, notifications
from .routers.rules import router as rules_router
import logging
import sys
from logging.handlers import RotatingFileHandler

# Create FastAPI app
app = FastAPI(title=settings.PROJECT_NAME, version=settings.VERSION)


def configure_logging():
    """Configure application logging based on environment"""
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
    
    # Get root logger
    logger = logging.getLogger()
    logger.setLevel(log_level)
    
    # Clear any existing handlers
    logger.handlers.clear()
    
    # Create formatter
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Console handler (stdout for journald in production, useful in all environments)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # File handler only in development mode
    if settings.ENVIRONMENT == "development" and settings.LOG_DIR.exists():
        file_handler = RotatingFileHandler(
            settings.LOG_DIR / "expense_toolkit.log",
            maxBytes=10485760,  # 10MB
            backupCount=5
        )
        file_handler.setLevel(log_level)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
        logger.info(f"File logging enabled: {settings.LOG_DIR / 'expense_toolkit.log'}")
    
    return logger


# Create database tables on startup
@app.on_event("startup")
async def startup_event():
    """Initialize application on startup"""
    logger = configure_logging()
    logger.info("=" * 60)
    logger.info(f"Starting {settings.PROJECT_NAME} v{settings.VERSION}")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"Database: {settings.DATABASE_PATH}")
    logger.info(f"Log Level: {settings.LOG_LEVEL}")
    logger.info("=" * 60)
    
    try:
        create_tables()
        logger.info("Database initialization completed successfully")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}", exc_info=True)
        raise
    
    logger.info(f"{settings.PROJECT_NAME} started successfully")
    logger.info(f"API documentation available at: http://{settings.HOST}:{settings.PORT}/docs")

# Include API routers
app.include_router(expenses.router, prefix=f"{settings.API_V1_STR}/expenses", tags=["expenses"])
app.include_router(queue.router, prefix=f"{settings.API_V1_STR}/queue", tags=["queue"])
app.include_router(categories.router, prefix=f"{settings.API_V1_STR}/categories", tags=["categories"])
app.include_router(tags.router, prefix=f"{settings.API_V1_STR}/tags", tags=["tags"])
app.include_router(merchants.router, prefix=f"{settings.API_V1_STR}/merchants", tags=["merchants"])
app.include_router(import_xlsx.router, prefix=f"{settings.API_V1_STR}/import", tags=["import"])
app.include_router(notifications.router, prefix=f"{settings.API_V1_STR}/notifications", tags=["notifications"])
app.include_router(rules_router, prefix=f"{settings.API_V1_STR}/rules", tags=["rules"])

# Mount static files
app.mount("/static", StaticFiles(directory=settings.STATIC_DIR), name="static")

# Serve frontend pages
@app.get("/")
async def read_index():
    return FileResponse(settings.STATIC_DIR / "index.html")

@app.get("/queue")
async def read_queue():
    return FileResponse(settings.STATIC_DIR / "queue.html")

@app.get("/import")
async def read_import():
    return FileResponse(settings.STATIC_DIR / "import.html")

@app.get("/categories")
async def read_categories():
    return FileResponse(settings.STATIC_DIR / "categories.html")

@app.get("/health")
async def health_check():
    """
    Health check endpoint for monitoring and load balancers.
    
    Returns:
        dict: Health status information including version, environment, and database status
    
    Raises:
        HTTPException: 503 if service is unhealthy (e.g., database unreachable)
    """
    logger = logging.getLogger(__name__)
    
    try:
        # Check database connectivity
        from .database import engine
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        
        return {
            "status": "healthy",
            "service": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "environment": settings.ENVIRONMENT,
            "database": "connected"
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=503,
            detail={
                "status": "unhealthy",
                "service": settings.PROJECT_NAME,
                "version": settings.VERSION,
                "error": str(e)
            }
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
