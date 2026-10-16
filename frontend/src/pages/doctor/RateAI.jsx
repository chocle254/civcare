import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import client from '../../api/client';
import Icon from '../../components/Icons';

export default function RateAI() {
  const { id }   = useParams();   // appointment id
  const navigate = useNavigate();
  const doctor   = JSON.parse(localStorage.getItem('civtech_doctor') || '{}');

  const [rating,   setRating]   = useState(0);
  const [hover,    setHover]    = useState(0);
  const [comment,  setComment]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);
  const [error,    setError]    = useState('');

  const labels = {
    1: 'Very inaccurate — AI was completely off',
    2: 'Mostly inaccurate — several things wrong',
    3: 'Partially accurate — some things right',
    4: 'Mostly accurate — minor differences',
    5: 'Very accurate — matched my assessment',
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Please select a rating before submitting.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await client.post('/verdict/rate-ai', {
        doctor_id:          doctor.id,
        appointment_id:     id,
        ai_accuracy_rating: rating,
        ai_rating_comment:  comment,
      });
      setDone(true);
    } catch {
      setError('Could not submit rating. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="page">
        <div className="header">
          <div className="header__logo">CivCare</div>
        </div>
        <div className="container">
          <div className="card" style={{ marginTop: 40, textAlign: 'center' }}>
            <span style={{ display: 'inline-flex', width: 56, height: 56, borderRadius: '50%', alignItems: 'center', justifyContent: 'center', background: 'var(--cc-success-soft)', color: 'var(--cc-success)', marginBottom: 14 }}>
              <Icon.CheckCircle size={28} />
            </span>
            <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              Rating submitted
            </h1>
            <p style={{ color: 'var(--gray-600)', marginBottom: 24 }}>
              Thank you. Your feedback is used to improve the AI triage
              accuracy for future patients.
            </p>
            <button
              className="btn btn--primary"
              onClick={() => navigate('/doctor/dashboard')}
            >
              Back to dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" className="cc-back" onClick={() => navigate(-1)} aria-label="Back">
            <Icon.ChevronLeft size={20} />
          </button>
          <div>
            <div className="header__logo">Rate AI triage</div>
            <div className="header__sub">CivCare clinician portal</div>
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: 24 }}>
        <div className="card">
          <h1 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>How accurate was the AI triage?</h1>
          <p style={{ fontSize: 14, color: 'var(--gray-600)', marginBottom: 20 }}>
            Compare the AI's preliminary assessment with your clinical findings.
          </p>

          {error && <div className="alert alert--error" role="alert">{error}</div>}

          {/* ── Stars ── */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <div className="stars" role="radiogroup" aria-label="AI triage accuracy, 1 to 5 stars" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  role="radio"
                  aria-checked={rating === star}
                  aria-label={`${star} star${star > 1 ? 's' : ''}: ${labels[star]}`}
                  className={`star ${star <= (hover || rating) ? 'filled' : ''}`}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHover(star)}
                  onFocus={() => setHover(star)}
                  onBlur={() => setHover(0)}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          {/* ── Rating label ── */}
          {(hover || rating) > 0 && (
            <p style={{
              textAlign: 'center',
              fontSize: 13,
              color: 'var(--blue)',
              fontWeight: 600,
              marginBottom: 20,
            }}>
              {labels[hover || rating]}
            </p>
          )}

          {/* ── Comment ── */}
          <div className="form-group">
            <label className="label" htmlFor="rate-ai-comment">
              What did the AI get wrong? (optional)
            </label>
            <textarea
              id="rate-ai-comment"
              className="input"
              placeholder="Describe any inaccuracies in the AI's triage assessment..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
          </div>

          <button
            className="btn btn--primary"
            onClick={handleSubmit}
            disabled={loading || rating === 0}
          >
            {loading ? 'Submitting…' : 'Submit rating'}
          </button>

          <button
            className="btn btn--ghost"
            style={{ marginTop: 10 }}
            onClick={() => navigate('/doctor/dashboard')}
          >
            Skip for now
          </button>
        </div>

        <div
          style={{
            background: 'var(--blue-light)',
            borderRadius: 'var(--radius)',
            padding: 14,
            fontSize: 13,
            color: 'var(--gray-600)',
          }}
        >
          <strong style={{ color: 'var(--blue)' }}>Why we ask:</strong>{' '}
          Ratings are recorded with each case so the team can measure how well
          AI triage matches clinician judgement and improve it over time.
        </div>
      </div>
    </div>
  );
}
