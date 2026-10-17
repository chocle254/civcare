import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icons';
import { checkInAfterTransfer } from '../../api/triage';

export default function ArrivalWaiting() {
    const navigate = useNavigate();
    const patient = JSON.parse(localStorage.getItem('civtech_patient') || '{}');
    const appointmentId = localStorage.getItem('civtech_appointment_id');
    const [callStatus, setCallStatus] = useState(null); // null | { doctor_name, room }
    const [completed, setCompleted] = useState(false); // NEW
    const [visit, setVisit] = useState(null); // latest status: { status, doctor_name, transfer, hospital }
    const [checkingIn, setCheckingIn] = useState(false);
    const [checkInError, setCheckInError] = useState('');

    useEffect(() => {
        if (!appointmentId) return;

        const poll = async () => {
            try {
                const res = await fetch(`${process.env.REACT_APP_API_URL}/triage/appointment-status/${appointmentId}`);
                const data = await res.json();
                if (res.ok) setVisit(data);
                if (data.status === 'called' || data.status === 'in_progress') {
                    setCallStatus({ doctor_name: data.doctor_name, room: data.room });
                } else if (data.status === 'completed') {   // NEW
                    setCompleted(true);                       // NEW
                    localStorage.removeItem('civtech_appointment_id');
                }
            } catch { }
        };

        poll();
        const interval = setInterval(poll, 2000);
        return () => clearInterval(interval);
    }, [appointmentId]);

    const firstName = patient.name?.split(' ')[0];
    const hospital = visit?.hospital;

    const handleCheckIn = async () => {
        setCheckingIn(true);
        setCheckInError('');
        try {
            await checkInAfterTransfer(appointmentId);
            setVisit((v) => (v ? { ...v, status: 'arrived' } : v));
        } catch {
            setCheckInError('Could not check you in. Please try again.');
        } finally {
            setCheckingIn(false);
        }
    };

    // ── CONSULTATION COMPLETE ──
    if (completed && !callStatus) {
        return (
            <Shell>
                <span className="aw-icon aw-icon--success" aria-hidden="true"><Icon.CheckCircle size={32} /></span>
                <h1 className="aw-title">You're all set</h1>
                <p className="aw-text">Your consultation is complete. Any prescriptions from your doctor are in your Medications.</p>
                <button type="button" className="btn btn--primary aw-btn" onClick={() => navigate('/medications')}>
                    <Icon.Pill size={18} /> View my medications
                </button>
            </Shell>
        );
    }

    // ── DOCTOR IS READY ──
    if (callStatus) {
        return (
            <Shell live>
                <span className="aw-eyebrow"><Icon.Bell size={16} /> It's your turn</span>
                <h1 className="aw-title">{callStatus.doctor_name || 'Your doctor'} is ready to see you</h1>
                <div className="aw-room">
                    <span>Please go to</span>
                    <strong>{callStatus.room || 'the consultation room'}</strong>
                </div>
                <p className="aw-text">Show this screen to the staff if you need directions.</p>
            </Shell>
        );
    }

    // ── REFERRED TO ANOTHER HOSPITAL: travel there, then check in ──
    if (visit?.transfer === 'hospital' && visit.status === 'pending') {
        const directions = hospital?.lat != null && hospital?.lon != null
            ? `https://www.google.com/maps/dir/?api=1&destination=${hospital.lat},${hospital.lon}`
            : hospital?.name
                ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hospital.name)}`
                : null;
        return (
            <Shell live>
                <span className="aw-icon aw-icon--wait" aria-hidden="true"><Icon.Hospital size={30} /></span>
                <h1 className="aw-title">We've referred you to {hospital?.name || 'another hospital'}</h1>
                <p className="aw-text">
                    Your doctor wants you seen by the team there, as they're better placed to help with this.
                    Please make your way over, then tap the button below when you arrive.
                </p>
                {(hospital?.address || hospital?.town || hospital?.phone) && (
                    <div className="aw-place">
                        {(hospital.address || hospital.town) && (
                            <span><Icon.MapPin size={15} /> {[hospital.address, hospital.town].filter(Boolean).join(', ')}</span>
                        )}
                        {hospital.phone && (
                            <span><Icon.Phone size={15} /> {hospital.phone} <a href={`tel:${hospital.phone}`}>Call</a></span>
                        )}
                    </div>
                )}
                {checkInError && <p className="aw-err" role="alert">{checkInError}</p>}
                <button type="button" className="btn btn--primary aw-btn" onClick={handleCheckIn} disabled={checkingIn}>
                    <Icon.CheckCircle size={18} /> {checkingIn ? 'Checking you in…' : "I've arrived, check me in"}
                </button>
                {directions && (
                    <a className="btn btn--outline aw-btn aw-btn--tight" href={directions} target="_blank" rel="noopener noreferrer">
                        <Icon.MapPin size={18} /> Get directions
                    </a>
                )}
            </Shell>
        );
    }

    // ── WAITING (possibly after a transfer) ──
    const assigned = visit?.transfer && visit.doctor_name;
    const title = visit?.transfer === 'doctor'
        ? `Hang tight${firstName ? `, ${firstName}` : ''}`
        : visit?.transfer === 'hospital'
            ? `You're checked in at ${hospital?.name || 'the hospital'}`
            : `You're checked in${firstName ? `, ${firstName}` : ''}`;
    return (
        <Shell live>
            <span className="aw-icon aw-icon--wait" aria-hidden="true"><Icon.Hospital size={30} /></span>
            <h1 className="aw-title">{title}</h1>
            {assigned && (
                <div className="aw-assigned">
                    <Icon.Stethoscope size={18} />
                    <span>You've been assigned to <strong>{visit.doctor_name}</strong></span>
                </div>
            )}
            <p className="aw-text">
                {assigned
                    ? "They'll call you when they're ready. Please stay nearby; this screen updates automatically."
                    : "Please take a seat. Your doctor will call you when they're ready. This screen updates automatically."}
            </p>
            <span className="aw-status"><span className="aw-dot" aria-hidden="true" /> Waiting to be called</span>
            <button type="button" className="btn btn--outline aw-btn" onClick={() => navigate('/medications')}>
                View my medications
            </button>
        </Shell>
    );
}

function Shell({ children, live }) {
    return (
        <div className="aw">
            <main className="aw-card" aria-live={live ? 'polite' : undefined}>{children}</main>
            <style>{`
                .aw { min-height: 100vh; background: var(--cc-canvas); background-attachment: fixed; display: flex; align-items: center; justify-content: center; padding: 24px 16px; }
                .aw-card { width: 100%; max-width: 440px; text-align: center; background: var(--cc-glass-strong); -webkit-backdrop-filter: var(--cc-blur); backdrop-filter: var(--cc-blur); border: 1px solid var(--cc-glass-border); box-shadow: var(--cc-glass-edge), var(--cc-shadow); border-radius: 24px; padding: 36px 24px 28px; display: flex; flex-direction: column; align-items: center; animation: fadeUp .25s ease both; }
                .aw-icon { width: 76px; height: 76px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 18px; position: relative; box-shadow: var(--cc-clay); }
                .aw-icon--success { background: var(--cc-success-soft); color: var(--cc-success); }
                .aw-icon--wait { background: var(--cc-primary-soft); color: var(--cc-primary); }
                .aw-icon--wait::after { content: ''; position: absolute; inset: -7px; border-radius: 50%; border: 2px solid var(--cc-primary-border); animation: pulse-glow 2.2s ease-in-out infinite; }
                .aw-eyebrow { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 999px; background: var(--cc-success-soft); color: var(--cc-success); font-size: 13px; font-weight: 700; margin-bottom: 14px; }
                .aw-title { font-size: 22px; font-weight: 700; letter-spacing: -0.015em; line-height: 1.3; margin-bottom: 10px; }
                .aw-text { color: var(--cc-muted); font-size: 15px; line-height: 1.55; max-width: 340px; }
                .aw-room { width: 100%; margin: 10px 0 16px; padding: 18px 16px; border-radius: 14px; background: var(--cc-primary-soft); border: 1px solid var(--cc-primary-border); display: flex; flex-direction: column; gap: 2px; }
                .aw-room span { font-size: 13px; font-weight: 600; color: var(--cc-muted); }
                .aw-room strong { font-size: 40px; font-weight: 800; letter-spacing: -0.02em; color: var(--cc-primary); line-height: 1.15; word-break: break-word; }
                .aw-status { display: inline-flex; align-items: center; gap: 8px; margin: 20px 0 4px; font-size: 14px; font-weight: 600; color: var(--cc-text-2); }
                .aw-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--cc-primary); animation: pulse-glow 1.6s ease-in-out infinite; }
                .aw-btn { margin-top: 24px; }
                .aw-btn--tight { margin-top: 10px; text-decoration: none; }
                .aw-assigned { display: flex; align-items: center; gap: 10px; width: 100%; margin: 6px 0 14px; padding: 14px 16px; border-radius: 14px; background: var(--cc-primary-soft); border: 1px solid var(--cc-primary-border); color: var(--cc-primary); text-align: left; font-size: 15px; }
                .aw-assigned span { color: var(--cc-text); }
                .aw-assigned svg { flex-shrink: 0; }
                .aw-place { width: 100%; margin-top: 16px; padding: 12px 14px; border-radius: 12px; background: var(--cc-surface-2); border: 1px solid var(--cc-border); display: flex; flex-direction: column; gap: 6px; text-align: left; font-size: 14px; color: var(--cc-text-2); }
                .aw-place span { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
                .aw-place svg { flex-shrink: 0; color: var(--cc-muted); }
                .aw-place a { color: var(--cc-primary); font-weight: 600; }
                .aw-err { color: var(--cc-danger); font-size: 14px; margin-top: 12px; }
            `}</style>
        </div>
    );
}
