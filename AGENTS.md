# AGENTS.md

## Build/Run Commands
- Install: `pip install -r requirements.txt`
- Run server: `python run.py` (or `uvicorn app.main:app --reload`)
- Setup demo data: `python scripts/setup_demo.py`
- No test suite configured; add pytest if needed

## Database Migrations
- **System**: Alembic (automatically runs on app startup)
- **Migration files**: `alembic/versions/`
- **Config**: `alembic.ini`, `alembic/env.py`
- **Commands**:
  - Create migration: `.venv/bin/python -m alembic revision -m "description"`
  - Run migrations: `.venv/bin/python -m alembic upgrade head` (or just start the app)
  - Check status: `.venv/bin/python -m alembic current`
  - View history: `.venv/bin/python -m alembic history`
- **Important**: When adding new models or changing schemas:
  1. Update the model in `app/models/`
  2. Create an Alembic migration with the changes
  3. Migrations will run automatically on next app start
- **For existing databases**: Run `python scripts/migrate_existing_db.py` once if upgrading from pre-Alembic setup

## Utility Scripts
Located in `scripts/` directory:
- `setup_demo.py` - Create demo data for testing
- `add_test_data.py` - Add additional test expenses
- `add_more_duplicates.py` - Add duplicate test scenarios
- `parse_bank_cli.py` - CLI tool for testing bank file parsers
- `migrate_existing_db.py` - One-time migration helper for existing databases

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
