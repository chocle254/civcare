import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text
from app.database import Base


class DataAccessLog(Base):
    """
    Who opened or changed a patient's record, and when. Patients can read
    their own log (Profile → Privacy), and it is the trail used to
    investigate a suspected breach.
    """
    __tablename__ = "data_access_log"

    id         = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = Column(String, index=True, nullable=False)
    actor_id   = Column(String, nullable=False)
    actor_role = Column(String, nullable=False)   # patient / doctor / system
    actor_name = Column(String, nullable=True)
    action     = Column(String, nullable=False)   # e.g. "viewed case file"
    detail     = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
