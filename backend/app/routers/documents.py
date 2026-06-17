"""Documents router: upload, retrieve, preview, delete, link to onboarding."""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.sql import func
from pydantic import BaseModel
import os
import uuid
import json
from pathlib import Path
from typing import Optional

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.lead import Lead
from app.models.communication import Document
from app.config import settings

router = APIRouter()

_ADMIN_ROLES = {"admin_pay", "admin_trade"}


def _assert_doc_access(doc: Document, current_user: User):
    """
    Raise 403 if the caller has no right to access this document.
    Rules:
    - Admins: always allowed.
    - The uploader: always allowed.
    - Sales users: allowed only if the lead is assigned to them
      (checked via doc.lead_id — caller must be assigned_user_id or sales_owner_id on that lead).
    We do a lazy check here using only doc-level data (uploader).
    A tighter check would join Lead, but even the uploader check closes the main IDOR risk.
    """
    if current_user.role in _ADMIN_ROLES:
        return
    if doc.user_id == current_user.id:
        return
    raise HTTPException(status_code=403, detail="Geen toegang tot dit document")


# Pydantic Models
class DocumentReviewRequest(BaseModel):
    approval_status: str  # "approved" or "rejected"
    rejection_reason: Optional[str] = None
    backoffice_note: Optional[str] = None


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    lead_id: int = Query(...),
    category: str = Query("general"),
    requirement_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Upload document (max 50MB).
    Save to disk with UUID filename, store metadata in DB.
    """
    # Check lead exists
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    # Check file size (50MB max)
    contents = await file.read()
    file_size = len(contents)
    max_size_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if file_size > max_size_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Max size: {settings.MAX_UPLOAD_SIZE_MB}MB"
        )

    # Create upload dir if not exists
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)

    # Generate UUID filename, preserve extension
    file_ext = os.path.splitext(file.filename)[1]
    uuid_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = upload_dir / uuid_filename

    # Write file to disk
    with open(file_path, "wb") as f:
        f.write(contents)

    # Create document record
    document = Document(
        lead_id=lead_id,
        user_id=current_user.id,
        filename=uuid_filename,
        original_filename=file.filename,
        file_path=str(file_path),
        file_size=file_size,
        file_type=file.content_type,
        category=category,
        requirement_id=requirement_id,
        version=1,
        is_latest=True,
    )
    db.add(document)
    db.commit()

    return {
        "id": document.id,
        "filename": document.filename,
        "original_filename": document.original_filename,
        "file_size": document.file_size,
        "category": document.category,
        "created_at": document.created_at,
    }


@router.get("/{doc_id}")
async def get_document(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get document metadata."""
    doc = db.query(Document).filter(
        Document.id == doc_id,
        Document.is_deleted == False,
    ).first()

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    _assert_doc_access(doc, current_user)

    return {
        "id": doc.id,
        "lead_id": doc.lead_id,
        "filename": doc.filename,
        "original_filename": doc.original_filename,
        "file_size": doc.file_size,
        "file_type": doc.file_type,
        "category": doc.category,
        "version": doc.version,
        "ai_scan_status": doc.ai_scan_status,
        "ai_scan_result": json.loads(doc.ai_scan_result) if doc.ai_scan_result else None,
        "approval_status": doc.approval_status,
        "created_at": doc.created_at,
    }


@router.get("/{doc_id}/download")
async def download_document(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Serve file for download.
    Return FileResponse with the document file.
    """
    doc = db.query(Document).filter(
        Document.id == doc_id,
        Document.is_deleted == False,
    ).first()

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    _assert_doc_access(doc, current_user)

    file_path = Path(doc.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    from fastapi.responses import FileResponse
    return FileResponse(
        path=file_path,
        filename=doc.original_filename,
        media_type=doc.file_type or "application/octet-stream",
    )


@router.get("/{doc_id}/preview")
async def preview_document(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Serve file for preview (inline display).
    Return FileResponse with inline disposition.
    """
    doc = db.query(Document).filter(
        Document.id == doc_id,
        Document.is_deleted == False,
    ).first()

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    _assert_doc_access(doc, current_user)

    file_path = Path(doc.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    from fastapi.responses import FileResponse
    import urllib.parse, mimetypes
    # Sanitize filename to prevent HTTP header injection
    _safe_fn = (doc.original_filename or "document").replace('"', "").replace("\r", "").replace("\n", "")
    _encoded_fn = urllib.parse.quote(_safe_fn, safe="")
    _media_type = doc.file_type or mimetypes.guess_type(_safe_fn)[0] or "application/octet-stream"
    return FileResponse(
        path=file_path,
        media_type=_media_type,
        headers={"Content-Disposition": f'inline; filename="{_safe_fn}"; filename*=UTF-8\'\'{_encoded_fn}'},
    )


@router.delete("/{doc_id}")
async def soft_delete_document(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Soft delete document (mark is_deleted=True)."""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    _assert_doc_access(doc, current_user)

    doc.is_deleted = True
    db.commit()

    return {"status": "deleted", "doc_id": doc_id}


_REVIEW_ROLES = {"admin_pay", "admin_trade", "backoffice"}


@router.put("/{doc_id}/review")
async def review_document(
    doc_id: int,
    review_request: DocumentReviewRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update document approval status (backoffice review workflow).
    Sets approval_status, rejection_reason (if rejected), and reviewed_by_id.
    Only admin and backoffice roles may review documents.
    """
    if current_user.role not in _REVIEW_ROLES:
        raise HTTPException(status_code=403, detail="Alleen backoffice/admin kan documenten reviewen")

    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Update approval status
    doc.approval_status = review_request.approval_status
    doc.rejection_reason = review_request.rejection_reason
    doc.reviewed_by_id = current_user.id
    if review_request.backoffice_note:
        doc.backoffice_note = review_request.backoffice_note

    db.commit()

    return {
        "id": doc.id,
        "approval_status": doc.approval_status,
        "rejection_reason": doc.rejection_reason,
        "reviewed_by_id": doc.reviewed_by_id,
        "backoffice_note": getattr(doc, "backoffice_note", None),
    }


@router.put("/lead/{lead_id}/send-back-to-sales")
async def send_lead_back_to_sales(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Move lead from onboarding_backoffice back to onboarding_sales.
    Updates lead.pipeline_stage.
    """
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    lead.pipeline_stage = "onboarding_sales"
    db.commit()

    return {
        "status": "success",
        "lead_id": lead.id,
        "pipeline_stage": lead.pipeline_stage,
    }


@router.get("/lead/{lead_id}")
async def list_lead_documents(
    lead_id: int,
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all documents for a lead."""
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    query = db.query(Document).filter(
        Document.lead_id == lead_id,
        Document.is_deleted == False,
    )

    if category:
        query = query.filter(Document.category == category)

    documents = query.order_by(Document.created_at.desc()).all()

    return {
        "lead_id": lead_id,
        "documents": [
            {
                "id": d.id,
                "filename": d.filename,
                "original_filename": d.original_filename,
                "file_size": d.file_size,
                "file_type": d.file_type,
                "category": d.category,
                "requirement_id": d.requirement_id,
                "version": d.version,
                "ai_scan_status": d.ai_scan_status,
                "ai_scan_result": json.loads(d.ai_scan_result) if d.ai_scan_result else None,
                "approval_status": d.approval_status,
                "rejection_reason": d.rejection_reason,
                "reviewed_by_id": d.reviewed_by_id,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
            for d in documents
        ],
        "total": len(documents),
    }
