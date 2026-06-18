import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Boolean, Integer, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base


class DoseCheckin(Base):
    """
    Created every time a dose reminder fires and the patient responds.

    This is the heart of the "carer" loop: CivCare does not just log that a
    pill was taken — it asks the patient a short, diagnosis-aware question
    ("Is the fever down? Is swallowing easier?") and records how they feel at
    that moment. Stacked together over a course, these check-ins become a
    longitudinal picture of recovery.

    IMPORTANT: nothing here is ever framed as a clinical claim about the drug.
    We only record what the patient reports.
    """
    __tablename__ = "dose_checkins"

    # ── PRIMARY KEY ──
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    # ── RELATIONSHIPS ──
    prescription_id = Column(String, ForeignKey("prescriptions.id"), nullable=False)
    reminder_id     = Column(String, ForeignKey("reminders.id"),     nullable=True)
    patient_id      = Column(String, ForeignKey("patients.id"),      nullable=False)

    # ── DOSE ──
    taken           = Column(Boolean, default=True)     # did they take this dose
    pills_taken     = Column(Integer, nullable=True)    # how many tablets they confirmed
    skip_reason     = Column(String, nullable=True)     # forgot / better / no_meds / side_effects

    # ── CHECK-IN ──
    checkin_question = Column(Text, nullable=True)      # the diagnosis-aware question we asked
    patient_answer   = Column(Text, nullable=True)      # free-text reply ("fever lower, throat still sore")

    # ── AI READING OF THE ANSWER (observational only) ──
    sentiment        = Column(String, nullable=True)    # improving / same / worse / side_effect
    improved_areas   = Column(Text, nullable=True)      # comma list of symptoms/areas the patient says eased
    persisting_areas = Column(Text, nullable=True)      # comma list of symptoms/areas still bothering them

    # ── TIMESTAMPS ──
    created_at       = Column(DateTime, default=datetime.utcnow)

    # ── RELATIONSHIPS ──
    prescription     = relationship("Prescription")

    def __repr__(self):
        return f"<DoseCheckin {self.prescription_id} taken={self.taken} sentiment={self.sentiment}>"


class CourseOutcome(Base):
    """
    Created once, when a medication course finishes (the last scheduled dose
    is reached). CivCare reviews every dose check-in across the course and
    distils a recovery summary for the doctor.

    The summary is deliberately OBSERVATIONAL, never causal. It never says
    "amoxicillin healed the throat." It says: the patient took these
    medications over this period; these areas resolved; these areas persist.
    Attributing cause is the doctor's job, not the AI's.
    """
    __tablename__ = "course_outcomes"

    # ── PRIMARY KEY ──
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    # ── RELATIONSHIPS ──
    prescription_id = Column(String, ForeignKey("prescriptions.id"), nullable=False)
    patient_id      = Column(String, ForeignKey("patients.id"),      nullable=False)
    verdict_id      = Column(String, ForeignKey("verdicts.id"),      nullable=True)

    # ── REVIEW ──
    medications      = Column(Text, nullable=True)      # what the patient took during the course
    resolved_areas   = Column(Text, nullable=True)      # what the patient reports has healed
    persisting_areas = Column(Text, nullable=True)      # what the patient reports is still wrong
    adherence_note   = Column(Text, nullable=True)      # e.g. "12/14 doses taken"
    still_unwell     = Column(Boolean, default=False)   # patient still does not feel well at course end

    # ── FOLLOW-UP CASE FILE ──
    # The note + summary handed to the next doctor if the patient re-routes.
    followup_note    = Column(Text, nullable=True)

    # ── STATUS ──
    rerouted         = Column(Boolean, default=False)   # patient chose hospital / online doctor again

    # ── TIMESTAMPS ──
    created_at       = Column(DateTime, default=datetime.utcnow)

    # ── RELATIONSHIPS ──
    prescription     = relationship("Prescription")

    def __repr__(self):
        return f"<CourseOutcome {self.prescription_id} still_unwell={self.still_unwell}>"
