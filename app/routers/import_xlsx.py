from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.bank_account import BankAccount
from ..models.import_history import ImportHistory

router = APIRouter()

@router.post("/xlsx")
async def upload_xlsx(
    file: UploadFile = File(...),
    bank_account_id: int = 1,  # Default for now
    db: Session = Depends(get_db)
):
    """Upload and process an XLSX file"""
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="File must be an Excel file (.xlsx or .xls)")
    
    # For now, just return a placeholder response
    # The actual implementation would use the xlsx_parser service
    return {
        "message": f"File {file.filename} uploaded successfully",
        "filename": file.filename,
        "bank_account_id": bank_account_id,
        "status": "processing"
    }

@router.get("/history")
async def get_import_history(db: Session = Depends(get_db)):
    """Get import history"""
    history = db.query(ImportHistory).order_by(ImportHistory.imported_at.desc()).all()
    return history