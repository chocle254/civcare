import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text, Integer, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class AIFeedback(Base):
    """
    Stores Reinforcement Learning from Human Feedback (RLHF) ratings.
    Doctors rate the AI's triage accuracy when submitting a verdict.
    This dataset can be used to fine-tune future LLM prompt adjustments
    or custom model training.
    """
    __tablename__ = "ai_training_feedback"

    # ── PRIMARY KEY ──
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    # ── RELATIONSHIPS ──
    appointment_id  = Column(String, ForeignKey("appointments.id"), nullable=True)

    # ── RATING & DIAGNOSIS ──
    rating          = Column(Integer, nullable=False)           # 1 to 5 stars
    ai_assessment   = Column(Text, nullable=True)               # The AI's original preliminary assessment
    ai_risk_score   = Column(String, nullable=True)             # The AI's original risk tier + numeric (e.g. "moderate (52)")
    actual_diagnosis = Column(Text, nullable=True)              # The doctor's actual diagnosis
    doctor_notes    = Column(Text, nullable=True)               # The doctor's clinical notes (incl. vitals AI could not measure)
    comment         = Column(Text, nullable=True)               # Doctor's explanation of what the AI got wrong/right

    # ── SELF-TRAINING OUTPUT ──
    # Produced by the RLHF cross-reference step: the AI compares its own
    # prediction to the doctor's ground-truth diagnosis + notes, explains
    # the gap, and distils a reusable lesson that is fed into future triage.
    mismatch        = Column(Boolean, default=False)            # True when AI prediction disagreed with doctor
    mismatch_analysis = Column(Text, nullable=True)             # Why the AI was wrong/right vs ground truth
    learned_lesson  = Column(Text, nullable=True)               # Generalised rule injected into future triage prompts
    is_active       = Column(Boolean, default=True)             # Whether this lesson is still applied

    # ── TIMESTAMPS ──
    created_at      = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<AIFeedback Appointment:{self.appointment_id} Rating:{self.rating}/5 Mismatch:{self.mismatch}>"
