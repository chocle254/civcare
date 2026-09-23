import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';

const PREVIEW_MODE = process.env.REACT_APP_UI_PREVIEW === 'true';

const previewHistory = [
  {
    id: 'preview-1',
    date: '2026-09-18T10:30:00',
    doctor_name: 'Grace Wanjiku',
    hospital_name: 'CivCare Medical Centre',
    severity: 'moderate',
    diagnosis: 'Malaria',
    symptoms: 'Fever, headache, body weakness and chills',
    ai_assessment: 'The AI assessment identified malaria as a possible condition based on the reported symptoms and patient information.',
    notes: 'Patient advised to complete the prescribed treatment and return if symptoms worsen.',
    prescriptions: [
      { name: 'Artemether / Lumefantrine', notes: 'Take as prescribed by the doctor.' },
      { name: 'Paracetamol', notes: 'Use as prescribed for fever or pain.' }
    ],
    ai_rating: 4
  },
  {
    id: 'preview-2',
    date: '2026-08-27T14:15:00',
    doctor_name: 'David Kiptoo',
    hospital_name: 'CivCare Medical Centre',
    severity: 'mild',
    diagnosis: 'Upper respiratory tract infection',
    symptoms: 'Sore throat, mild cough and nasal congestion',
    ai_assessment: 'The AI assessment indicated a low-risk respiratory presentation requiring clinical review.',
    notes: 'Rest, fluids and prescribed medication recommended.',
    prescriptions: [
      { name: 'Cetirizine', notes: 'Take as prescribed.' }
    ],
    ai_rating: 5
  },
  {
    id: 'preview-3',
    date: '2026-07-12T09:00:00',
    doctor_name: 'Mercy Achieng',
    hospital_name: 'Nandi Hills Hospital',
    severity: 'mild',
    diagnosis: 'Gastritis',
    symptoms: 'Stomach discomfort and nausea',
    ai_assessment: 'Symptoms were assessed as potentially consistent with gastritis.',
    notes: 'Patient advised to avoid known stomach irritants and follow the treatment plan.',
    prescriptions: [
      { name: 'Omeprazole', notes: 'Take as prescribed before meals.' }
    ],
    ai_rating: 4
  }
];

function Icon({ name, size = 20 }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round'
  };

  const paths = {
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    back: <path d="m15 18-6-6 6-6" />,
    close: (
      <>
        <path d="M6 6l12 12" />
        <path d="M18 6 6 18" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="4" width="18" height="17" rx="3" />
        <path d="M16 2v4M8 2v4M3 9h18" />
      </>
    ),
    doctor: (
      <>
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5 21a7 7 0 0 1 14 0" />
      </>
    ),
    hospital: (
      <>
        <path d="M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16" />
        <path d="M9 7h6M12 4v6M8 13h2M14 13h2M8 17h2M14 17h2" />
      </>
    ),
    pill: (
      <>
        <path d="M8.5 3.5a5 5 0 0 1 7 7L10 16a5 5 0 0 1-7-7l5.5-5.5Z" />
        <path d="m6 6 6 6" />
      </>
    ),
    chevron: <path d="m9 18 6-6-6-6" />
  };

  return <svg {...common}>{paths[name]}</svg>;
}

export default function DiagnosisHistory() {
  const navigate = useNavigate();

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [groupBy, setGroupBy] = useState('month');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [openGroups, setOpenGroups] = useState({});

  useEffect(() => {
    const pat = JSON.parse(localStorage.getItem('civtech_patient') || '{}');

    if (!pat.id) {
      if (PREVIEW_MODE) {
        setHistory(previewHistory);
        setLoading(false);
        return;
      }

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

  const getHospital = (record) =>
    record.hospital_name ||
    record.hospital ||
    record.facility_name ||
    record.facility ||
    'Hospital not recorded';

  const getDoctor = (record) =>
    record.doctor_name ? `Dr. ${record.doctor_name}` : 'Doctor not recorded';

  const getDiagnosis = (record) =>
    record.diagnosis || record.condition || 'Diagnosis not recorded';

  const formatDate = (value) => {
    if (!value) return 'Unknown date';

    return new Date(value).toLocaleDateString('en-KE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatMonth = (value) => {
    if (!value) return 'Unknown date';

    return new Date(value).toLocaleDateString('en-KE', {
      month: 'long',
      year: 'numeric'
    });
  };

  const getSeverityClass = (severity) => {
    if (!severity) return 'mild';

    const value = severity.toLowerCase();

    if (value === 'severe') return 'severe';
    if (value === 'moderate') return 'moderate';

    return 'mild';
  };

  const filteredHistory = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return history;

    return history.filter((record) => {
      const medicationText = (record.prescriptions || [])
        .map((rx) => `${rx.name || ''} ${rx.notes || ''}`)
        .join(' ');

      const searchable = [
        getDiagnosis(record),
        getDoctor(record),
        getHospital(record),
        record.notes || '',
        record.symptoms || '',
        medicationText
      ]
        .join(' ')
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [history, search]);

  const groupedHistory = useMemo(() => {
    const groups = {};

    filteredHistory.forEach((record) => {
      let key;

      if (groupBy === 'month') {
        key = formatMonth(record.date);
      } else if (groupBy === 'condition') {
        key = getDiagnosis(record);
      } else {
        key = getHospital(record);
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(record);
    });

    return Object.entries(groups);
  }, [filteredHistory, groupBy]);

  return (
    <div className="history-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .history-page {
          min-height: 100vh;
          background: #f5f7fa;
          color: #172033;
          padding: 28px;
          font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .history-shell {
          max-width: 1180px;
          margin: 0 auto;
        }

        .topbar {
          display: flex;
          align-items: center;
          gap: 18px;
          margin-bottom: 28px;
        }

        .back-button {
          width: 42px;
          height: 42px;
          border: 1px solid #dce2ea;
          background: #fff;
          color: #25334a;
          border-radius: 12px;
          display: grid;
          place-items: center;
          cursor: pointer;
        }

        .heading h1 {
          margin: 0;
          font-size: 30px;
          letter-spacing: -0.7px;
        }

        .heading p {
          margin: 5px 0 0;
          color: #6d788a;
          font-size: 14px;
        }

        .toolbar {
          background: #fff;
          border: 1px solid #e1e6ed;
          border-radius: 18px;
          padding: 16px;
          margin-bottom: 26px;
          display: flex;
          gap: 14px;
          align-items: center;
          justify-content: space-between;
        }

        .search {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
          max-width: 470px;
          border: 1px solid #dce2ea;
          border-radius: 12px;
          padding: 0 13px;
          height: 46px;
          color: #7a8494;
        }

        .search input {
          border: 0;
          outline: 0;
          width: 100%;
          height: 100%;
          font-size: 14px;
          background: transparent;
          color: inherit;
        }

        .filters {
          display: flex;
          gap: 5px;
          background: #f1f4f7;
          border-radius: 11px;
          padding: 4px;
        }

        .filter {
          border: 0;
          background: transparent;
          color: #687386;
          border-radius: 8px;
          padding: 9px 12px;
          font-size: 13px;
          cursor: pointer;
        }

        .filter.active {
          background: #fff;
          color: #1769aa;
          box-shadow: 0 1px 4px rgba(20, 40, 70, .08);
          font-weight: 600;
        }

        .preview-banner {
          margin-bottom: 20px;
          padding: 11px 14px;
          border-radius: 12px;
          background: #eef7fc;
          border: 1px solid #cfe7f4;
          color: #28617e;
          font-size: 13px;
        }

        .group {
          margin-bottom: 16px;
          background: #fff;
          border: 1px solid #e1e6ed;
          border-radius: 18px;
          overflow: hidden;
        }

        .folder-header {
          width: 100%;
          border: 0;
          background: transparent;
          padding: 17px 18px;
          display: flex;
          align-items: center;
          gap: 13px;
          cursor: pointer;
          text-align: left;
          color: inherit;
        }

        .folder-icon {
          width: 43px;
          height: 43px;
          flex: 0 0 auto;
          border-radius: 12px;
          background: #edf6fb;
          color: #1769aa;
          display: grid;
          place-items: center;
        }

        .folder-info {
          min-width: 0;
          flex: 1;
        }

        .folder-title {
          margin: 0;
          color: #26344a;
          font-size: 16px;
          font-weight: 700;
        }

        .folder-count {
          margin: 4px 0 0;
          color: #788496;
          font-size: 12px;
        }

        .folder-arrow {
          color: #7a8797;
          transition: transform .18s ease;
        }

        .folder-arrow.open {
          transform: rotate(90deg);
        }

        .folder-content {
          padding: 0 14px 14px;
        }

        .records {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .record {
          background: #fff;
          border: 1px solid #e1e6ed;
          border-radius: 17px;
          padding: 19px;
          cursor: pointer;
          transition: transform .15s ease, border-color .15s ease, box-shadow .15s ease;
        }

        .record:hover {
          transform: translateY(-2px);
          border-color: #c7d7e5;
          box-shadow: 0 8px 25px rgba(31, 51, 75, .07);
        }

        .record-top {
          display: flex;
          justify-content: space-between;
          gap: 14px;
        }

        .date {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #768194;
          font-size: 12px;
        }

        .severity {
          padding: 5px 9px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: .4px;
        }

        .severity.mild {
          background: #eaf7f0;
          color: #258457;
        }

        .severity.moderate {
          background: #fff4df;
          color: #9a6a15;
        }

        .severity.severe {
          background: #fdecec;
          color: #bb4646;
        }

        .diagnosis {
          margin: 15px 0 5px;
          font-size: 19px;
          font-weight: 700;
          color: #18243a;
        }

        .doctor {
          margin: 0;
          color: #5e6b7d;
          font-size: 13px;
        }

        .record-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 18px;
          padding-top: 15px;
          border-top: 1px solid #edf0f4;
        }

        .meta {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #697589;
          font-size: 12px;
        }

        .view {
          margin-top: 17px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: #1769aa;
          font-size: 13px;
          font-weight: 600;
        }

        .loading,
        .empty {
          background: #fff;
          border: 1px solid #e1e6ed;
          border-radius: 18px;
          padding: 50px 25px;
          text-align: center;
        }

        .empty h2 {
          margin: 0 0 7px;
          font-size: 20px;
        }

        .empty p {
          margin: 0;
          color: #748093;
          font-size: 14px;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 25, 40, .48);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 1000;
        }

        .modal {
          width: min(720px, 100%);
          max-height: 88vh;
          overflow: auto;
          background: #fff;
          border-radius: 22px;
          box-shadow: 0 25px 70px rgba(0,0,0,.2);
        }

        .modal-header {
          position: sticky;
          top: 0;
          z-index: 2;
          background: #fff;
          border-bottom: 1px solid #edf0f4;
          padding: 20px 22px;
          display: flex;
          justify-content: space-between;
          gap: 15px;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 22px;
        }

        .modal-header p {
          margin: 5px 0 0;
          color: #738095;
          font-size: 13px;
        }

        .close {
          width: 38px;
          height: 38px;
          flex: 0 0 auto;
          border: 1px solid #dfe5eb;
          border-radius: 10px;
          background: #fff;
          cursor: pointer;
          display: grid;
          place-items: center;
          color: #596579;
        }

        .modal-body {
          padding: 22px;
        }

        .detail-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 22px;
        }

        .detail {
          background: #f7f9fb;
          border-radius: 12px;
          padding: 13px;
        }

        .detail-label {
          font-size: 11px;
          color: #7a8595;
          margin-bottom: 5px;
        }

        .detail-value {
          font-size: 13px;
          color: #253249;
          font-weight: 600;
        }

        .section {
          border-top: 1px solid #edf0f4;
          padding-top: 18px;
          margin-top: 18px;
        }

        .section h3 {
          margin: 0 0 8px;
          font-size: 13px;
          color: #5e6a7c;
          text-transform: uppercase;
          letter-spacing: .45px;
        }

        .section p {
          margin: 0;
          color: #344157;
          font-size: 14px;
          line-height: 1.65;
        }

        .rx {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px 0;
          border-bottom: 1px solid #edf0f4;
        }

        .rx:last-child {
          border-bottom: 0;
        }

        .rx-name {
          font-size: 14px;
          font-weight: 700;
        }

        .rx-note {
          margin-top: 3px;
          color: #748093;
          font-size: 12px;
        }

        @media (prefers-color-scheme: dark) {
          .history-page {
            background: #0e151d;
            color: #e7edf5;
          }

          .back-button,
          .toolbar,
          .record,
          .loading,
          .empty,
          .modal,
          .modal-header,
          .close {
            background: #151e28;
            border-color: #263443;
          }

          .heading h1,
          .diagnosis,
          .modal-header h2 {
            color: #f1f5f9;
          }

          .heading p,
          .doctor,
          .date,
          .meta,
          .empty p,
          .modal-header p,
          .detail-label,
          .rx-note {
            color: #8e9aaa;
          }

          .group {
            background: #151e28;
            border-color: #263443;
          }

          .folder-title {
            color: #e5edf5;
          }

          .folder-count {
            color: #8e9aaa;
          }

          .folder-icon {
            background: #102a38;
            color: #69b7e5;
          }

          .search {
            border-color: #2a3948;
          }

          .search input {
            color: #e5ebf2;
          }

          .filters {
            background: #101820;
          }

          .filter.active {
            background: #202c39;
            color: #66b5e8;
          }

          .record-meta,
          .section,
          .rx {
            border-color: #263442;
          }

          .detail {
            background: #101820;
          }

          .detail-value,
          .section p {
            color: #d2dae4;
          }

          .modal-backdrop {
            background: rgba(0,0,0,.7);
          }

          .preview-banner {
            background: #102530;
            border-color: #1f4558;
            color: #8cc7e5;
          }
        }

        @media (max-width: 720px) {
          .history-page {
            padding: 16px;
          }

          .topbar {
            margin-bottom: 20px;
          }

          .heading h1 {
            font-size: 24px;
          }

          .toolbar {
            display: block;
            padding: 12px;
          }

          .search {
            max-width: none;
            margin-bottom: 10px;
          }

          .filters {
            overflow-x: auto;
          }

          .filter {
            white-space: nowrap;
            flex: 1;
          }

          .records {
            grid-template-columns: 1fr;
          }

          .record {
            padding: 16px;
          }

          .detail-grid {
            grid-template-columns: 1fr;
          }

          .modal-backdrop {
            align-items: flex-end;
            padding: 0;
          }

          .modal {
            width: 100%;
            max-height: 92vh;
            border-radius: 22px 22px 0 0;
          }
        }
      `}</style>

      <div className="history-shell">
        <div className="topbar">
          <button className="back-button" onClick={() => navigate('/dashboard')} aria-label="Back">
            <Icon name="back" />
          </button>

          <div className="heading">
            <h1>Medical History</h1>
            <p>Your diagnosis records and treatment history</p>
          </div>
        </div>

        {PREVIEW_MODE && (
          <div className="preview-banner">
            UI preview mode — showing sample records because no patient is currently signed in.
          </div>
        )}

        <div className="toolbar">
          <label className="search">
            <Icon name="search" size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search diagnosis, doctor, hospital or medication"
            />
          </label>

          <div className="filters">
            <button
              className={`filter ${groupBy === 'month' ? 'active' : ''}`}
              onClick={() => setGroupBy('month')}
            >
              By Month
            </button>

            <button
              className={`filter ${groupBy === 'condition' ? 'active' : ''}`}
              onClick={() => setGroupBy('condition')}
            >
              By Condition
            </button>

            <button
              className={`filter ${groupBy === 'hospital' ? 'active' : ''}`}
              onClick={() => setGroupBy('hospital')}
            >
              By Hospital
            </button>
          </div>
        </div>

        {loading && (
          <div className="loading">
            Loading your medical history...
          </div>
        )}

        {!loading && filteredHistory.length === 0 && (
          <div className="empty">
            <h2>{search ? 'No matching records' : 'No diagnoses yet'}</h2>
            <p>
              {search
                ? 'Try searching for another diagnosis, doctor, hospital or medication.'
                : 'When a doctor completes a consultation with you, your diagnosis will appear here.'}
            </p>
          </div>
        )}

        {!loading &&
          filteredHistory.length > 0 &&
          groupedHistory.map(([group, records]) => {
            const isOpen = openGroups[group] ?? true;

            return (
              <section className="group" key={group}>
                <button
                  className="folder-header"
                  onClick={() =>
                    setOpenGroups((prev) => ({
                      ...prev,
                      [group]: !isOpen
                    }))
                  }
                  aria-expanded={isOpen}
                >
                  <div className="folder-icon">
                    <Icon name="folder" size={22} />
                  </div>

                  <div className="folder-info">
                    <h2 className="folder-title">{group}</h2>
                    <p className="folder-count">
                      {records.length}{' '}
                      {records.length === 1 ? 'medical record' : 'medical records'}
                    </p>
                  </div>

                  <span className={`folder-arrow ${isOpen ? 'open' : ''}`}>
                    <Icon name="chevron" size={18} />
                  </span>
                </button>

                {isOpen && (
                  <div className="folder-content">
                    <div className="records">
                      {records.map((record) => (
                        <article
                          className="record"
                          key={record.id}
                          onClick={() => setSelectedRecord(record)}
                        >
                          <div className="record-top">
                            <div className="date">
                              <Icon name="calendar" size={15} />
                              {formatDate(record.date)}
                            </div>

                            {record.severity && (
                              <span className={`severity ${getSeverityClass(record.severity)}`}>
                                {record.severity.toUpperCase()}
                              </span>
                            )}
                          </div>

                          <h3 className="diagnosis">{getDiagnosis(record)}</h3>
                          <p className="doctor">{getDoctor(record)}</p>

                          <div className="record-meta">
                            <span className="meta">
                              <Icon name="hospital" size={15} />
                              {getHospital(record)}
                            </span>

                            {record.prescriptions?.length > 0 && (
                              <span className="meta">
                                <Icon name="pill" size={15} />
                                {record.prescriptions.length}{' '}
                                {record.prescriptions.length === 1
                                  ? 'medication'
                                  : 'medications'}
                              </span>
                            )}
                          </div>

                          <div className="view">
                            <span>View medical record</span>
                            <Icon name="chevron" size={17} />
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            );
          })
        }      </div>

      {selectedRecord && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelectedRecord(null);
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <div>
                <h2>{getDiagnosis(selectedRecord)}</h2>
                <p>{formatDate(selectedRecord.date)}</p>
              </div>

              <button
                className="close"
                onClick={() => setSelectedRecord(null)}
                aria-label="Close"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail">
                  <div className="detail-label">Doctor</div>
                  <div className="detail-value">{getDoctor(selectedRecord)}</div>
                </div>

                <div className="detail">
                  <div className="detail-label">Hospital</div>
                  <div className="detail-value">{getHospital(selectedRecord)}</div>
                </div>

                {selectedRecord.severity && (
                  <div className="detail">
                    <div className="detail-label">Severity</div>
                    <div className="detail-value">
                      {selectedRecord.severity}
                    </div>
                  </div>
                )}

                {selectedRecord.ai_rating && (
                  <div className="detail">
                    <div className="detail-label">AI Assessment Rating</div>
                    <div className="detail-value">
                      {selectedRecord.ai_rating}/5
                    </div>
                  </div>
                )}
              </div>

              {selectedRecord.symptoms && (
                <div className="section">
                  <h3>Symptoms reported</h3>
                  <p>{selectedRecord.symptoms}</p>
                </div>
              )}

              {selectedRecord.ai_assessment && (
                <div className="section">
                  <h3>AI assessment</h3>
                  <p>{selectedRecord.ai_assessment}</p>
                </div>
              )}

              <div className="section">
                <h3>Diagnosis</h3>
                <p>{getDiagnosis(selectedRecord)}</p>
              </div>

              {selectedRecord.notes && (
                <div className="section">
                  <h3>Doctor's notes</h3>
                  <p>{selectedRecord.notes}</p>
                </div>
              )}

              {selectedRecord.prescriptions?.length > 0 && (
                <div className="section">
                  <h3>Prescribed medications</h3>

                  {selectedRecord.prescriptions.map((rx, index) => (
                    <div className="rx" key={index}>
                      <Icon name="pill" size={18} />
                      <div>
                        <div className="rx-name">{rx.name}</div>
                        {rx.notes && <div className="rx-note">{rx.notes}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
