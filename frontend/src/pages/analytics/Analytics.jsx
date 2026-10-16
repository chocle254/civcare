import React, { useEffect, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList
} from 'recharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import Papa from 'papaparse';
import Icon from '../../components/Icons';

// Chart colours are passed to SVG attributes, so they must be concrete values.
// Single-series blue validated for contrast/lightness on each surface.
const CHART = {
  light: { mark: '#1769aa', grid: '#e1e6ed', axis: '#637083', surface: '#ffffff', text: '#172033' },
  dark: { mark: '#3f97cf', grid: '#263443', axis: '#95a2b3', surface: '#151e28', text: '#eef3f8' },
};

function usePrefersDark() {
  const query = '(prefers-color-scheme: dark)';
  const [dark, setDark] = useState(() => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(query).matches);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const q = window.matchMedia(query);
    const on = (e) => setDark(e.matches);
    q.addEventListener ? q.addEventListener('change', on) : q.addListener(on);
    return () => (q.removeEventListener ? q.removeEventListener('change', on) : q.removeListener(on));
  }, []);
  return dark;
}

export default function Analytics() {
  const [summary, setSummary] = useState(null);
  const [topDiseases, setTopDiseases] = useState([]);
  const [byCounty, setByCounty] = useState([]);
  const [trends, setTrends] = useState([]);
  const [period, setPeriod] = useState('monthly');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const c = CHART[usePrefersDark() ? 'dark' : 'light'];

  const API_BASE = process.env.REACT_APP_API_BASE || 'https://civcaresys-production.up.railway.app';

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        setError(false);
        const [summaryRes, diseasesRes, countyRes, trendsRes] = await Promise.all([
          fetch(`${API_BASE}/analytics/summary?period=${period}`).then(r => r.json()),
          fetch(`${API_BASE}/analytics/diseases/top?period=${period}`).then(r => r.json()),
          fetch(`${API_BASE}/analytics/diseases/by-county?period=${period}`).then(r => r.json()),
          fetch(`${API_BASE}/analytics/trends?period=${period}`).then(r => r.json()),
        ]);

        setSummary(summaryRes);
        setTopDiseases(diseasesRes.top_diseases || []);
        setByCounty(countyRes.by_county || []);
        setTrends(trendsRes.trends || []);
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [period, API_BASE]);

  const exportCSV = () => {
    const data = topDiseases.map((d) => ({
      Disease: d.disease,
      Cases: d.cases,
      'Avg Severity': d.avg_severity,
    }));

    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${period}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const exportPDF = async () => {
    const element = document.getElementById('analytics-dashboard');
    const canvas = await html2canvas(element, { scale: 2, useCORS: true });
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, 0, 210, 297);
    pdf.save(`analytics-${period}-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const PERIODS = [
    { id: 'weekly', label: 'Week' },
    { id: 'monthly', label: 'Month' },
    { id: 'yearly', label: 'Year' },
  ];
  const hasData = summary || trends.length || topDiseases.length || byCounty.length;
  const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString());
  const tooltipStyle = {
    background: c.surface, border: `1px solid ${c.grid}`, borderRadius: 8, color: c.text,
    fontSize: 13, boxShadow: '0 8px 24px rgba(16,24,40,0.12)',
  };
  const axisTick = { fill: c.axis, fontSize: 12 };

  return (
    <div className="an">
      <header className="an-head">
        <div className="an-headin">
          <div>
            <p className="an-eyebrow">CivCare surveillance</p>
            <h1 className="an-title">Disease analytics</h1>
            <p className="an-sub">Aggregated diagnosis counts from verdicts submitted by CivCare clinicians across Kenya.</p>
          </div>
          <div className="an-controls">
            <div className="an-seg" role="radiogroup" aria-label="Reporting period">
              {PERIODS.map((p) => (
                <button key={p.id} type="button" role="radio" aria-checked={period === p.id}
                  className={`an-segbtn${period === p.id ? ' is-on' : ''}`} onClick={() => setPeriod(p.id)}>
                  {p.label}
                </button>
              ))}
            </div>
            <button type="button" className="an-btn" onClick={exportCSV} disabled={loading || !topDiseases.length}>
              <Icon.File size={16} /> CSV
            </button>
            <button type="button" className="an-btn" onClick={exportPDF} disabled={loading || !hasData}>
              <Icon.File size={16} /> PDF
            </button>
          </div>
        </div>
      </header>

      <main className="an-wrap">
        {loading && (
          <div aria-busy="true" aria-label="Loading analytics">
            <div className="an-stats">{[0, 1, 2, 3].map((i) => <div key={i} className="cc-skeleton" style={{ height: 92 }} />)}</div>
            <div className="cc-skeleton" style={{ height: 320, marginTop: 16 }} />
          </div>
        )}

        {!loading && error && (
          <div className="an-state">
            <span className="an-stateicon an-stateicon--err"><Icon.Alert size={24} /></span>
            <h2>Analytics couldn't be loaded</h2>
            <p>Check your connection, then try another period or reload the page.</p>
            <button type="button" className="an-btn" onClick={() => window.location.reload()}><Icon.Refresh size={16} /> Reload</button>
          </div>
        )}

        {!loading && !error && !hasData && (
          <div className="an-state">
            <span className="an-stateicon"><Icon.Chart size={24} /></span>
            <h2>No diagnoses recorded for this period</h2>
            <p>Figures appear once clinicians submit verdicts. Try a longer period.</p>
          </div>
        )}

        {!loading && !error && hasData && (
          <div id="analytics-dashboard" className="an-dash">
            {summary && (
              <section className="an-stats" aria-label="Summary">
                <div className="an-stat"><span>Total cases</span><strong>{fmt(summary.total_cases)}</strong></div>
                <div className="an-stat"><span>Counties reporting</span><strong>{fmt(summary.counties_affected)}</strong></div>
                <div className="an-stat"><span>Distinct diagnoses</span><strong>{fmt(summary.unique_diagnoses)}</strong></div>
                <div className="an-stat"><span>Average severity</span><strong>{summary.avg_severity_percent ?? '—'}<small>%</small></strong></div>
              </section>
            )}

            <div className="an-grid">
              {trends.length > 0 && (
                <section className="an-panel an-span">
                  <h2>Cases over time</h2>
                  <div className="an-chart" style={{ height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trends} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                        <CartesianGrid vertical={false} stroke={c.grid} />
                        <XAxis dataKey="date" tick={axisTick} tickLine={false} axisLine={{ stroke: c.grid }} minTickGap={24} />
                        <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: c.axis, strokeDasharray: '3 3' }} formatter={(v) => [fmt(v), 'Cases']} />
                        <Line type="monotone" dataKey="cases" name="Cases" stroke={c.mark} strokeWidth={2}
                          dot={{ r: 3, fill: c.mark, stroke: c.surface, strokeWidth: 2 }} activeDot={{ r: 5, stroke: c.surface, strokeWidth: 2 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              )}

              {topDiseases.length > 0 && (
                <section className="an-panel">
                  <h2>Most common diagnoses</h2>
                  <div className="an-chart" style={{ height: topDiseases.length * 36 + 24 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topDiseases} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 0 }} barCategoryGap={8}>
                        <XAxis type="number" hide allowDecimals={false} />
                        <YAxis type="category" dataKey="disease" width={140} tick={axisTick} tickLine={false} axisLine={false} interval={0} />
                        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: c.grid, opacity: 0.5 }}
                          formatter={(v, n, p) => [`${fmt(v)} cases${p?.payload?.avg_severity != null ? ` · avg severity ${p.payload.avg_severity}` : ''}`, '']} separator="" />
                        <Bar dataKey="cases" fill={c.mark} radius={[0, 4, 4, 0]} maxBarSize={20}>
                          <LabelList dataKey="cases" position="right" fill={c.text} fontSize={12} formatter={fmt} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              )}

              {byCounty.length > 0 && (
                <section className="an-panel">
                  <h2>Cases by county</h2>
                  <div className="an-tablewrap">
                    <table className="an-table">
                      <thead>
                        <tr><th scope="col">County</th><th scope="col" className="an-num">Cases</th><th scope="col">Most common</th></tr>
                      </thead>
                      <tbody>
                        {byCounty.map((row, idx) => (
                          <tr key={idx}>
                            <td>{row.county}</td>
                            <td className="an-num">{fmt(row.total_cases)}</td>
                            <td>{row.top_disease}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </div>
          </div>
        )}
      </main>

      <style>{`
        .an { min-height: 100vh; background: var(--cc-canvas); background-attachment: fixed; }
        .an-head { position: sticky; top: 0; z-index: 10; background: var(--cc-glass); -webkit-backdrop-filter: var(--cc-blur); backdrop-filter: var(--cc-blur); border-bottom: 1px solid var(--cc-border); }
        .an-headin { max-width: 1280px; margin: 0 auto; padding: 20px 24px; display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
        .an-eyebrow { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--cc-primary); }
        .an-title { font-size: 24px; font-weight: 700; letter-spacing: -0.02em; margin: 2px 0; }
        .an-sub { font-size: 14px; color: var(--cc-muted); max-width: 560px; }
        .an-controls { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .an-seg { display: flex; gap: 2px; padding: 3px; background: var(--cc-surface-3); border-radius: 9px; }
        .an-segbtn { min-height: 34px; padding: 4px 14px; border-radius: 7px; border: 1px solid transparent; background: none; font-size: 13.5px; font-weight: 600; color: var(--cc-muted); }
        .an-segbtn.is-on { background: var(--cc-surface-solid); color: var(--cc-text); border-color: var(--cc-glass-border); box-shadow: var(--cc-clay); }
        .an-btn { display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 6px 14px; border-radius: 8px; border: 1px solid var(--cc-border-strong); background: var(--cc-surface); color: var(--cc-text-2); font-size: 13.5px; font-weight: 600; }
        .an-btn:hover:not(:disabled) { background: var(--cc-surface-2); color: var(--cc-text); }
        .an-btn:disabled { opacity: .5; cursor: not-allowed; }
        .an-wrap { max-width: 1280px; margin: 0 auto; padding: 20px 24px 48px; }
        .an-dash { background: transparent; }
        .an-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
        .an-stat { background: var(--cc-surface); border: 1px solid var(--cc-glass-border); box-shadow: var(--cc-glass-edge), var(--cc-shadow); border-radius: 16px; padding: 16px 18px; display: flex; flex-direction: column; gap: 2px; }
        .an-stat span { font-size: 13px; font-weight: 600; color: var(--cc-muted); }
        .an-stat strong { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
        .an-stat small { font-size: 15px; color: var(--cc-muted); margin-left: 2px; }
        .an-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; align-items: start; }
        .an-span { grid-column: 1 / -1; }
        .an-panel { background: var(--cc-surface); border: 1px solid var(--cc-glass-border); box-shadow: var(--cc-glass-edge), var(--cc-shadow); border-radius: 18px; padding: 16px 18px; min-width: 0; }
        .an-panel h2 { font-size: 15px; font-weight: 650; margin-bottom: 12px; }
        .an-chart { width: 100%; }
        .an-tablewrap { overflow-x: auto; max-height: 420px; overflow-y: auto; }
        .an-table { width: 100%; border-collapse: collapse; font-size: 14px; }
        .an-table th { position: sticky; top: 0; background: var(--cc-surface-2); text-align: left; font-size: 12px; font-weight: 600; color: var(--cc-muted); padding: 8px 12px; border-bottom: 1px solid var(--cc-border); }
        .an-table td { padding: 10px 12px; border-bottom: 1px solid var(--cc-border); }
        .an-table tr:last-child td { border-bottom: none; }
        .an-num { text-align: right !important; font-variant-numeric: tabular-nums; }
        .an-state { text-align: center; padding: 56px 16px; background: var(--cc-surface); border: 1px solid var(--cc-border); border-radius: 14px; }
        .an-state h2 { font-size: 17px; margin: 12px 0 4px; }
        .an-state p { color: var(--cc-muted); font-size: 14px; margin-bottom: 16px; }
        .an-stateicon { display: inline-flex; width: 48px; height: 48px; border-radius: 50%; align-items: center; justify-content: center; background: var(--cc-primary-soft); color: var(--cc-primary); }
        .an-stateicon--err { background: var(--cc-danger-soft); color: var(--cc-danger); }
        @media (max-width: 900px) { .an-grid { grid-template-columns: 1fr; } }
        @media (max-width: 640px) {
          .an-headin, .an-wrap { padding-left: 16px; padding-right: 16px; }
          .an-stats { grid-template-columns: 1fr 1fr; }
          .an-stat strong { font-size: 22px; }
          .an-controls { width: 100%; }
          .an-seg { flex: 1; }
          .an-segbtn { flex: 1; }
        }
      `}</style>
    </div>
  );
}
