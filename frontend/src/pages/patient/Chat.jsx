import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { sendMessage } from '../../api/triage';
import { theme } from '../../styles/theme';

const { color, font, radius } = theme;

// What CivCare's AI can actually help with — shown on the landing screen.
const QUICK_ACTIONS = [
  {
    emoji: '🚨', title: 'Emergency Care', sub: 'Immediate triage & nearest ER',
    prompt: "I think I'm having a medical emergency and need help right away.",
    tint: color.coral, tintDim: color.coralDim,
  },
  {
    emoji: '🩺', title: 'Symptom Checker', sub: 'Describe how you feel, get guided next steps',
    prompt: "I'd like to describe my symptoms and get some guidance.",
    tint: color.blue, tintDim: color.blueDim,
  },
  {
    emoji: '💊', title: 'Medication Guidance', sub: 'Dosage, interactions & reminders',
    prompt: 'I have a question about a medication I\'m taking.',
    tint: color.mint, tintDim: color.mintDim,
  },
];

export default function Chat() {
  const navigate = useNavigate();
  const location = useLocation();
  const patient = JSON.parse(localStorage.getItem('civtech_patient') || '{}');
  const bottomRef = useRef(null);

  const mode = location.state?.mode || null;

  const existingSessionId = localStorage.getItem('civtech_session_id');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState(existingSessionId || null);
  const [isTyping, setIsTyping] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [coords, setCoords] = useState(null);
  // Landing (greeting + quick actions) shows for fresh sessions only —
  // resuming an existing conversation or a pre-hospital/pre-consultation
  // handoff drops straight into the thread.
  const [showLanding, setShowLanding] = useState(!existingSessionId && !mode);

  const firstName = patient.name?.split(' ')[0] || 'there';

  // ── Get GPS silently ──
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => { },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // ── Opening message ──
  useEffect(() => {
    const resumeId = localStorage.getItem('civtech_session_id');

    if (resumeId) {
      setSessionId(resumeId);
      import('axios').then(({ default: axios }) => {
        axios.get(`${process.env.REACT_APP_API_URL}/triage/messages/${resumeId}`)
          .then(res => {
            const history = (res.data || []).map(m => ({
              role: m.role,
              content: m.content,
            }));
            setMessages(history.length ? history : [{ role: 'ai', content: 'Session resumed. How can I help?' }]);
          })
          .catch(() => {
            setMessages([{ role: 'ai', content: 'Could not load previous messages.' }]);
          });
      });
    } else {
      let welcomeMsg = `Hello ${firstName}. I am CivCare, your health assistant. How are you feeling today?`;
      if (mode === 'pre_hospital') {
        const h = JSON.parse(localStorage.getItem('civtech_hospital') || '{}');
        welcomeMsg = `You've selected ${h.name}. To prepare your file for the doctor, please describe the symptoms you are experiencing.`;
      } else if (mode === 'pre_consultation') {
        const d = JSON.parse(localStorage.getItem('civtech_selected_doctor') || '{}');
        welcomeMsg = `You're about to consult Dr. ${d.full_name || d.name}. Please describe your symptoms to speed up the consultation.`;
      }
      setMessages([{ role: 'ai', content: welcomeMsg }]);
    }
  }, [location.key, mode, firstName]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async (overrideText) => {
    const text = (overrideText ?? input).trim();
    if (!text || isTyping || disabled) return;
    setShowLanding(false);
    setInput('');
    setMessages((prev) => [...prev, { role: 'patient', content: text }]);
    setIsTyping(true);

    try {
      const res = await sendMessage({
        patient_id: patient.id,
        session_id: sessionId,
        message: text,
        patient_lat: coords?.lat || null,
        patient_lon: coords?.lon || null,
        mode: mode,
      });
      const data = res.data;
      setSessionId(data.session_id);
      localStorage.setItem('civtech_session_id', data.session_id);

      // NOTE: The triage risk score is intentionally NEVER shown to the patient.
      // Risk is a clinical signal for routing and for the doctor only — surfacing
      // it to the patient could cause panic or false reassurance. The header stays
      // a neutral assistant label regardless of the computed risk.

      await new Promise((r) => setTimeout(r, 700));
      setIsTyping(false);
      setMessages((prev) => [...prev, { role: 'ai', content: data.response }]);

      if (data.action === 'route_hospital') {
        setDisabled(true);
        if (mode === 'pre_hospital') {
          setTimeout(() => navigate('/arrival'), 1500);
        } else {
          setTimeout(() => {
            setMessages((prev) => [...prev, {
              role: 'action',
              content: 'route_hospital_card',
              sessionId: data.session_id,
            }]);
          }, 800);
        }
      }

      if (data.action === 'route_consultation') {
        setDisabled(true);
        if (mode === 'pre_consultation') {
          // Fast-track to consultation initiate
          setTimeout(async () => {
            const d = JSON.parse(localStorage.getItem('civtech_selected_doctor') || '{}');
            if (!d.id) return navigate('/consultation');

            import('axios').then(async (axios) => {
              try {
                const initRes = await axios.default.post(`${process.env.REACT_APP_API_URL}/consultation/initiate`, {
                  patient_id: patient.id,
                  doctor_id: d.id,
                  session_id: data.session_id,
                  payment_method: 'mpesa',
                  fee_amount: d.consultation_fee,
                });
                localStorage.setItem('civtech_consultation_id', initRes.data.consultation_id);
                navigate('/consultation/waiting');
              } catch (e) {
                alert('Failed to connect to doctor. Please try again.');
                navigate('/consultation');
              }
            });
          }, 1500);
        } else {
          setTimeout(() => {
            setMessages((prev) => [...prev, { role: 'action', content: 'consultation' }]);
          }, 800);
        }
      }

      if (data.medscan_result) {
        setTimeout(() => {
          setMessages((prev) => [...prev, { role: 'medscan', content: data.medscan_result }]);
        }, 500);
      }
    } catch {
      setIsTyping(false);
      setMessages((prev) => [...prev, {
        role: 'ai', content: 'I am having trouble connecting. Please try again.',
      }]);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleQuickAction = (action) => { handleSend(action.prompt); };

  // Hospital Selection is now handled entirely on the /hospitals map page

  return (
    <div style={s.page}>
      {/* ── HEADER ── */}
      <div style={s.header}>
        <button style={s.backBtn} className="cc-press" onClick={() => navigate('/dashboard')}>
          <span style={s.backEmoji}>←</span>
        </button>
        <div style={s.headerCenter}>
          <div style={s.verdictBadge}>
            <span style={s.verdictDot} />
            <span style={s.verdictText}>CivCare AI</span>
          </div>
        </div>
        <button style={s.headerInfo} className="cc-press" aria-label="Info">ⓘ</button>
      </div>

      {showLanding ? (
        /* ── LANDING: greeting + quick actions ── */
        <div style={s.landing}>
          <div style={s.landingAvatarRing}>
            <div style={s.landingAvatar} className="cc-float">✨</div>
          </div>
          <p style={s.landingHey}>Hey, {firstName}</p>
          <h1 style={s.landingTitle}>How I can <span style={{ color: color.blue }}>help you?</span></h1>

          <p style={s.landingLabel}>Quick actions</p>
          <div style={s.actionList}>
            {QUICK_ACTIONS.map((a, i) => (
              <button
                key={a.title} style={{ ...s.actionCard, animationDelay: `${i * 0.07}s` }}
                className="cc-press" onClick={() => handleQuickAction(a)}
              >
                <span style={{ ...s.actionIcon, background: a.tintDim }}>{a.emoji}</span>
                <span style={s.actionText}>
                  <span style={s.actionTitle}>{a.title}</span>
                  <span style={s.actionSub}>{a.sub}</span>
                </span>
                <span style={{ color: color.inkFaint, fontSize: 16 }}>›</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* ── MESSAGES ── */
        <div style={s.messageList}>
          {messages.map((msg, i) => {

            if (msg.role === 'patient') return (
              <div key={i} style={s.rowRight}>
                <div style={s.bubblePatient}>{msg.content}</div>
              </div>
            );

            if (msg.role === 'ai') return (
              <div key={i} style={s.rowLeft}>
                <div style={s.aiBadge}>✨</div>
                <div style={s.bubbleAi}>{msg.content}</div>
              </div>
            );

            if (msg.role === 'medscan') {
              const med = msg.content;
              return (
                <div key={i} style={s.rowLeft}>
                  <div style={s.aiBadge}>⚕️</div>
                  <div style={{
                    ...s.bubbleAi,
                    background: med.clash_detected ? color.coralDim : color.tealDim,
                    border: `1px solid ${med.clash_detected ? 'rgba(255,101,132,0.3)' : 'rgba(22,179,120,0.3)'}`,
                  }}>
                    <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, color: color.ink }}>
                      {med.clash_detected ? '⚠️ Medication Warning' : '✅ Medication OK'}
                    </p>
                    <p style={{ fontSize: 13, color: color.inkDim }}>{med.recommendation}</p>
                  </div>
                </div>
              );
            }

            if (msg.role === 'action' && (msg.content === 'hospital' || msg.content === 'hospital_fallback' || msg.content === 'route_hospital_card')) {
              return (
                <div key={i} style={s.rowLeft}>
                  <div style={s.aiBadge}>🏥</div>
                  <div style={s.bubbleAi}>
                    <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: color.ink }}>Hospital Care Recommended</p>
                    <p style={{ fontSize: 13, marginBottom: 10, color: color.inkDim }}>We recommend visiting a hospital for further evaluation.</p>
                    <button style={s.actionBtn} className="cc-press" onClick={() => { localStorage.setItem('civtech_session_id', sessionId || msg.sessionId); navigate('/hospitals'); }}>
                      Find Hospitals on Map →
                    </button>
                  </div>
                </div>
              );
            }

            if (msg.role === 'action' && msg.content === 'consultation') {
              return (
                <div key={i} style={s.rowLeft}>
                  <div style={s.aiBadge}>👨‍⚕️</div>
                  <div style={s.bubbleAi}>
                    <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: color.ink }}>Speak to a Doctor Online</p>
                    <p style={{ fontSize: 13, marginBottom: 10, color: color.inkDim }}>A doctor is available right now from wherever you are.</p>
                    <button style={s.actionBtn} className="cc-press" onClick={() => { localStorage.setItem('civtech_session_id', sessionId); navigate('/consultation'); }}>
                      See Available Doctors →
                    </button>
                  </div>
                </div>
              );
            }

            return null;
          })}

          {/* ── Typing indicator ── */}
          {isTyping && (
            <div style={s.rowLeft}>
              <div style={s.aiBadge}>✨</div>
              <div style={s.typingBubble}>
                <span style={s.typingDot} />
                <span style={{ ...s.typingDot, animationDelay: '0.15s' }} />
                <span style={{ ...s.typingDot, animationDelay: '0.3s' }} />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* ── INPUT ── */}
      <div style={s.inputRow}>
        <button style={s.attachBtn} className="cc-press" aria-label="Attach">📎</button>
        <input
          style={s.input}
          placeholder={disabled ? 'Select an option above' : (showLanding ? 'Tell us about your request...' : 'Message...')}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isTyping}
        />
        <button
          style={{ ...s.sendBtn, opacity: input.trim() && !isTyping && !disabled ? 1 : 0.4 }}
          className="cc-press"
          onClick={() => handleSend()}
          disabled={!input.trim() || isTyping || disabled}
        >
          {input.trim() ? '↑' : '🎙️'}
        </button>
      </div>

      <style>{`
        ${theme.fontImport}
        * { box-sizing: border-box; }
        button, input { font-family: inherit; }
        input::placeholder { color: ${color.inkFaint}; }
        input:focus { outline: none; }
        ${theme.motionCss}
        @keyframes typing {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40%           { transform: scale(1); opacity: 1; }
        }
        @keyframes bubbleIn {
          from { opacity: 0; transform: scale(0.95) translateY(4px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        .cc-float { animation: float 3.2s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

const s = {
  page: {
    height: '100vh', width: '100%', overflowX: 'hidden', boxSizing: 'border-box',
    display: 'flex', flexDirection: 'column',
    background: color.bgGradient,
    fontFamily: font.ui, color: color.ink,
  },
  header: {
    display: 'flex', alignItems: 'center', padding: '14px 16px', gap: 12, flexShrink: 0,
    borderBottom: `1px solid ${color.hairline}`,
    background: color.glassStrong, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: radius.md, background: color.glass, border: `1px solid ${color.glassBorder}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
    boxShadow: theme.shadow.embossOut,
  },
  backEmoji: { fontSize: 16, color: color.ink },
  headerCenter: { flex: 1, display: 'flex', flexDirection: 'column', gap: 3 },
  verdictBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: color.tealDim, border: '1px solid rgba(22,179,120,0.25)',
    borderRadius: 20, padding: '4px 11px', alignSelf: 'flex-start',
  },
  verdictDot: { width: 6, height: 6, borderRadius: '50%', background: color.teal, boxShadow: `0 0 0 3px ${color.tealDim}` },
  verdictText: { fontSize: 11.5, fontWeight: 700, color: color.teal },
  headerInfo: {
    width: 32, height: 32, borderRadius: '50%', background: color.glass, border: `1px solid ${color.glassBorder}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: color.inkDim, cursor: 'pointer', flexShrink: 0,
  },

  // ── Landing ──
  landing: { flex: 1, overflowY: 'auto', padding: '28px 20px 20px' },
  landingAvatarRing: {
    width: 68, height: 68, borderRadius: '50%', marginBottom: 18,
    background: `linear-gradient(135deg, ${color.heroFrom}, ${color.heroTo})`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 10px 24px rgba(76,111,255,0.3), inset 0 1px 0 rgba(255,255,255,0.3)',
  },
  landingAvatar: { fontSize: 28 },
  landingHey: { fontSize: 15, color: color.inkDim, margin: '0 0 2px' },
  landingTitle: { fontSize: 26, fontWeight: 800, color: color.ink, margin: '0 0 26px', letterSpacing: -0.4, lineHeight: 1.25 },
  landingLabel: { fontSize: 11.5, fontWeight: 700, color: color.inkFaint, letterSpacing: 0.6, textTransform: 'uppercase', margin: '0 0 12px' },
  actionList: { display: 'flex', flexDirection: 'column', gap: 10 },
  actionCard: {
    display: 'flex', alignItems: 'center', gap: 13, width: '100%', textAlign: 'left',
    background: color.glass, backdropFilter: color.blur, WebkitBackdropFilter: color.blur,
    border: `1px solid ${color.glassBorder}`, boxShadow: theme.shadow.glass,
    borderRadius: radius.lg, padding: '14px 15px', cursor: 'pointer', animation: 'fadeUp 0.4s ease both',
  },
  actionIcon: {
    width: 42, height: 42, borderRadius: radius.md, display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 19, flexShrink: 0, boxShadow: theme.shadow.embossOut,
  },
  actionText: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' },
  actionTitle: { fontSize: 14, fontWeight: 700, color: color.ink },
  actionSub: { fontSize: 11.5, color: color.inkFaint, marginTop: 2 },

  // ── Message thread ──
  messageList: { flex: 1, overflowY: 'auto', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 8 },
  rowRight: { display: 'flex', justifyContent: 'flex-end', animation: 'bubbleIn 0.25s ease both' },
  rowLeft: { display: 'flex', alignItems: 'flex-end', gap: 8, animation: 'bubbleIn 0.25s ease both', flexWrap: 'wrap' },
  bubblePatient: {
    maxWidth: '72%', background: `linear-gradient(135deg, ${color.heroFrom}, ${color.blueDeep})`,
    borderRadius: '18px 18px 4px 18px', padding: '11px 15px', fontSize: 14, lineHeight: 1.5,
    color: '#fff', boxShadow: '0 4px 14px rgba(76,111,255,0.3)',
  },
  aiBadge: {
    width: 28, height: 28, borderRadius: '50%',
    background: color.glass, border: `1px solid ${color.glassBorder}`, boxShadow: theme.shadow.embossOut,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0,
  },
  bubbleAi: {
    maxWidth: '72%', background: color.glass, backdropFilter: color.blur, WebkitBackdropFilter: color.blur,
    border: `1px solid ${color.glassBorder}`, borderRadius: '18px 18px 18px 4px',
    padding: '11px 15px', fontSize: 14, lineHeight: 1.5, color: color.ink, boxShadow: theme.shadow.card,
  },
  typingBubble: {
    background: color.glass, border: `1px solid ${color.glassBorder}`, borderRadius: '18px 18px 18px 4px',
    padding: '12px 16px', display: 'flex', gap: 5, alignItems: 'center', boxShadow: theme.shadow.card,
  },
  typingDot: { width: 7, height: 7, borderRadius: '50%', background: color.inkFaint, display: 'inline-block', animation: 'typing 1.2s ease-in-out infinite' },
  actionBtn: {
    background: `linear-gradient(135deg, ${color.heroFrom}, ${color.blueDeep})`, border: 'none', borderRadius: 10,
    color: '#fff', fontSize: 13, fontWeight: 700, padding: '9px 16px', cursor: 'pointer', fontFamily: font.ui,
    boxShadow: '0 4px 12px rgba(76,111,255,0.3)',
  },

  // ── Input ──
  inputRow: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px calc(16px + env(safe-area-inset-bottom))',
    borderTop: `1px solid ${color.hairline}`, flexShrink: 0,
    background: color.glassStrong, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
  },
  attachBtn: {
    width: 38, height: 38, borderRadius: '50%', background: color.glass, border: `1px solid ${color.glassBorder}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0,
    boxShadow: theme.shadow.embossOut,
  },
  input: {
    flex: 1, minWidth: 0, background: color.glass, backdropFilter: color.blur, WebkitBackdropFilter: color.blur,
    border: `1px solid ${color.glassBorder}`, borderRadius: 24, padding: '11px 18px', fontSize: 14,
    color: color.ink, outline: 'none', fontFamily: font.ui, boxShadow: theme.shadow.embossIn,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: '50%',
    background: `linear-gradient(135deg, ${color.heroFrom}, ${color.blueDeep})`,
    border: 'none', color: '#fff', fontSize: 16, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    boxShadow: '0 4px 12px rgba(76,111,255,0.35)',
  },
};
