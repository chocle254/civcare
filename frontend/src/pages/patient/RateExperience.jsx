import { useState } from 'react';
import Icon from '../../components/Icons';
import { useNavigate } from 'react-router-dom';
import { rateConsultation } from '../../api/consultation';

export default function RateExperience() {
  const navigate  = useNavigate();
  const [rating,   setRating]   = useState(0);
  const [hover,    setHover]    = useState(0);
  const [feedback, setFeedback] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) return;
    setLoading(true);
    try {
      // Patient thinks this is just a rating —
      // behind the scenes this also releases payment to the doctor 😂
      await rateConsultation({
        consultation_id: localStorage.getItem('civtech_consultation_id'),
        patient_rating:  rating,
        patient_feedback: feedback,
      });
      setDone(true);
    } catch {
      // Even if API fails, show done — auto release handles it after 30min
      setDone(true);
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
            <span style={{ display: 'inline-flex', width: 56, height: 56, borderRadius: '50%', alignItems: 'center', justifyContent: 'center', background: 'var(--cc-success-soft)', color: 'var(--cc-success)', marginBottom: 16 }}><Icon.Heart size={26} /></span>
            <p style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              Thank You
            </p>
            <p style={{ color: 'var(--gray-600)', marginBottom: 24 }}>
              Your feedback helps us improve CivCare for everyone.
              We hope you feel better soon.
            </p>
            <button className="btn btn--primary" onClick={() => navigate('/chat')}>
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="header">
        <div>
          <div className="header__logo">CivCare</div>
          <div className="header__sub">Rate Your Experience</div>
        </div>
      </div>

      <div className="container">
        <div className="card" style={{ marginTop: 32, textAlign: 'center' }}>
          <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
            How was your consultation?
          </p>
          <p style={{ fontSize: 14, color: 'var(--gray-600)', marginBottom: 24 }}>
            Your honest feedback helps us improve the service.
          </p>

          {/* Star Rating */}
          <div className="stars" style={{ justifyContent: 'center', marginBottom: 24 }}
            role="radiogroup" aria-label="Rate your consultation, 1 to 5 stars" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                role="radio"
                aria-checked={rating === star}
                aria-label={`${star} star${star > 1 ? 's' : ''}`}
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

          <div className="form-group" style={{ textAlign: 'left' }}>
            <label className="label" htmlFor="rate-feedback">Additional comments (optional)</label>
            <textarea
              id="rate-feedback"
              className="input"
              placeholder="Tell us about your experience..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={3}
            />
          </div>

          <button
            className="btn btn--primary"
            onClick={handleSubmit}
            disabled={rating === 0 || loading}
          >
            {loading ? 'Submitting…' : 'Submit rating'}
          </button>

          <button
            className="btn btn--ghost"
            style={{ marginTop: 10 }}
            onClick={() => navigate('/chat')}
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
