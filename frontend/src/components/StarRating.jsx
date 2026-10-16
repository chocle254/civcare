import { useState } from 'react';

const LABELS = {
  1: 'Very inaccurate',
  2: 'Mostly inaccurate',
  3: 'Partially accurate',
  4: 'Mostly accurate',
  5: 'Very accurate',
};

export default function StarRating({ value, onChange, showLabel = true }) {
  const [hover, setHover] = useState(0);

  return (
    <div>
      <div className="stars" role="radiogroup" aria-label="Rating, 1 to 5 stars" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star > 1 ? 's' : ''}: ${LABELS[star]}`}
            className={`star ${star <= (hover || value) ? 'filled' : ''}`}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            onFocus={() => setHover(star)}
            onBlur={() => setHover(0)}
          >
            ★
          </button>
        ))}
      </div>
      {showLabel && (hover || value) > 0 && (
        <p
          aria-live="polite"
          style={{
            fontSize:   13,
            color:      'var(--blue)',
            fontWeight: 600,
            marginTop:  8,
          }}
        >
          {LABELS[hover || value]}
        </p>
      )}
    </div>
  );
}
