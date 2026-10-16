export default function Modal({ title, message, onConfirm, onCancel, confirmText = 'Confirm', cancelText = 'Cancel', danger = false }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Dialog'}
      style={{
        position:       'fixed',
        inset:          0,
        background:     'var(--cc-overlay)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        zIndex:         999,
        padding:        16,
      }}
    >
      <div
        style={{
          background:   'var(--white)',
          borderRadius: 'var(--radius)',
          padding:      24,
          maxWidth:     380,
          width:        '100%',
          boxShadow:    'var(--cc-shadow-lg)',
          border:       '1px solid var(--cc-border)',
        }}
      >
        {title && (
          <p style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>
            {title}
          </p>
        )}
        {message && (
          <p style={{ fontSize: 14, color: 'var(--gray-600)', marginBottom: 20, lineHeight: 1.6 }}>
            {message}
          </p>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
          {onCancel && (
            <button className="btn btn--ghost" onClick={onCancel}>
              {cancelText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
