import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';

export default function DiagnosisHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const pat = JSON.parse(localStorage.getItem('civtech_patient') || '{}');
    if (!pat.id) {
      navigate('/');
      return;
    }

    client
      .get(`/verdict/history/${pat.id}`)
      .then((res) => {
        setHistory(res.data.verdicts || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load diagnosis history:', err);
        setLoading(false);
      });
  }, [navigate]);

  const formatDate = (isoDate) => {
    if (!isoDate) return 'Unknown';
    const d = new Date(isoDate);
    return d.toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getSeverityStyle = (severity) => {
    if (!severity) return s.severity_mild;
    const sev = severity.toLowerCase();
    if (sev === 'severe') return s.severity_severe;
    if (sev === 'moderate') return s.severity_moderate;
    return s.severity_mild;
  };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button 
          style={s.backBtn} 
          onClick={() => navigate('/patient')}
        >
          ← Back to Dashboard
        </button>
        <div>
          <h1 style={s.title}>Medical History</h1>
          <p style={s.subtitle}>Your diagnosis records and treatment history</p>
        </div>
      </div>

      {loading && (
        <div style={s.loading}>
          <p>Loading your medical history...</p>
        </div>
      )}

      {!loading && history.length === 0 && (
        <div style={s.empty}>
          <p style={s.emptyTitle}>No diagnoses yet</p>
          <p style={s.emptyText}>
            When a doctor completes a consultation with you, your diagnosis will appear here.
          </p>
        </div>
      )}

      {!loading && history.length > 0 && (
        <div style={s.timeline}>
          {history.map((v, idx) => (
            <div key={v.id} style={s.card}>
              <div style={s.cardHeader}>
                <div style={s.cardHeaderLeft}>
                  <p style={s.cardDate}>{formatDate(v.date)}</p>
                  <p style={s.cardDoctor}>Dr. {v.doctor_name}</p>
                </div>
                {v.severity && (
                  <span style={{ ...s.severityBadge, ...getSeverityStyle(v.severity) }}>
                    {v.severity.toUpperCase()}
                  </span>
                )}
              </div>

              <div style={s.cardBody}>
                <div style={s.diagnosisSection}>
                  <p style={s.label}>Diagnosis</p>
                  <p style={s.diagnosis}>{v.diagnosis}</p>
                </div>

                {v.notes && (
                  <div style={s.notesSection}>
                    <p style={s.label}>Doctor's Notes</p>
                    <p style={s.notes}>{v.notes}</p>
                  </div>
                )}

                {v.prescriptions && v.prescriptions.length > 0 && (
                  <div style={s.rxSection}>
                    <p style={s.label}>Prescribed Medications</p>
                    <ul style={s.rxList}>
                      {v.prescriptions.map((rx, i) => (
                        <li key={i} style={s.rxItem}>
                          <strong style={s.rxName}>{rx.name}</strong>
                          {rx.notes && <span style={s.rxNote}> — {rx.notes}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {v.ai_rating && (
                  <div style={s.aiRating}>
                    <p style={s.label}>Doctor's AI Assessment</p>
                    <p style={s.ratingText}>
                      {'★'.repeat(v.ai_rating)}{'☆'.repeat(5 - v.ai_rating)} ({v.ai_rating}/5)
                    </p>
                  </div>
                )}
              </div>

              {idx < history.length - 1 && <div style={s.divider} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const s = {
  page: {
    background: 'linear-gradient(135deg, #0b0b12 0%, #1a1a2e 100%)',
    minHeight: '100vh',
    padding: '20px',
    fontFamily: "'Outfit', 'DM Sans', sans-serif",
    color: '#fff',
  },
  header: {
    marginBottom: 32,
    marginTop: 16,
  },
  backBtn: {
    background: 'rgba(99, 130, 255, 0.1)',
    border: '1px solid rgba(99, 130, 255, 0.3)',
    color: '#6382ff',
    padding: '10px 16px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    marginBottom: 16,
    transition: 'all 0.2s',
    display: 'inline-block',
  },
  title: {
    fontSize: 28,
    fontWeight: 800,
    margin: '0 0 6px',
    color: '#fff',
  },
  subtitle: {
    fontSize: 13,
    color: '#999',
    margin: 0,
  },
  loading: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#999',
  },
  empty: {
    background: 'rgba(99, 130, 255, 0.08)',
    border: '1px solid rgba(99, 130, 255, 0.2)',
    borderRadius: 12,
    padding: 40,
    textAlign: 'center',
    backdropFilter: 'blur(10px)',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 700,
    margin: '0 0 8px',
    color: '#fff',
  },
  emptyText: {
    fontSize: 13,
    color: '#999',
    margin: 0,
  },
  timeline: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    maxWidth: 700,
  },
  card: {
    background: 'rgba(99, 130, 255, 0.08)',
    border: '1px solid rgba(99, 130, 255, 0.2)',
    borderRadius: 12,
    padding: 20,
    backdropFilter: 'blur(10px)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  cardHeaderLeft: {
    display: 'flex',
    flexDirection: 'column',
  },
  cardDate: {
    fontSize: 12,
    fontWeight: 700,
    color: '#6382ff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    margin: '0 0 4px',
  },
  cardDoctor: {
    fontSize: 13,
    color: '#ccc',
    margin: 0,
    fontWeight: 600,
  },
  severityBadge: {
    fontSize: 10,
    fontWeight: 700,
    padding: '6px 12px',
    borderRadius: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    whiteSpace: 'nowrap',
  },
  severity_severe: {
    background: 'rgba(220, 38, 38, 0.2)',
    color: '#ff6b6b',
    border: '1px solid rgba(220, 38, 38, 0.4)',
  },
  severity_moderate: {
    background: 'rgba(245, 158, 11, 0.2)',
    color: '#ffa726',
    border: '1px solid rgba(245, 158, 11, 0.4)',
  },
  severity_mild: {
    background: 'rgba(34, 197, 94, 0.2)',
    color: '#51cf66',
    border: '1px solid rgba(34, 197, 94, 0.4)',
  },
  cardBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  diagnosisSection: {
    padding: 14,
    background: 'rgba(99, 130, 255, 0.05)',
    border: '1px solid rgba(99, 130, 255, 0.2)',
    borderRadius: 8,
    borderLeft: '3px solid #6382ff',
  },
  label: {
    fontSize: 10,
    fontWeight: 800,
    color: '#6382ff',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    margin: '0 0 8px',
  },
  diagnosis: {
    fontSize: 14,
    fontWeight: 600,
    color: '#fff',
    margin: 0,
    lineHeight: 1.5,
  },
  notesSection: {
    padding: 14,
    background: 'rgba(99, 130, 255, 0.05)',
    border: '1px solid rgba(99, 130, 255, 0.2)',
    borderRadius: 8,
  },
  notes: {
    fontSize: 13,
    color: '#ccc',
    margin: 0,
    lineHeight: 1.6,
    fontStyle: 'italic',
  },
  rxSection: {
    padding: 14,
    background: 'rgba(99, 130, 255, 0.05)',
    border: '1px solid rgba(99, 130, 255, 0.2)',
    borderRadius: 8,
  },
  rxList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  rxItem: {
    fontSize: 13,
    color: '#ccc',
    margin: 0,
    padding: '10px 12px',
    background: 'rgba(99, 130, 255, 0.1)',
    border: '1px solid rgba(99, 130, 255, 0.15)',
    borderRadius: 6,
  },
  rxName: {
    color: '#6382ff',
    fontWeight: 700,
  },
  rxNote: {
    fontSize: 12,
    color: '#999',
    marginLeft: 6,
  },
  aiRating: {
    padding: 14,
    background: 'rgba(99, 130, 255, 0.05)',
    border: '1px solid rgba(99, 130, 255, 0.2)',
    borderRadius: 8,
    textAlign: 'center',
  },
  ratingText: {
    fontSize: 16,
    margin: 0,
    color: '#6382ff',
    fontWeight: 700,
    letterSpacing: 1,
  },
  divider: {
    height: 1,
    background: 'rgba(99, 130, 255, 0.1)',
    margin: '8px 0',
  },
};
