# AGENTS.md

## Build/Run Commands
- Install: `pip install -r requirements.txt`
- Run server: `python run.py` (or `uvicorn app.main:app --reload`)
- Setup demo data: `python setup_demo.py`
- No test suite configured; add pytest if needed

## Code Style

### Python (FastAPI backend in `app/`)
- snake_case for functions/variables, PascalCase for classes
- Import order: stdlib, third-party (fastapi, sqlalchemy), local (relative imports)
- Double quotes for strings
- Error handling: HTTPException with appropriate status codes (400, 404)
- No type annotations currently; add them for new code
- SQLAlchemy models: explicit `__tablename__`, relationships via `relationship()`

### JavaScript (frontend in `app/static/`)
- camelCase for variables/functions, PascalCase for classes
- ES6+ class-based architecture, async/await for API calls
- Error handling: try/catch with console.error, alert() for user feedback
