import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Boolean
from app.database import Base


class Admin(Base):
    """
    A member of the CivCare team. Admins see platform totals and approve
    hospitals; they cannot open patient records (Data Protection Act 2019,
    s. 41: only the clinicians caring for a patient may).
    """
    __tablename__ = "admins"

    id            = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email         = Column(String, unique=True, nullable=False, index=True)
    full_name     = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    is_active     = Column(Boolean, default=True)
    last_login_at = Column(DateTime, nullable=True)
    created_at    = Column(DateTime, default=datetime.utcnow)
