import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Integer, Text, ForeignKey
from app.database import Base


class MedicalDocument(Base):
    """
    A file the patient uploaded: an X-ray or scan image, a surgery or
    discharge report, a lab result. The file itself lives in private
    Supabase Storage; only the doctors caring for the patient can open it.

    For written reports the assistant copies out what the document says
    (`extracted`), so triage and the case statement know about it. It never
    reads or interprets X-ray and scan images; those are for the doctor.
    """
    __tablename__ = "medical_documents"

    id            = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id    = Column(String, ForeignKey("patients.id"), nullable=False, index=True)

    kind          = Column(String, nullable=False)    # see app.routers.documents.KINDS
    title         = Column(String, nullable=False)    # patient's own label, e.g. "Chest X-ray"
    taken_on      = Column(String, nullable=True)     # YYYY-MM or YYYY-MM-DD, as the patient knows it
    facility      = Column(String, nullable=True)     # where it was done
    notes         = Column(Text, nullable=True)       # patient's note, e.g. "for the cough in March"

    storage_path  = Column(String, nullable=False)
    file_name     = Column(String, nullable=True)
    mime_type     = Column(String, nullable=False)
    size_bytes    = Column(Integer, nullable=False)

    # What the assistant copied from a written report. Status: pending /
    # read / not_read (images, or the text could not be read) / failed.
    read_status   = Column(String, default="pending")
    extracted     = Column(Text, nullable=True)       # JSON

    consented_at  = Column(DateTime, nullable=False)  # agreed to storage and doctor access at upload
    uploaded_at   = Column(DateTime, default=datetime.utcnow)
