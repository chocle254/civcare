import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { theme } from '../../styles/theme';
import BottomNav from '../../components/BottomNav';

const API = process.env.REACT_APP_API_URL;
const { color, font, radius } = theme;

/* ─────────────────────────────────────────────────────────────
   ICONS
───────────────────────────────────────────────────────────── */

function Icon({ name, size = 20, stroke = 'currentColor', strokeWidth = 1.9 }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke,
    // Theme colours are CSS variables; inline style resolves var() reliably
    // where the SVG presentation attribute may not.
    style: { stroke },
    strokeWidth,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };

  const paths = {
    menu: (
      <>
        <path d="M4 6h16M4 12h16M4 18h16" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),
    arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    spark: (
      <>
        <path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z" />
        <path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" />
      </>
    ),
    pill: (
      <>
        <rect x="4" y="7" width="16" height="10" rx="5" transform="rotate(-45 12 12)" />
        <path d="m8.5 8.5 7 7" />
      </>
    ),
    history: (
      <>
        <path d="M4 5h16v15H4z" />
        <path d="M8 9h8M8 13h8M8 17h5" />
      </>
    ),
    doctor: (
      <>
        <circle cx="12" cy="8" r="3" />
        <path d="M5 20c.8-4 3.1-6 7-6s6.2 2 7 6" />
        <path d="M18 4v4M16 6h4" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    check: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 2.5 2.5L16 9" />
      </>
    ),
    alert: (
      <>
        <path d="M12 4 3.5 19h17L12 4Z" />
        <path d="M12 9v4M12 16h.01" />
      </>
    ),
    close: (
      <>
        <path d="m6 6 12 12M18 6 6 18" />
      </>
    ),
    profile: (
      <>
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5 20c.8-3.7 3.1-5.6 7-5.6s6.2 1.9 7 5.6" />
      </>
    ),
  };

  return <svg {...common}>{paths[name] || paths.spark}</svg>;
}

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */

const isUrlLike = (str) => /^https?:\/\//i.test((str || '').trim());

const cardTitle = (session) => {
  const raw = session.symptoms_summary || session.ai_assessment || '';
  if (!raw || isUrlLike(raw)) return 'Health consultation';
  return raw.length > 60 ? `${raw.slice(0, 60)}…` : raw;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) return `${diffDays}d ago`;

  return d.toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'short',
  });
};

const formatCountdown = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return 'Now';
};

const medicationInterval = (medication) => {
  const notation = medication?.dosage_notation || '1x1';
  const timesPerDay = parseInt(notation.split('x')[1], 10) || 1;
  return (24 / timesPerDay) * 60 * 60 * 1000;
};

const nextMedicationTime = (medication, now = Date.now()) => {
  if (!medication?.reminders_start_at) return null;

  const start = new Date(medication.reminders_start_at).getTime();
  if (!Number.isFinite(start)) return null;

  const interval = medicationInterval(medication);

  if (now <= start) return start;

  const elapsed = now - start;
  const cycles = Math.floor(elapsed / interval) + 1;

  return start + cycles * interval;
};

/* ─────────────────────────────────────────────────────────────
   MEDICATION SUMMARY
───────────────────────────────────────────────────────────── */

function MedicationSummary({ prescriptions, onOpen }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!prescriptions?.length) return undefined;

    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [prescriptions]);

  const medicationState = useMemo(() => {
    return (prescriptions || []).map((medication) => {
      const next = nextMedicationTime(medication, now);
      const remaining = next ? Math.max(0, next - now) : null;

      return {
        ...medication,
        next,
        remaining,
        due: remaining !== null && remaining <= 60000,
      };
    });
  }, [prescriptions, now]);

  if (!medicationState.length) return null;

  const dueNow = medicationState.filter((item) => item.due).length;
  const upcoming = medicationState
    .filter((item) => !item.due && item.remaining !== null)
    .sort((a, b) => a.remaining - b.remaining)
    .slice(0, 2);

  const due = medicationState.filter((item) => item.due);

  return (
    <section style={s.section}>
      <div style={s.sectionHeader}>
        <div>
          <p style={s.eyebrow}>Treatment</p>
          <h2 style={s.sectionTitle}>Your medications</h2>
        </div>

        <button style={s.textButton} onClick={onOpen}>
          View all
        </button>
      </div>

      <div style={s.medicationCard}>
        <div style={s.medicationHeader}>
          <div style={s.medicationIcon}>
            <Icon name="pill" size={19} stroke={color.blue} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={s.medicationHeading}>
              {dueNow > 0 ? 'Medication due now' : 'Treatment schedule'}
            </p>

            <p style={s.medicationSubheading}>
              {dueNow > 0
                ? `${dueNow} dose${dueNow === 1 ? '' : 's'} need your attention`
                : `${prescriptions.length} active medication${prescriptions.length === 1 ? '' : 's'}`}
            </p>
          </div>

          {dueNow > 0 && (
            <span style={s.dueBadge}>
              {dueNow}
            </span>
          )}
        </div>

        {due.length > 0 && (
          <div style={s.medicationDueBox}>
            {due.slice(0, 2).map((medication) => (
              <div key={medication.id || medication.prescription_id} style={s.medicationRow}>
                <div style={s.medicationStatusDot} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={s.medicationName}>
                    {medication.medication_name || 'Medication'}
                  </p>
                  <p style={s.medicationDose}>
                    {medication.dosage_notation || 'Follow prescribed dose'}
                  </p>
                </div>

                <span style={s.takeNow}>Due now</span>
              </div>
            ))}
          </div>
        )}

        {due.length === 0 && upcoming.length > 0 && (
          <div style={s.upcomingDose}>
            <div style={s.clockCircle}>
              <Icon name="clock" size={17} stroke={color.blue} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={s.nextDoseLabel}>Next dose</p>
              <p style={s.nextDoseName}>
                {upcoming[0].medication_name || 'Medication'}
              </p>
            </div>

            <div style={s.nextDoseTime}>
              {formatCountdown(upcoming[0].remaining)}
            </div>
          </div>
        )}

        <button
          style={s.medicationFooter}
          onClick={onOpen}
        >
          <span>Open treatment plan</span>
          <Icon name="arrow" size={16} stroke={color.blue} />
        </button>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   NOTIFICATIONS
───────────────────────────────────────────────────────────── */

function NotificationPanel({
  notifications,
  onClose,
  onRead,
  onOpenMedication,
  onOpenConsultation,
}) {
  return (
    <>
      <div style={s.notificationOverlay} onClick={onClose} />

      <aside style={s.notificationPanel}>
        <div style={s.notificationPanelHeader}>
          <div>
            <p style={s.eyebrow}>CivCare</p>
            <h2 style={s.notificationTitle}>Notifications</h2>
          </div>

          <button
            style={s.closeButton}
            onClick={onClose}
            aria-label="Close notifications"
          >
            <Icon name="close" size={19} />
          </button>
        </div>

        {notifications.length === 0 ? (
          <div style={s.notificationEmpty}>
            <div style={s.notificationEmptyIcon}>
              <Icon name="check" size={26} stroke={color.teal} />
            </div>

            <h3 style={s.emptyTitle}>You're all caught up</h3>
            <p style={s.emptyText}>
              Important care updates will appear here.
            </p>
          </div>
        ) : (
          <div style={s.notificationList}>
            {notifications.map((item) => (
              <button
                key={item.id}
                style={{
                  ...s.notificationItem,
                  ...(item.read ? s.notificationRead : {}),
                }}
                onClick={() => {
                  onRead(item.id);

                  if (item.type === 'medication') {
                    onOpenMedication();
                  } else if (item.type === 'consultation') {
                    onOpenConsultation();
                  }
                }}
              >
                <div
                  style={{
                    ...s.notificationIcon,
                    background:
                      item.type === 'medication'
                        ? color.blueDim
                        : color.tealDim,
                  }}
                >
                  <Icon
                    name={item.type === 'medication' ? 'pill' : 'doctor'}
                    size={18}
                    stroke={
                      item.type === 'medication'
                        ? color.blue
                        : color.teal
                    }
                  />
                </div>

                <div style={s.notificationContent}>
                  <div style={s.notificationItemTop}>
                    <p style={s.notificationItemTitle}>
                      {item.title}
                    </p>

                    {!item.read && <span style={s.unreadDot} />}
                  </div>

                  <p style={s.notificationItemText}>
                    {item.message}
                  </p>

                  <span style={s.notificationTime}>
                    {item.time}
                  </span>
                </div>

                <Icon name="chevron" size={16} stroke={color.inkFaint} />
              </button>
            ))}
          </div>
        )}
      </aside>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   MAIN DASHBOARD
───────────────────────────────────────────────────────────── */

export default function SessionDashboard() {
  const navigate = useNavigate();

  const patient = (() => {
    try {
      return JSON.parse(
        localStorage.getItem('civtech_patient') || '{}'
      );
    } catch {
      return {};
    }
  })();

  const [sessions, setSessions] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resumeSheet, setResumeSheet] = useState(null);
  const [pendingConsult, setPendingConsult] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationRead, setNotificationRead] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem('civcare_notification_read') || '[]'
      );
    } catch {
      return [];
    }
  });

  const [now, setNow] = useState(Date.now());
  const [dosePopup, setDosePopup] = useState(null);

  const firstName = (patient.name || 'there').split(' ')[0];

  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? 'Good morning'
      : hour < 17
        ? 'Good afternoon'
        : 'Good evening';

  const fetchData = useCallback(async () => {
    if (!patient.id) return;

    try {
      const [sessRes, presRes, pendRes] = await Promise.allSettled([
        axios.get(`${API}/triage/sessions/${patient.id}`),
        axios.get(`${API}/prescriptions/active/${patient.id}`),
        axios.get(`${API}/consultation/pending`, {
          params: { patient_id: patient.id },
        }),
      ]);

      if (sessRes.status === 'fulfilled') {
        setSessions(sessRes.value.data || []);
      }

      if (presRes.status === 'fulfilled') {
        setPrescriptions(presRes.value.data || []);
      }

      if (pendRes.status === 'fulfilled') {
        setPendingConsult(pendRes.value.data || null);
      }
    } catch (error) {
      console.error('Dashboard data loading failed:', error);
    } finally {
      setLoading(false);
    }
  }, [patient.id]);

  useEffect(() => {
    if (!patient.id) {
      navigate('/');
      return;
    }

    fetchData();
  }, [fetchData, navigate, patient.id]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  /* ─────────────────────────────────────────────────────────
     REAL-TIME MEDICATION NOTIFICATION
  ───────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!prescriptions.length) return;

    const dueMedication = prescriptions.find((medication) => {
      const next = nextMedicationTime(medication, now);

      return (
        next !== null &&
        now >= next &&
        now - next < 65000
      );
    });

    if (!dueMedication) return;

    const notificationId =
      `med-${dueMedication.id || dueMedication.prescription_id}-${Math.floor(now / 60000)}`;

    const alreadyShown =
      localStorage.getItem(`civcare_popup_${notificationId}`);

    if (!alreadyShown) {
      localStorage.setItem(
        `civcare_popup_${notificationId}`,
        'true'
      );

      setDosePopup(dueMedication);
    }
  }, [prescriptions, now]);

  const markNotificationRead = (id) => {
    setNotificationRead((previous) => {
      const next = previous.includes(id)
        ? previous
        : [...previous, id];

      localStorage.setItem(
        'civcare_notification_read',
        JSON.stringify(next)
      );

      return next;
    });
  };

  const notifications = useMemo(() => {
    const items = [];

    const dueMedications = prescriptions.filter((medication) => {
      const next = nextMedicationTime(medication, now);

      return next !== null && now >= next;
    });

    dueMedications.forEach((medication) => {
      const id =
        `med-due-${medication.id || medication.prescription_id}`;

      items.push({
        id,
        type: 'medication',
        title: 'Medication due',
        message: `${medication.medication_name || 'Your medication'} is due according to your treatment schedule.`,
        time: 'Now',
        read: notificationRead.includes(id),
      });
    });

    if (pendingConsult) {
      const id = 'consultation-pending';

      items.push({
        id,
        type: 'consultation',
        title: 'Consultation update',
        message: pendingConsult.doctor_name
          ? `Your consultation with Dr. ${pendingConsult.doctor_name} is waiting for your attention.`
          : 'You have a consultation waiting for your attention.',
        time: 'Current',
        read: notificationRead.includes(id),
      });
    }

    return items;
  }, [
    prescriptions,
    pendingConsult,
    notificationRead,
    now,
  ]);

  const unreadCount = notifications.filter(
    (item) => !item.read
  ).length;

  const handleLogout = () => {
    localStorage.clear();
    navigate('/', { replace: true });
  };

  const handleCardTap = (session) => {
    if (session.status === 'active') {
      setResumeSheet(session);
    } else {
      localStorage.setItem(
        'civtech_session_id',
        session.id
      );
      navigate('/chat');
    }
  };

  const handleResume = () => {
    if (!resumeSheet) return;

    localStorage.setItem(
      'civtech_session_id',
      resumeSheet.id
    );

    setResumeSheet(null);
    navigate('/chat');
  };

  const recentSessions = [...sessions]
    .sort(
      (a, b) =>
        new Date(b.started_at) -
        new Date(a.started_at)
    )
    .slice(0, 4);

  return (
    <div style={s.page}>
      <main style={s.main}>
        {/* HEADER */}

        <header style={s.header}>
          <button
            style={s.iconButton}
            className="cc-press"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <Icon name="menu" size={20} />
          </button>

          <button
            style={{
              ...s.iconButton,
              position: 'relative',
            }}
            className="cc-press"
            onClick={() => setNotificationOpen(true)}
            aria-label="Open notifications"
          >
            <Icon name="bell" size={19} />

            {unreadCount > 0 && (
              <span style={s.notificationBadge}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </header>

        {/* GREETING */}

        <section style={s.greeting}>
          <p style={s.greetingSmall}>{greeting}</p>

          <h1 style={s.greetingName}>
            {firstName}
          </h1>

          <p style={s.greetingSub}>
            Your CivCare overview
          </p>
        </section>

        {/* AI ASSISTANT */}

        <button
          style={s.aiHero}
          className="cc-press"
          onClick={() => {
            localStorage.removeItem(
              'civtech_session_id'
            );
            navigate('/chat');
          }}
        >
          <div style={s.aiHeroAccent} />

          <div style={s.aiHeroContent}>
            <div style={s.aiHeroLabel}>
              <Icon
                name="spark"
                size={13}
                stroke="#ffffff"
              />
              AI HEALTH ASSISTANT
            </div>

            <h2 style={s.aiHeroTitle}>
              How are you feeling today?
            </h2>

            <p style={s.aiHeroText}>
              Describe your symptoms and let CivCare
              guide your next step.
            </p>

            <span style={s.aiHeroButton}>
              Start health check
              <Icon
                name="arrow"
                size={15}
                stroke="#ffffff"
              />
            </span>
          </div>

          <div style={s.aiHeroMark}>
            <Icon
              name="spark"
              size={28}
              stroke="#ffffff"
            />
          </div>
        </button>

        {/* PENDING CONSULTATION */}

        {pendingConsult && (
          <button
            style={s.consultationBanner}
            className="cc-press"
            onClick={() =>
              navigate('/consultation/waiting')
            }
          >
            <div style={s.liveIndicator}>
              <span style={s.liveDot} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={s.consultationTitle}>
                {pendingConsult.doctor_name
                  ? `Dr. ${pendingConsult.doctor_name}`
                  : 'Consultation in progress'}
              </p>

              <p style={s.consultationSub}>
                Your consultation needs your attention
              </p>
            </div>

            <Icon
              name="chevron"
              size={17}
              stroke={color.teal}
            />
          </button>
        )}

        {/* MEDICATIONS */}

        <MedicationSummary
          prescriptions={prescriptions}
          onOpen={() => navigate('/medications')}
        />

        {/* RECENT CONSULTATIONS */}

        <section style={s.section}>
          <div style={s.sectionHeader}>
            <div>
              <p style={s.eyebrow}>Care activity</p>
              <h2 style={s.sectionTitle}>
                Recent consultations
              </h2>
            </div>

            <button
              style={s.textButton}
              onClick={() =>
                navigate('/diagnosis-history')
              }
            >
              View history
            </button>
          </div>

          {loading && (
            <div style={s.loadingStack}>
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  style={s.skeleton}
                />
              ))}
            </div>
          )}

          {!loading && sessions.length === 0 && (
            <div style={s.emptyCard}>
              <div style={s.emptyIcon}>
                <Icon
                  name="history"
                  size={22}
                  stroke={color.blue}
                />
              </div>

              <h3 style={s.emptyTitle}>
                No consultations yet
              </h3>

              <p style={s.emptyText}>
                Start an AI health check whenever
                you need help deciding your next step.
              </p>
            </div>
          )}

          {!loading &&
            recentSessions.map((session, index) => {
              const isActive =
                session.status === 'active';

              return (
                <button
                  key={session.id}
                  style={{
                    ...s.historyCard,
                    animationDelay:
                      `${index * 0.05}s`,
                  }}
                  className="cc-press"
                  onClick={() =>
                    handleCardTap(session)
                  }
                >
                  <div style={s.historyIcon}>
                    <Icon
                      name="history"
                      size={18}
                      stroke={color.blue}
                    />
                  </div>

                  <div style={s.historyBody}>
                    <div style={s.historyTop}>
                      <p style={s.historyTitle}>
                        {cardTitle(session)}
                      </p>

                      {isActive && (
                        <span style={s.activeBadge}>
                          Active
                        </span>
                      )}
                    </div>

                    <span style={s.historyDate}>
                      {formatDate(
                        session.started_at
                      )}
                    </span>
                  </div>

                  <Icon
                    name="chevron"
                    size={16}
                    stroke={color.inkFaint}
                  />
                </button>
              );
            })}
        </section>

        {/* QUICK ACTIONS */}

        <section style={s.section}>
          <div style={s.sectionHeader}>
            <div>
              <p style={s.eyebrow}>Quick access</p>
              <h2 style={s.sectionTitle}>
                Your care
              </h2>
            </div>
          </div>

          <div style={s.quickGrid}>
            <button
              style={s.quickCard}
              className="cc-press"
              onClick={() =>
                navigate('/medications')
              }
            >
              <div
                style={{
                  ...s.quickIcon,
                  background: color.blueDim,
                }}
              >
                <Icon
                  name="pill"
                  size={19}
                  stroke={color.blue}
                />
              </div>

              <span style={s.quickLabel}>
                Medications
              </span>
            </button>

            <button
              style={s.quickCard}
              className="cc-press"
              onClick={() =>
                navigate('/diagnosis-history')
              }
            >
              <div
                style={{
                  ...s.quickIcon,
                  background: color.violetDim,
                }}
              >
                <Icon
                  name="history"
                  size={19}
                  stroke={color.violet}
                />
              </div>

              <span style={s.quickLabel}>
                Medical history
              </span>
            </button>

            <button
              style={s.quickCard}
              className="cc-press"
              onClick={() =>
                navigate('/consultation')
              }
            >
              <div
                style={{
                  ...s.quickIcon,
                  background: color.tealDim,
                }}
              >
                <Icon
                  name="doctor"
                  size={19}
                  stroke={color.teal}
                />
              </div>

              <span style={s.quickLabel}>
                Doctors
              </span>
            </button>
          </div>
        </section>

        <div style={{ height: 110 }} />
      </main>

      <BottomNav active="home" />

      {/* NOTIFICATION PANEL */}

      {notificationOpen && (
        <NotificationPanel
          notifications={notifications}
          onClose={() =>
            setNotificationOpen(false)
          }
          onRead={markNotificationRead}
          onOpenMedication={() => {
            setNotificationOpen(false);
            navigate('/medications');
          }}
          onOpenConsultation={() => {
            setNotificationOpen(false);
            navigate('/consultation/waiting');
          }}
        />
      )}

      {/* MEDICATION DUE POPUP */}

      {dosePopup && (
        <>
          <div
            style={s.popupOverlay}
            onClick={() => setDosePopup(null)}
          />

          <div style={s.dosePopup}>
            <div style={s.popupHandle} />

            <div style={s.popupIcon}>
              <Icon
                name="pill"
                size={24}
                stroke={color.blue}
              />
            </div>

            <p style={s.eyebrow}>
              Medication reminder
            </p>

            <h2 style={s.popupTitle}>
              Time to take your medication
            </h2>

            <p style={s.popupMedication}>
              {dosePopup.medication_name ||
                'Your medication'}
            </p>

            <p style={s.popupDose}>
              {dosePopup.dosage_notation ||
                'Follow your prescribed dose'}
            </p>

            <button
              style={s.popupPrimary}
              className="cc-press"
              onClick={() => {
                setDosePopup(null);
                navigate('/medications');
              }}
            >
              View treatment
            </button>

            <button
              style={s.popupSecondary}
              onClick={() =>
                setDosePopup(null)
              }
            >
              Remind me later
            </button>
          </div>
        </>
      )}

      {/* MENU */}

      {menuOpen && (
        <>
          <div
            style={s.overlay}
            onClick={() => setMenuOpen(false)}
          />

          <div style={s.menuSheet}>
            <div style={s.sheetHandle} />

            <div style={s.profileHeader}>
              <div style={s.profileAvatar}>
                <Icon
                  name="profile"
                  size={22}
                  stroke={color.blue}
                />
              </div>

              <div>
                <p style={s.menuName}>
                  {patient.name || 'Patient'}
                </p>

                <p style={s.menuSub}>
                  {patient.phone || ''}
                </p>
              </div>
            </div>

            <button
              style={s.menuItem}
              onClick={() => {
                setMenuOpen(false);
                navigate('/profile');
              }}
            >
              <Icon
                name="profile"
                size={18}
              />
              Profile
            </button>

            <button
              style={s.menuItem}
              onClick={() => {
                setMenuOpen(false);
                navigate('/diagnosis-history');
              }}
            >
              <Icon
                name="history"
                size={18}
              />
              Medical history
            </button>

            <button
              style={s.menuItem}
              onClick={() => {
                setMenuOpen(false);
                navigate('/medications');
              }}
            >
              <Icon
                name="pill"
                size={18}
              />
              Medications
            </button>

            <button
              style={{
                ...s.menuItem,
                color: color.coral,
              }}
              onClick={handleLogout}
            >
              Sign out
            </button>
          </div>
        </>
      )}

      {/* RESUME SESSION */}

      {resumeSheet && (
        <>
          <div
            style={s.overlay}
            onClick={() => setResumeSheet(null)}
          />

          <div style={s.sheet}>
            <div style={s.sheetHandle} />

            <p style={s.eyebrow}>
              Continuing session
            </p>

            <h2 style={s.sheetTitle}>
              {cardTitle(resumeSheet)}
            </h2>

            <p style={s.sheetSub}>
              Your previous conversation is still
              available and can continue from where
              you stopped.
            </p>

            {resumeSheet.last_message &&
              !isUrlLike(
                resumeSheet.last_message
              ) && (
                <div style={s.sheetPreview}>
                  <p style={s.eyebrow}>
                    Last message
                  </p>

                  <p style={s.sheetPreviewText}>
                    “{resumeSheet.last_message}”
                  </p>
                </div>
              )}

            <button
              style={s.sheetPrimary}
              className="cc-press"
              onClick={handleResume}
            >
              Resume conversation
            </button>

            <button
              style={s.sheetCancel}
              onClick={() =>
                setResumeSheet(null)
              }
            >
              Not now
            </button>
          </div>
        </>
      )}

      <style>{`
        ${theme.fontImport}

        * {
          box-sizing: border-box;
        }

        button {
          font-family: inherit;
        }

        button:focus-visible {
          outline: 2px solid ${color.blue};
          outline-offset: 2px;
        }

        ${theme.motionCss}

        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes sheetUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }

        @keyframes panelIn {
          from {
            opacity: 0;
            transform: translateX(18px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes pulseDot {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(22,179,120,0.25);
          }
          50% {
            box-shadow: 0 0 0 7px rgba(22,179,120,0);
          }
        }

        @keyframes popupIn {
          from {
            opacity: 0;
            transform: translate(-50%, 30px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }

        .cc-press {
          transition:
            transform 160ms ease,
            box-shadow 160ms ease,
            opacity 160ms ease;
        }

        .cc-press:active {
          transform: scale(0.985);
        }

        @media (min-width: 700px) {
          .cc-dashboard-main {
            max-width: 760px !important;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   STYLES
───────────────────────────────────────────────────────────── */

const s = {
  page: {
    minHeight: '100vh',
    width: '100%',
    background: color.bgGradient,
    color: color.ink,
    fontFamily: font.ui,
    overflowX: 'hidden',
  },

  main: {
    position: 'relative',
    width: '100%',
    maxWidth: 760,
    margin: '0 auto',
    padding: '18px 20px 0',
  },

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },

  iconButton: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    border: `1px solid ${color.glassBorder}`,
    background: color.glass,
    color: color.ink,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: theme.shadow.glass,
  },

  notificationBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    padding: '0 5px',
    borderRadius: 20,
    background: color.coral,
    color: '#fff',
    border: `2px solid ${color.bgElevated || color.bg}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 9,
    fontWeight: 800,
    lineHeight: 1,
  },

  greeting: {
    marginBottom: 20,
  },

  greetingSmall: {
    margin: 0,
    fontSize: 14,
    color: color.inkDim,
  },

  greetingName: {
    margin: '3px 0 3px',
    fontSize: 30,
    lineHeight: 1.1,
    letterSpacing: -0.7,
    fontWeight: 800,
    color: color.ink,
  },

  greetingSub: {
    margin: 0,
    fontSize: 13.5,
    color: color.inkFaint,
  },

  aiHero: {
    position: 'relative',
    width: '100%',
    minHeight: 205,
    padding: 24,
    marginBottom: 20,
    overflow: 'hidden',
    textAlign: 'left',
    border: 'none',
    borderRadius: radius.xl,
    cursor: 'pointer',
    color: '#fff',
    background: `linear-gradient(135deg, ${color.heroFrom}, ${color.heroTo})`,
    boxShadow: theme.shadow.card,
    display: 'flex',
    alignItems: 'center',
  },

  aiHeroAccent: {
    position: 'absolute',
    width: 190,
    height: 190,
    right: -55,
    top: -70,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.12)',
  },

  aiHeroContent: {
    position: 'relative',
    zIndex: 2,
    maxWidth: 520,
  },

  aiHeroLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 9.5,
    fontWeight: 800,
    letterSpacing: 1,
    padding: '6px 9px',
    borderRadius: 99,
    background: 'rgba(255,255,255,0.16)',
    border: '1px solid rgba(255,255,255,0.2)',
    marginBottom: 13,
  },

  aiHeroTitle: {
    margin: 0,
    maxWidth: 380,
    fontSize: 24,
    lineHeight: 1.2,
    fontWeight: 800,
    letterSpacing: -0.5,
  },

  aiHeroText: {
    margin: '8px 0 18px',
    maxWidth: 390,
    fontSize: 12.5,
    lineHeight: 1.55,
    color: 'rgba(255,255,255,0.82)',
  },

  aiHeroButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    borderRadius: 999,
    background: 'rgba(10,18,38,0.84)',
    fontSize: 12,
    fontWeight: 700,
  },

  aiHeroMark: {
    position: 'absolute',
    right: 28,
    bottom: 28,
    width: 66,
    height: 66,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255,255,255,0.12)',
    border: '1px solid rgba(255,255,255,0.2)',
  },

  consultationBanner: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 15px',
    marginBottom: 20,
    borderRadius: radius.lg,
    border: `1px solid rgba(22,179,120,0.28)`,
    background: color.glass,
    color: color.ink,
    textAlign: 'left',
    cursor: 'pointer',
    boxShadow: theme.shadow.glass,
  },

  liveIndicator: {
    width: 32,
    height: 32,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: color.tealDim,
    flexShrink: 0,
  },

  liveDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: color.teal,
    animation: 'pulseDot 1.8s infinite',
  },

  consultationTitle: {
    margin: 0,
    fontSize: 13.5,
    fontWeight: 700,
    color: color.ink,
  },

  consultationSub: {
    margin: '3px 0 0',
    fontSize: 11.5,
    color: color.inkFaint,
  },

  section: {
    marginBottom: 24,
  },

  sectionHeader: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 11,
  },

  eyebrow: {
    margin: '0 0 4px',
    fontSize: 10,
    lineHeight: 1.2,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    fontWeight: 800,
    color: color.inkFaint,
  },

  sectionTitle: {
    margin: 0,
    fontSize: 17,
    fontWeight: 750,
    letterSpacing: -0.2,
    color: color.ink,
  },

  textButton: {
    padding: 0,
    border: 'none',
    background: 'none',
    color: color.blue,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  medicationCard: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    border: `1px solid ${color.glassBorder}`,
    background: color.glass,
    boxShadow: theme.shadow.glass,
  },

  medicationHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 11,
    padding: '16px 16px 14px',
  },

  medicationIcon: {
    width: 38,
    height: 38,
    flexShrink: 0,
    borderRadius: 11,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: color.blueDim,
  },

  medicationHeading: {
    margin: 0,
    fontSize: 13.5,
    fontWeight: 700,
    color: color.ink,
  },

  medicationSubheading: {
    margin: '3px 0 0',
    fontSize: 11.5,
    color: color.inkFaint,
  },

  dueBadge: {
    minWidth: 22,
    height: 22,
    padding: '0 6px',
    borderRadius: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: color.coral,
    color: '#fff',
    fontSize: 10,
    fontWeight: 800,
  },

  medicationDueBox: {
    margin: '0 12px 10px',
    padding: '3px 11px',
    borderRadius: radius.md,
    background: color.coralDim,
    border: `1px solid rgba(235,91,91,0.14)`,
  },

  medicationRow: {
    minHeight: 58,
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    borderBottom: `1px solid rgba(235,91,91,0.1)`,
  },

  medicationStatusDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: color.coral,
    flexShrink: 0,
  },

  medicationName: {
    margin: 0,
    fontSize: 13,
    fontWeight: 700,
    color: color.ink,
  },

  medicationDose: {
    margin: '3px 0 0',
    fontSize: 11,
    color: color.inkDim,
  },

  takeNow: {
    fontSize: 10.5,
    fontWeight: 800,
    color: color.coral,
    whiteSpace: 'nowrap',
  },

  upcomingDose: {
    display: 'flex',
    alignItems: 'center',
    gap: 11,
    margin: '0 12px 10px',
    padding: '12px',
    borderRadius: radius.md,
    background: color.surfaceMuted,
  },

  clockCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: color.blueDim,
    flexShrink: 0,
  },

  nextDoseLabel: {
    margin: 0,
    fontSize: 10.5,
    color: color.inkFaint,
  },

  nextDoseName: {
    margin: '2px 0 0',
    fontSize: 12.5,
    fontWeight: 700,
    color: color.ink,
  },

  nextDoseTime: {
    fontSize: 13,
    fontWeight: 800,
    color: color.blue,
    whiteSpace: 'nowrap',
  },

  medicationFooter: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    border: 'none',
    borderTop: `1px solid ${color.hairline}`,
    background: 'transparent',
    color: color.blue,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },

  historyCard: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 11,
    padding: '13px',
    marginBottom: 8,
    border: `1px solid ${color.glassBorder}`,
    borderRadius: radius.md,
    background: color.glass,
    color: color.ink,
    textAlign: 'left',
    cursor: 'pointer',
    boxShadow: theme.shadow.glass,
    animation: 'fadeUp 0.45s ease both',
  },

  historyIcon: {
    width: 38,
    height: 38,
    flexShrink: 0,
    borderRadius: 11,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: color.blueDim,
  },

  historyBody: {
    flex: 1,
    minWidth: 0,
  },

  historyTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },

  historyTitle: {
    flex: 1,
    minWidth: 0,
    margin: 0,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    fontSize: 13,
    fontWeight: 650,
    color: color.ink,
  },

  historyDate: {
    fontSize: 11,
    color: color.inkFaint,
  },

  activeBadge: {
    flexShrink: 0,
    padding: '3px 7px',
    borderRadius: 99,
    background: color.tealDim,
    color: color.teal,
    fontSize: 9,
    fontWeight: 800,
  },

  quickGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 9,
  },

  quickCard: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 10,
    padding: '13px 12px',
    border: `1px solid ${color.glassBorder}`,
    borderRadius: radius.md,
    background: color.glass,
    color: color.ink,
    cursor: 'pointer',
    textAlign: 'left',
    boxShadow: theme.shadow.glass,
  },

  quickIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  quickLabel: {
    fontSize: 11.5,
    lineHeight: 1.25,
    fontWeight: 700,
  },

  loadingStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },

  skeleton: {
    height: 64,
    borderRadius: radius.md,
    background: `linear-gradient(
      90deg,
      ${color.surfaceMuted} 25%,
      ${color.surfaceRaised} 50%,
      ${color.surfaceMuted} 75%
    )`,
    backgroundSize: '400px 100%',
    animation: 'shimmer 1.6s infinite',
  },

  emptyCard: {
    padding: '28px 20px',
    textAlign: 'center',
    borderRadius: radius.lg,
    border: `1px solid ${color.glassBorder}`,
    background: color.glass,
    boxShadow: theme.shadow.glass,
  },

  emptyIcon: {
    width: 46,
    height: 46,
    margin: '0 auto 12px',
    borderRadius: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: color.blueDim,
  },

  emptyTitle: {
    margin: '0 0 5px',
    fontSize: 14,
    fontWeight: 700,
    color: color.ink,
  },

  emptyText: {
    maxWidth: 360,
    margin: '0 auto',
    fontSize: 12,
    lineHeight: 1.55,
    color: color.inkFaint,
  },

  /* NOTIFICATIONS */

  notificationOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 300,
    background: 'rgba(10,16,30,0.36)',
    backdropFilter: 'blur(3px)',
  },

  notificationPanel: {
    position: 'fixed',
    zIndex: 301,
    top: 0,
    right: 0,
    bottom: 0,
    width: 'min(420px, 92vw)',
    overflowY: 'auto',
    padding: '22px 18px 30px',
    background: color.bgElevated || color.bg,
    borderLeft: `1px solid ${color.glassBorder}`,
    boxShadow: '-18px 0 45px rgba(20,30,60,0.16)',
    animation: 'panelIn 220ms ease both',
  },

  notificationPanelHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 22,
  },

  notificationTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 800,
    color: color.ink,
  },

  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 11,
    border: `1px solid ${color.glassBorder}`,
    background: color.glass,
    color: color.ink,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },

  notificationList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },

  notificationItem: {
    width: '100%',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '13px',
    borderRadius: radius.md,
    border: `1px solid ${color.glassBorder}`,
    background: color.glass,
    color: color.ink,
    textAlign: 'left',
    cursor: 'pointer',
  },

  notificationRead: {
    opacity: 0.62,
  },

  notificationIcon: {
    width: 38,
    height: 38,
    flexShrink: 0,
    borderRadius: 11,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  notificationContent: {
    flex: 1,
    minWidth: 0,
  },

  notificationItemTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },

  notificationItemTitle: {
    flex: 1,
    margin: 0,
    fontSize: 12.5,
    fontWeight: 750,
    color: color.ink,
  },

  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: color.blue,
    flexShrink: 0,
  },

  notificationItemText: {
    margin: '4px 0',
    fontSize: 11.5,
    lineHeight: 1.45,
    color: color.inkDim,
  },

  notificationTime: {
    fontSize: 10,
    color: color.inkFaint,
  },

  notificationEmpty: {
    padding: '70px 20px',
    textAlign: 'center',
  },

  notificationEmptyIcon: {
    width: 58,
    height: 58,
    margin: '0 auto 15px',
    borderRadius: 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: color.tealDim,
  },

  /* POPUP */

  popupOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 400,
    background: 'rgba(10,16,30,0.42)',
    backdropFilter: 'blur(3px)',
  },

  dosePopup: {
    position: 'fixed',
    zIndex: 401,
    left: '50%',
    bottom: 20,
    width: 'min(440px, calc(100vw - 32px))',
    padding: '18px 20px 20px',
    borderRadius: 22,
    background: color.glassStrong || color.bgElevated || color.bg,
    border: `1px solid ${color.glassBorder}`,
    boxShadow: '0 18px 50px rgba(15,25,55,0.25)',
    transform: 'translateX(-50%)',
    animation: 'popupIn 260ms ease both',
  },

  popupHandle: {
    width: 34,
    height: 4,
    margin: '0 auto 18px',
    borderRadius: 99,
    background: color.hairlineStrong,
  },

  popupIcon: {
    width: 48,
    height: 48,
    marginBottom: 13,
    borderRadius: 15,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: color.blueDim,
  },

  popupTitle: {
    margin: '0 0 7px',
    fontSize: 20,
    lineHeight: 1.25,
    fontWeight: 800,
    color: color.ink,
  },

  popupMedication: {
    margin: 0,
    fontSize: 14,
    fontWeight: 700,
    color: color.blue,
  },

  popupDose: {
    margin: '4px 0 18px',
    fontSize: 12,
    color: color.inkFaint,
  },

  popupPrimary: {
    width: '100%',
    padding: '13px',
    border: 'none',
    borderRadius: radius.md,
    background: color.blue,
    color: color.onPrimary,
    fontSize: 13.5,
    fontWeight: 750,
    cursor: 'pointer',
  },

  popupSecondary: {
    width: '100%',
    padding: '11px',
    border: 'none',
    background: 'transparent',
    color: color.inkFaint,
    fontSize: 12.5,
    cursor: 'pointer',
  },

  /* SHEETS */

  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 200,
    background: 'rgba(10,16,30,0.4)',
    backdropFilter: 'blur(2px)',
  },

  sheet: {
    position: 'fixed',
    zIndex: 201,
    left: 0,
    right: 0,
    bottom: 0,
    maxWidth: 760,
    margin: '0 auto',
    padding: '18px 22px 34px',
    borderRadius: '24px 24px 0 0',
    border: `1px solid ${color.glassBorder}`,
    borderBottom: 'none',
    background: color.glassStrong || color.bgElevated || color.bg,
    boxShadow: '0 -16px 45px rgba(20,30,60,0.18)',
    animation: 'sheetUp 280ms ease both',
  },

  menuSheet: {
    position: 'fixed',
    zIndex: 201,
    left: 0,
    right: 0,
    bottom: 0,
    maxWidth: 760,
    margin: '0 auto',
    padding: '18px 22px 34px',
    borderRadius: '24px 24px 0 0',
    border: `1px solid ${color.glassBorder}`,
    borderBottom: 'none',
    background: color.glassStrong || color.bgElevated || color.bg,
    boxShadow: '0 -16px 45px rgba(20,30,60,0.18)',
    animation: 'sheetUp 280ms ease both',
  },

  sheetHandle: {
    width: 36,
    height: 4,
    margin: '0 auto 20px',
    borderRadius: 99,
    background: color.hairlineStrong,
  },

  profileHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 11,
    paddingBottom: 17,
  },

  profileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: color.blueDim,
  },

  menuName: {
    margin: 0,
    fontSize: 16,
    fontWeight: 800,
    color: color.ink,
  },

  menuSub: {
    margin: '3px 0 0',
    fontSize: 12,
    color: color.inkFaint,
  },

  menuItem: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 2px',
    border: 'none',
    borderTop: `1px solid ${color.hairline}`,
    background: 'transparent',
    color: color.ink,
    fontSize: 13.5,
    fontWeight: 600,
    textAlign: 'left',
    cursor: 'pointer',
  },

  sheetTitle: {
    margin: '0 0 8px',
    fontSize: 20,
    fontWeight: 800,
    color: color.ink,
  },

  sheetSub: {
    margin: '0 0 16px',
    fontSize: 13,
    lineHeight: 1.55,
    color: color.inkDim,
  },

  sheetPreview: {
    marginBottom: 17,
    padding: '12px 14px',
    borderRadius: radius.md,
    background: color.surfaceMuted,
  },

  sheetPreviewText: {
    margin: 0,
    fontSize: 12.5,
    lineHeight: 1.5,
    color: color.inkDim,
    fontStyle: 'italic',
  },

  sheetPrimary: {
    width: '100%',
    padding: '14px',
    marginBottom: 5,
    border: 'none',
    borderRadius: radius.md,
    background: color.blue,
    color: color.onPrimary,
    fontSize: 13.5,
    fontWeight: 750,
    cursor: 'pointer',
    boxShadow: theme.shadow.card,
  },

  sheetCancel: {
    width: '100%',
    padding: '11px',
    border: 'none',
    background: 'transparent',
    color: color.inkFaint,
    fontSize: 12.5,
    cursor: 'pointer',
  },
};
