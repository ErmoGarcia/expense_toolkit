from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List
from pathlib import Path
from datetime import datetime

router = APIRouter()

@router.post("/upload-tickets")
async def upload_tickets(files: List[UploadFile] = File(None)):
    if not files or len(files) == 0:
        raise HTTPException(status_code=400, detail="No files provided")

    # Create the directory if it doesn't exist
    tickets_dir = Path("imports/tickets")
    tickets_dir.mkdir(parents=True, exist_ok=True)

    uploaded_files = []
    for file in files:
        if not file.filename:
            continue
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        timestamped_filename = f"{timestamp}_{file.filename}"
        file_path = tickets_dir / timestamped_filename
        try:
            with open(file_path, "wb") as f:
                content = await file.read()
                f.write(content)
            uploaded_files.append(timestamped_filename)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to save file {file.filename}: {str(e)}")

    return {"message": f"Uploaded {len(uploaded_files)} ticket photos successfully", "files": uploaded_files}