# 💰 Expense Toolkit

A comprehensive personal expense management solution built with Python FastAPI and vanilla HTML/CSS/JavaScript. Designed to help you track, categorize, and analyze your personal expenses with support for both XLSX imports and Open Banking integration.

## 🌟 Features

- **📊 Expense Management**: View, filter, and search your expenses with advanced filtering options
- **⚡ Processing Queue**: FIFO queue system for processing raw expenses manually
- **🏷️ Smart Categorization**: Automatic category suggestions based on merchant aliases
- **🔖 Tagging System**: Flexible tagging for better expense organization
- **🏦 Multi-Bank Support**: Support for multiple bank accounts
- **📋 XLSX Import**: Import expenses from bank XLSX/CSV exports (planned)
- **🔗 Open Banking**: Automatic expense fetching via GoCardless Bank Account Data API (planned)
- **🧠 Merchant Recognition**: Fuzzy matching for merchant aliases with learning capabilities
- **📱 Responsive UI**: Clean, mobile-friendly interface

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           FRONTEND                                   │
│                    (Pure HTML/CSS/JavaScript)                        │
│  ┌─────────────────────┐    ┌─────────────────────────────────────┐ │
│  │   Expenses View     │    │        Processing Queue             │ │
│  │  - Filter/Search    │    │  - FIFO expense review              │ │
│  │  - Category filter  │    │  - Add description/category/tags    │ │
│  │  - Tag filter       │    │  - Merchant alias management        │ │
│  │  - Date range       │    │                                     │ │
│  └─────────────────────┘    └─────────────────────────────────────┘ │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │ AJAX (fetch API)
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      PYTHON BACKEND (FastAPI)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────────┐ │
│  │  REST API    │  │   Ingestion  │  │    Background Workers      │ │
│  │  Endpoints   │  │   Services   │  │  - Open Banking polling    │ │
│  └──────────────┘  └──────────────┘  └────────────────────────────┘ │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         ▼                         ▼                         ▼
┌─────────────────┐    ┌─────────────────────┐    ┌─────────────────┐
│  XLSX Importer  │    │   SQLite Database   │    │  GoCardless     │
│  (planned)      │    │                     │    │  Bank Data API  │
└─────────────────┘    └─────────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Python 3.8+
- Virtual environment (recommended)

### Installation

1. **Clone/Navigate to the project directory**
   ```bash
   cd /home/ermodev/Projects/expense_toolkit
   ```

2. **Set up virtual environment** (if not already done)
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\\Scripts\\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up demo data**
   ```bash
   python setup_demo.py
   ```

5. **Run the server**
   ```bash
   python run.py
   ```
   
   Or manually:
   ```bash
   ./venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

6. **Open your browser**
   - Main application: http://localhost:8000
   - Processing queue: http://localhost:8000/queue
   - API documentation: http://localhost:8000/docs

## 📊 Demo Data

The project includes a demo setup script that creates:

- **8 Categories**: Groceries, Transport, Utilities, Entertainment, etc.
- **6 Tags**: recurring, essential, luxury, household, work, family
- **1 Bank Account**: "Main Checking" (Barclays)
- **10 Sample Raw Expenses**: Ready to process in the queue

Sample expenses include transactions from Tesco, Amazon, Spotify, TFL, McDonald's, and more.

## 🔄 Processing Workflow

1. **Raw Expenses**: Import from XLSX or sync from Open Banking
2. **Processing Queue**: Review expenses in FIFO order
3. **Manual Processing**: Add descriptions, categories, tags, and merchant aliases
4. **Smart Suggestions**: System learns and suggests merchants/categories
5. **Expense Database**: Processed expenses are stored for analysis

## 📁 Project Structure

```
expense_toolkit/
├── app/
│   ├── models/              # SQLAlchemy database models
│   │   ├── category.py      # Expense categories
│   │   ├── expense.py       # Main expense & raw expense models
│   │   ├── merchant.py      # Merchant aliases
│   │   ├── tag.py          # Tags and expense-tag relationships
│   │   ├── bank_account.py  # Bank account information
│   │   └── import_history.py # Track import history
│   │
│   ├── routers/            # FastAPI route handlers
│   │   ├── expenses.py     # Expense CRUD operations
│   │   ├── queue.py        # Processing queue endpoints
│   │   ├── categories.py   # Category management
│   │   ├── tags.py         # Tag management
│   │   ├── merchants.py    # Merchant alias management
│   │   └── import_xlsx.py  # XLSX import endpoints
│   │
│   ├── services/           # Business logic (planned)
│   │   ├── xlsx_parser.py  # XLSX import processing
│   │   ├── gocardless.py   # Open Banking integration
│   │   └── merchant_matcher.py # Fuzzy matching logic
│   │
│   ├── static/             # Frontend assets
│   │   ├── index.html      # Main expenses view
│   │   ├── queue.html      # Processing queue interface
│   │   ├── css/styles.css  # Application styles
│   │   └── js/             # JavaScript files
│   │       ├── expenses.js # Expenses page logic
│   │       └── queue.js    # Queue processing logic
│   │
│   ├── config.py          # Application configuration
│   ├── database.py        # Database connection & setup
│   └── main.py           # FastAPI application entry point
│
├── data/                  # SQLite database location
├── imports/              # XLSX import folder
├── venv/                # Virtual environment
├── requirements.txt     # Python dependencies
├── setup_demo.py       # Demo data creation script
├── run.py              # Server runner script
└── README.md          # This file
```

## 🛠️ API Endpoints

### Expenses
- `GET /api/expenses` - List expenses with filters
- `GET /api/expenses/{id}` - Get single expense
- `PUT /api/expenses/{id}` - Update expense
- `DELETE /api/expenses/{id}` - Delete expense

### Processing Queue
- `GET /api/queue` - Get next raw expense (FIFO)
- `GET /api/queue/count` - Get queue size
- `POST /api/queue/process` - Process raw expense → expense
- `DELETE /api/queue/{id}` - Discard raw expense

### Categories & Tags
- `GET /api/categories` - List categories
- `POST /api/categories` - Create category
- `GET /api/tags` - List tags
- `POST /api/tags` - Create tag

### Merchants
- `GET /api/merchants` - List merchant aliases
- `GET /api/merchants/suggest?raw_name=X` - Suggest alias for raw name

### Import
- `POST /api/import/xlsx` - Upload XLSX file (planned)
- `GET /api/import/history` - Import history

## 🎯 Key Features in Detail

### Processing Queue
- **FIFO Processing**: Expenses processed in order of arrival
- **Smart Suggestions**: Automatic merchant and category suggestions
- **Flexible Tagging**: Add multiple tags per expense
- **Skip/Discard**: Options to skip or permanently discard transactions

### Merchant Learning
- **Fuzzy Matching**: Recognizes similar merchant names (e.g., "AMZN*123" → "Amazon")
- **Default Categories**: Merchants can have default categories
- **Confidence Scoring**: Shows matching confidence percentage

### Filtering & Search
- **Multi-dimensional Filters**: Category, tags, date range, account
- **Real-time Search**: Search descriptions and merchant names
- **Pagination**: Efficient handling of large expense lists

## 🔮 Future Enhancements

### Planned Features
- **XLSX Import**: Support for various bank export formats
- **Open Banking Integration**: Automatic transaction fetching via GoCardless
- **Recurring Expense Detection**: Identify and categorize recurring payments
- **Analytics Dashboard**: Charts and insights on spending patterns
- **Budget Management**: Set and track category budgets
- **Export Functionality**: Export filtered expenses to various formats
- **Receipt Attachment**: Link receipts to expenses
- **Multi-currency Support**: Handle multiple currencies

### Open Banking Integration
The system is designed to integrate with GoCardless Bank Account Data API (formerly Nordigen):

```python
# Example integration
from app.services.gocardless import GoCardlessBankData

# Initialize client
client = GoCardlessBankData(secret_id="your_id", secret_key="your_key")
client.authenticate()

# Fetch transactions
transactions = client.get_transactions(account_id="account_123")

# Convert to raw expenses
client.sync_to_raw_expenses(bank_account_id=1)
```

## 🐛 Known Limitations

- **XLSX Import**: Not yet implemented - placeholder endpoints only
- **Open Banking**: Integration code is stubbed out
- **Authentication**: No user authentication system (single-user application)
- **Data Validation**: Basic validation only
- **Error Handling**: Could be more comprehensive
- **Performance**: Not optimized for very large datasets

## 🤝 Contributing

This is a personal expense management tool, but contributions are welcome:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is for personal use. Please respect any third-party licenses for dependencies.

## 🆘 Support

For issues or questions:
1. Check the console logs for error details
2. Verify your Python environment and dependencies
3. Ensure the SQLite database is writable
4. Check that all required directories exist

## 🧑‍💻 Development

### Running in Development Mode
```bash
# With auto-reload
./venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Access the application
# Main app: http://localhost:8000
# Queue: http://localhost:8000/queue
# API docs: http://localhost:8000/docs
```

### Database Management
```bash
# Create demo data
python setup_demo.py

# The SQLite database is stored in data/expenses.db
# You can inspect it with any SQLite browser
```

### Adding New Features
1. **Models**: Add SQLAlchemy models in `app/models/`
2. **Routes**: Add FastAPI routes in `app/routers/`
3. **Frontend**: Modify HTML/CSS/JS in `app/static/`
4. **Services**: Add business logic in `app/services/`

---

**Happy expense tracking!** 💰📊