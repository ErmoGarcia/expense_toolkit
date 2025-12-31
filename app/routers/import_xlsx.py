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
    Upload and store an XLSX/CSV file for later processing.
    The file is saved to disk and an import history record is created.
    Actual parsing will be done in a separate step once format is configured.
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
        status="pending",  # pending, processing, completed, failed
        records_imported=None,
        records_skipped=None
    )
    
    db.add(import_record)
    db.commit()
    db.refresh(import_record)
    
    return {
        "id": import_record.id,
        "message": f"File '{file.filename}' uploaded successfully",
        "original_filename": file.filename,
        "stored_filename": stored_filename,
        "bank_account_id": bank_account_id,
        "status": "pending",
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


@router.get("/pending")
async def get_pending_imports(db: Session = Depends(get_db)):
    """Get all pending imports that need processing"""
    pending = db.query(ImportHistory).filter(
        ImportHistory.status == "pending"
    ).order_by(ImportHistory.imported_at.asc()).all()
    
    return pending


@router.get("/bank-accounts")
async def get_bank_accounts(db: Session = Depends(get_db)):
    """Get all bank accounts for the import dropdown"""
    accounts = db.query(BankAccount).all()
    return accounts


@router.post("/process/{import_id}")
async def process_import_file(import_id: int, db: Session = Depends(get_db)):
    """Process a pending import file"""
    record = db.query(ImportHistory).filter(ImportHistory.id == import_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Import record not found")
    
    if record.status != "pending":
        raise HTTPException(
            status_code=400, 
            detail=f"Import already processed (status: {record.status})"
        )
    
    if not record.stored_filename:
        raise HTTPException(status_code=400, detail="No stored filename for this import")
    
    filepath = settings.XLSX_DIR / record.stored_filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Import file not found on disk")
    
    try:
        records_imported, records_skipped, bank_name = process_import(record, filepath, db)
        return {
            "message": "Import processed successfully",
            "bank_name": bank_name,
            "records_imported": records_imported,
            "records_skipped": records_skipped
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # Log the error in production
        raise HTTPException(status_code=500, detail="Processing failed. Please check the file format.")


@router.post("/process-all")
async def process_all_pending(db: Session = Depends(get_db)):
    """Process all pending imports"""
    pending = db.query(ImportHistory).filter(
        ImportHistory.status == "pending"
    ).order_by(ImportHistory.imported_at.asc()).all()
    
    if not pending:
        return {"message": "No pending imports to process", "processed": 0}
    
    results = []
    for record in pending:
        if not record.stored_filename:
            results.append({
                "id": record.id,
                "filename": record.filename,
                "status": "error",
                "error": "No stored filename"
            })
            continue
            
        filepath = settings.XLSX_DIR / record.stored_filename
        if not filepath.exists():
            results.append({
                "id": record.id,
                "filename": record.filename,
                "status": "error",
                "error": "File not found"
            })
            continue
        
        try:
            records_imported, records_skipped, bank_name = process_import(record, filepath, db)
            results.append({
                "id": record.id,
                "filename": record.filename,
                "status": "completed",
                "bank_name": bank_name,
                "records_imported": records_imported,
                "records_skipped": records_skipped
            })
        except Exception as e:
            results.append({
                "id": record.id,
                "filename": record.filename,
                "status": "error",
                "error": "Processing failed"
            })
    
    return {
        "message": f"Processed {len(results)} imports",
        "results": results
    }
