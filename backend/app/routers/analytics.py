from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.database import get_db
from app.models.verdict import Verdict
from app.models.patient import Patient
from app.models.hospital import Hospital

router = APIRouter()

# ── ANALYTICS: SUMMARY STATS ──
@router.get("/summary")
async def get_analytics_summary(
    period: str = "monthly",
    db: Session = Depends(get_db)
):
    """
    Get overall disease analytics summary.
    period: 'weekly', 'monthly', or 'yearly'
    """
    now = datetime.utcnow()
    
    if period == "weekly":
        start_date = now - timedelta(days=7)
    elif period == "yearly":
        start_date = now - timedelta(days=365)
    else:  # monthly
        start_date = now - timedelta(days=30)
    
    verdicts = db.query(Verdict).filter(
        Verdict.submitted_at >= start_date
    ).all()
    
    unique_diagnoses = set()
    counties = set()
    total_severity = 0
    severity_count = 0
    
    for v in verdicts:
        unique_diagnoses.add(v.diagnosis)
        patient = db.query(Patient).filter(Patient.id == v.patient_id).first()
        if patient and patient.location:
            counties.add(patient.location)
        
        if v.severity_confirmed:
            severity_count += 1
            if v.severity_confirmed.lower() == "severe":
                total_severity += 3
            elif v.severity_confirmed.lower() == "moderate":
                total_severity += 2
            else:
                total_severity += 1
    
    avg_severity = (total_severity / severity_count * 100 / 3) if severity_count > 0 else 0
    
    return {
        "total_cases": len(verdicts),
        "unique_diagnoses": len(unique_diagnoses),
        "counties_affected": len(counties),
        "avg_severity_percent": round(avg_severity, 1),
        "period": period,
    }


# ── ANALYTICS: TOP DISEASES ──
@router.get("/diseases/top")
async def get_top_diseases(
    limit: int = 10,
    period: str = "monthly",
    db: Session = Depends(get_db)
):
    """
    Get top N diseases by case count.
    """
    now = datetime.utcnow()
    
    if period == "weekly":
        start_date = now - timedelta(days=7)
    elif period == "yearly":
        start_date = now - timedelta(days=365)
    else:
        start_date = now - timedelta(days=30)
    
    verdicts = db.query(Verdict).filter(
        Verdict.submitted_at >= start_date
    ).all()
    
    disease_counts = {}
    disease_severity = {}
    
    for v in verdicts:
        if v.diagnosis:
            disease_counts[v.diagnosis] = disease_counts.get(v.diagnosis, 0) + 1
            if v.severity_confirmed:
                sev_val = 3 if v.severity_confirmed.lower() == "severe" else (2 if v.severity_confirmed.lower() == "moderate" else 1)
                if v.diagnosis not in disease_severity:
                    disease_severity[v.diagnosis] = []
                disease_severity[v.diagnosis].append(sev_val)
    
    sorted_diseases = sorted(disease_counts.items(), key=lambda x: x[1], reverse=True)[:limit]
    
    result = []
    for disease, count in sorted_diseases:
        avg_sev = sum(disease_severity.get(disease, [1])) / len(disease_severity.get(disease, [1]))
        result.append({
            "disease": disease,
            "cases": count,
            "avg_severity": round(avg_sev, 1),
        })
    
    return {"top_diseases": result, "period": period}


# ── ANALYTICS: DISEASES BY COUNTY ──
@router.get("/diseases/by-county")
async def get_diseases_by_county(
    period: str = "monthly",
    db: Session = Depends(get_db)
):
    """
    Get disease breakdown by county.
    """
    now = datetime.utcnow()
    
    if period == "weekly":
        start_date = now - timedelta(days=7)
    elif period == "yearly":
        start_date = now - timedelta(days=365)
    else:
        start_date = now - timedelta(days=30)
    
    verdicts = db.query(Verdict).filter(
        Verdict.submitted_at >= start_date
    ).all()
    
    county_diseases = {}
    
    for v in verdicts:
        patient = db.query(Patient).filter(Patient.id == v.patient_id).first()
        county = patient.location if patient else "Unknown"
        
        if county not in county_diseases:
            county_diseases[county] = {}
        
        disease = v.diagnosis or "Unspecified"
        county_diseases[county][disease] = county_diseases[county].get(disease, 0) + 1
    
    result = []
    for county, diseases in county_diseases.items():
        total_cases = sum(diseases.values())
        top_disease = max(diseases.items(), key=lambda x: x[1])[0] if diseases else "N/A"
        
        result.append({
            "county": county,
            "total_cases": total_cases,
            "top_disease": top_disease,
            "disease_breakdown": diseases,
        })
    
    return {
        "by_county": sorted(result, key=lambda x: x["total_cases"], reverse=True),
        "period": period,
    }


# ── ANALYTICS: TRENDS ──
@router.get("/trends")
async def get_trends(
    period: str = "monthly",
    db: Session = Depends(get_db)
):
    """
    Get disease trends over time (daily for weekly, weekly for monthly, monthly for yearly).
    """
    now = datetime.utcnow()
    
    if period == "weekly":
        start_date = now - timedelta(days=7)
        interval_days = 1
        date_format = "%Y-%m-%d"
    elif period == "yearly":
        start_date = now - timedelta(days=365)
        interval_days = 30
        date_format = "%Y-%m"
    else:  # monthly
        start_date = now - timedelta(days=30)
        interval_days = 7
        date_format = "%Y-%m-%d"
    
    verdicts = db.query(Verdict).filter(
        Verdict.submitted_at >= start_date
    ).all()
    
    daily_counts = {}
    
    for v in verdicts:
        date_key = v.submitted_at.strftime(date_format)
        daily_counts[date_key] = daily_counts.get(date_key, 0) + 1
    
    # Generate all dates in range
    result = []
    current = start_date
    while current <= now:
        date_key = current.strftime(date_format)
        result.append({
            "date": date_key,
            "cases": daily_counts.get(date_key, 0),
        })
        current += timedelta(days=interval_days)
    
    return {"trends": result, "period": period}
