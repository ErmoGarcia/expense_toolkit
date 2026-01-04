import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models.bank_account import BankAccount
from ..models.import_history import ImportHistory
from ..services.import_service import process_import

router = APIRouter()

# Maximum file size: 10MB
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB in bytes


@router.post("/xlsx")
async def upload_xlsx(
    file: UploadFile = File(...),
    bank_account_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Upload and immediately process an XLSX/CSV file.
    The file is saved to disk, an import history record is created,
    and the file is processed immediately to create RawExpense records.
    """
    # Validate file is provided
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    # Validate file extension
    valid_extensions = ('.xlsx', '.xls', '.csv')
    filename_lower = file.filename.lower()
    if not filename_lower.endswith(valid_extensions):
        raise HTTPException(
            status_code=400, 
            detail=f"File must be one of: {', '.join(valid_extensions)}"
        )
    
    # Read file content with size limit
    content = await file.read()
    
    # Check file size
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File size exceeds maximum allowed size of {MAX_FILE_SIZE // (1024 * 1024)}MB"
        )
    
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="File is empty")
    
    # Generate unique filename
    timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    unique_id = uuid.uuid4().hex[:8]
    extension = file.filename.rsplit('.', 1)[-1].lower()
    stored_filename = f"{timestamp_str}_{unique_id}.{extension}"
    filepath = settings.XLSX_DIR / stored_filename
    
    # Save file to disk
    with open(filepath, "wb") as f:
        f.write(content)
    
    # Create import history record
    import_record = ImportHistory(
        filename=file.filename,
        stored_filename=stored_filename,
        bank_account_id=bank_account_id,
        file_size=len(content),
        status="pending",
        records_imported=None,
        records_skipped=None
    )
    
    db.add(import_record)
    db.commit()
    db.refresh(import_record)
    
    # Immediately process the file
    try:
        records_imported, records_skipped, bank_name = process_import(import_record, filepath, db)
        
        return {
            "id": import_record.id,
            "message": f"File '{file.filename}' uploaded and processed successfully",
            "original_filename": file.filename,
            "stored_filename": stored_filename,
            "bank_account_id": import_record.bank_account_id,
            "bank_name": bank_name,
            "status": "completed",
            "records_imported": records_imported,
            "records_skipped": records_skipped,
            "file_size": len(content)
        }
    except Exception as e:
        # Import record is already marked as failed by process_import
        print(f"Error processing import {import_record.id}: {e}")
        db.refresh(import_record)
        
        return {
            "id": import_record.id,
            "message": f"File uploaded but processing failed: {str(e)}",
            "original_filename": file.filename,
            "stored_filename": stored_filename,
            "status": "failed",
            "error": str(e),
            "file_size": len(content)
        }


@router.get("/history")
async def get_import_history(db: Session = Depends(get_db)):
    """Get import history"""
    history = db.query(ImportHistory).order_by(ImportHistory.imported_at.desc()).all()
    return history


@router.get("/history/{import_id}")
async def get_import_record(import_id: int, db: Session = Depends(get_db)):
    """Get a specific import record"""
    record = db.query(ImportHistory).filter(ImportHistory.id == import_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Import record not found")
    return record


@router.delete("/history/{import_id}")
async def delete_import_record(import_id: int, db: Session = Depends(get_db)):
    """Delete an import record and its file"""
    record = db.query(ImportHistory).filter(ImportHistory.id == import_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Import record not found")
    
    # Delete the stored file if it exists
    if record.stored_filename:
        filepath = settings.XLSX_DIR / record.stored_filename
        if filepath.exists():
            filepath.unlink()
    
    db.delete(record)
    db.commit()
    
    return {"message": "Import record deleted"}


@router.get("/bank-accounts")
async def get_bank_accounts(db: Session = Depends(get_db)):
    """Get all bank accounts for the import dropdown"""
    accounts = db.query(BankAccount).all()
    return accounts
