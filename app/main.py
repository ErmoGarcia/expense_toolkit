from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from .config import settings
from .database import create_tables
from .routers import expenses, queue, categories, tags, merchants, import_xlsx, notifications

# Create FastAPI app
app = FastAPI(title=settings.PROJECT_NAME)

# Create database tables on startup
@app.on_event("startup")
async def startup_event():
    create_tables()

# Include API routers
app.include_router(expenses.router, prefix=f"{settings.API_V1_STR}/expenses", tags=["expenses"])
app.include_router(queue.router, prefix=f"{settings.API_V1_STR}/queue", tags=["queue"])
app.include_router(categories.router, prefix=f"{settings.API_V1_STR}/categories", tags=["categories"])
app.include_router(tags.router, prefix=f"{settings.API_V1_STR}/tags", tags=["tags"])
app.include_router(merchants.router, prefix=f"{settings.API_V1_STR}/merchants", tags=["merchants"])
app.include_router(import_xlsx.router, prefix=f"{settings.API_V1_STR}/import", tags=["import"])
app.include_router(notifications.router, prefix=f"{settings.API_V1_STR}/notifications", tags=["notifications"])

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
