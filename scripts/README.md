# Utility Scripts

This directory contains utility scripts for development, testing, and database management.

## Setup & Demo Data

### setup_demo.py
Creates a complete demo dataset for testing the application.

**Usage:**
```bash
python scripts/setup_demo.py
```

**What it creates:**
- Sample bank account (Barclays Main Checking)
- 8 expense categories (Groceries, Transport, Utilities, etc.)
- 6 tags (recurring, essential, luxury, household, work, family)
- 10 raw expenses ready to process in the queue
- Sample merchant aliases

**Use case:** Setting up a fresh installation for testing or demonstration.

---

### add_test_data.py
Adds additional test expenses to an existing database.

**Usage:**
```bash
python scripts/add_test_data.py
```

**What it adds:**
- Additional raw expenses with various patterns
- Multiple merchants and categories
- Test data for different scenarios

**Use case:** Adding more test data to an existing development database.

---

### add_more_duplicates.py
Adds comprehensive duplicate expense scenarios for testing duplicate detection.

**Usage:**
```bash
python scripts/add_more_duplicates.py
```

**What it creates:**
- Triple duplicates (3 expenses with same amount/date)
- Raw + Saved duplicates
- Multiple duplicate pairs
- Positive amount duplicates (income)
- Near-duplicates (for comparison)
- Same amount, different dates (not duplicates)

**Use case:** Testing the duplicate detection and resolution features.

---

## Database Management

### migrate_existing_db.py
One-time helper script for migrating existing databases to Alembic.

**Usage:**
```bash
python scripts/migrate_existing_db.py
```

**What it does:**
- Checks if database exists
- Stamps the database at the latest Alembic revision
- Marks all migrations as applied

**Use case:** Upgrading from pre-Alembic setup (before proper migrations were configured).

**Note:** Only run this ONCE if you have an existing database. For new installations, migrations run automatically.

---

## Development Tools

### parse_bank_cli.py
CLI tool for testing bank file parsers without importing into the database.

**Usage:**
```bash
python scripts/parse_bank_cli.py <bank_file>
```

**What it does:**
- Parses various bank export formats (XLSX, XLS, CSV)
- Displays parsed transactions in a formatted table
- Shows detected bank format and parsing details
- Useful for debugging parser issues

**Supported formats:**
- Bankinter XLSX
- Bankinter Credit Card XLS
- Openbank XLS
- Revolut CSV

**Use case:** Testing and debugging bank file parsers during development.

---

## Running Scripts

All scripts should be run from the **project root directory**:

```bash
# Good
python scripts/setup_demo.py

# Also works
cd scripts && python setup_demo.py
```

Most scripts require the virtual environment to be activated or use the venv Python:

```bash
# Activate venv first
source .venv/bin/activate
python scripts/setup_demo.py

# Or use venv Python directly
.venv/bin/python scripts/setup_demo.py
```

---

## Development Workflow

### Initial Setup
1. Install dependencies: `pip install -r requirements.txt`
2. Run setup script: `python scripts/setup_demo.py`
3. Start the server: `python run.py`

### Adding Test Data
```bash
python scripts/add_test_data.py          # Add general test expenses
python scripts/add_more_duplicates.py     # Add duplicate scenarios
```

### Testing Bank Parsers
```bash
python scripts/parse_bank_cli.py examples/bankinter.xlsx
python scripts/parse_bank_cli.py examples/revolut.csv
```

### Migrating Existing Database
```bash
# Only needed once when upgrading from pre-Alembic setup
python scripts/migrate_existing_db.py
```

---

## Notes

- These scripts are for **development and testing only**
- They modify the database directly
- Some scripts assume certain data exists (e.g., bank accounts, categories)
- Always backup your database before running scripts on production data
- The `setup_demo.py` script is safe to run multiple times (it checks for existing data)
