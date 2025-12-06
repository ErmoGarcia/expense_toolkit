"""
Import service for processing bank statement files.
Handles file parsing, duplicate detection, and RawExpense creation.
"""
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Tuple, List

from sqlalchemy.orm import Session

from ..models.expense import RawExpense
from ..models.import_history import ImportHistory
from ..models.bank_account import BankAccount
from .bank_parsers import parse_bank_file


def process_import(
    import_record: ImportHistory,
    filepath: Path,
    db: Session
) -> Tuple[int, int, str]:
    """
    Process an import file and create RawExpense records.
    
    Args:
        import_record: The ImportHistory record for this import
        filepath: Path to the file to process
        db: Database session
    
    Returns:
        Tuple of (records_imported, records_skipped, bank_name)
    """
    # Update status to processing
    import_record.status = "processing"
    db.commit()
    
    try:
        # Parse the file
        bank_name, transactions = parse_bank_file(filepath)
        
        # Get or create bank account
        bank_account = get_or_create_bank_account(bank_name, db)
        
        # Update import record with bank account
        if import_record.bank_account_id is None:
            import_record.bank_account_id = bank_account.id
        
        records_imported = 0
        records_skipped = 0
        
        # Track external_ids seen in this import to handle duplicates within the same file
        seen_in_this_import = set()
        
        for tx in transactions:
            external_id = tx['external_id']
            
            # Skip if we've already seen this external_id in this import
            if external_id in seen_in_this_import:
                records_skipped += 1
                continue
            
            # Check for duplicates in the database
            existing = db.query(RawExpense).filter(
                RawExpense.bank_account_id == bank_account.id,
                RawExpense.external_id == external_id
            ).first()
            
            if existing:
                records_skipped += 1
                seen_in_this_import.add(external_id)
                continue
            
            # Create RawExpense
            raw_expense = RawExpense(
                bank_account_id=bank_account.id,
                external_id=external_id,
                transaction_date=tx['transaction_date'],
                amount=tx['amount'],
                currency=tx['currency'],
                raw_merchant_name=tx['raw_merchant_name'],
                raw_description=tx['raw_description'],
                source='xlsx_import',
                source_file=import_record.stored_filename
            )
            db.add(raw_expense)
            records_imported += 1
            seen_in_this_import.add(external_id)
        
        # Update import record
        import_record.status = "completed"
        import_record.records_imported = records_imported
        import_record.records_skipped = records_skipped
        import_record.processed_at = datetime.now()
        
        db.commit()
        
        return records_imported, records_skipped, bank_name
        
    except Exception as e:
        import_record.status = "failed"
        import_record.error_message = str(e)
        db.commit()
        raise


def get_or_create_bank_account(bank_name: str, db: Session) -> BankAccount:
    """Get existing bank account or create a new one"""
    account = db.query(BankAccount).filter(
        BankAccount.bank_name == bank_name
    ).first()
    
    if account is None:
        account = BankAccount(
            name=f"{bank_name} Account",
            bank_name=bank_name,
            account_type="checking"
        )
        db.add(account)
        db.flush()
    
    return account


def get_pending_imports(db: Session) -> List[ImportHistory]:
    """Get all imports that need processing"""
    return db.query(ImportHistory).filter(
        ImportHistory.status == "pending"
    ).order_by(ImportHistory.imported_at.asc()).all()
