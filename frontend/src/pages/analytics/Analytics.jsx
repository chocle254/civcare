
    import React, { useEffect, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import Papa from 'papaparse';

export default function Analytics() {
  const [summary, setSummary] = useState(null);
  const [topDiseases, setTopDiseases] = useState([]);
  const [byCounty, setByCounty] = useState([]);
  const [trends, setTrends] = useState([]);
  const [period, setPeriod] = useState('monthly');
  const [loading, setLoading] = useState(true);

  const API_BASE = process.env.REACT_APP_API_BASE || 'https://civcaresys-production.up.railway.app';

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
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

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Disease Analytics</h1>
          <p style={s.subtitle}>Kenya-wide disease surveillance dashboard</p>
        </div>
        <div style={s.headerControls}>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            style={s.periodSelect}
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
          <button onClick={exportCSV} style={s.exportBtn}>
            📥 CSV
          </button>
          <button onClick={exportPDF} style={s.exportBtn}>
            📄 PDF
          </button>
        </div>
      </div>

      {loading && <div style={s.loading}>Loading analytics...</div>}

      {!loading && (
        <div id="analytics-dashboard" style={s.dashboard}>
          {/* Summary Cards */}
          <div style={s.cardsGrid}>
            {summary && (
              <>
                <div style={s.card}>
                  <p style={s.cardLabel}>Total Cases</p>
                  <p style={s.cardValue}>{summary.total_cases}</p>
                </div>
                <div style={s.card}>
                  <p style={s.cardLabel}>Counties Affected</p>
                  <p style={s.cardValue}>{summary.counties_affected}</p>
                </div>
                <div style={s.card}>
                  <p style={s.cardLabel}>Unique Diseases</p>
                  <p style={s.cardValue}>{summary.unique_diagnoses}</p>
                </div>
                <div style={s.card}>
                  <p style={s.cardLabel}>Avg Severity</p>
                  <p style={s.cardValue}>{summary.avg_severity_percent}%</p>
                </div>
              </>
            )}
          </div>

          {/* Trends Chart */}
          {trends.length > 0 && (
            <div style={s.chartContainer}>
              <h2 style={s.chartTitle}>Cases Over Time</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#6382ff30" />
                  <XAxis dataKey="date" stroke="#999" />
                  <YAxis stroke="#999" />
                  <Tooltip
                    contentStyle={{
                      background: '#0d0d1a',
                      border: '1px solid #6382ff',
                      borderRadius: 8,
                      color: '#fff',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cases"
                    stroke="#6382ff"
                    strokeWidth={2}
                    dot={{ fill: '#6382ff', r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Top Diseases */}
          {topDiseases.length > 0 && (
            <div style={s.chartContainer}>
              <h2 style={s.chartTitle}>Top 10 Diseases</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topDiseases}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#6382ff30" />
                  <XAxis dataKey="disease" angle={-45} textAnchor="end" height={100} stroke="#999" />
                  <YAxis stroke="#999" />
                  <Tooltip
                    contentStyle={{
                      background: '#0d0d1a',
                      border: '1px solid #ff6b9d',
                      borderRadius: 8,
                      color: '#fff',
                    }}
                  />
                  <Bar dataKey="cases" fill="#ff6b9d" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Counties Table */}
          {byCounty.length > 0 && (
            <div style={s.tableContainer}>
              <h2 style={s.chartTitle}>Cases by County</h2>
              <div style={s.tableScroll}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>County</th>
                      <th style={s.th}>Total Cases</th>
                      <th style={s.th}>Top Disease</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byCounty.map((row, idx) => (
                      <tr key={idx} style={s.tr}>
                        <td style={s.td}>{row.county}</td>
                        <td style={s.td}>{row.total_cases}</td>
                        <td style={s.td}>{row.top_disease}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
    flexWrap: 'wrap',
    gap: 16,
  },
  title: { fontSize: 32, fontWeight: 800, margin: '0 0 8px', color: '#fff' },
  subtitle: { fontSize: 14, color: '#999', margin: 0 },
  headerControls: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
  },
  periodSelect: {
    padding: '10px 14px',
    background: 'rgba(99, 130, 255, 0.1)',
    border: '1px solid #6382ff',
    borderRadius: 8,
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  exportBtn: {
    padding: '10px 14px',
    background: 'rgba(99, 130, 255, 0.1)',
    border: '1px solid #6382ff',
    borderRadius: 8,
    color: '#6382ff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  dashboard: {
    maxWidth: 1400,
    margin: '0 auto',
  },
  loading: {
    textAlign: 'center',
    padding: 40,
    color: '#999',
  },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 16,
    marginBottom: 32,
  },
  card: {
    background: 'rgba(99, 130, 255, 0.08)',
    border: '1px solid rgba(99, 130, 255, 0.2)',
    borderRadius: 12,
    padding: 20,
    backdropFilter: 'blur(10px)',
  },
  cardLabel: { fontSize: 12, color: '#999', textTransform: 'uppercase', margin: '0 0 12px', fontWeight: 600 },
  cardValue: { fontSize: 32, fontWeight: 800, margin: 0, color: '#6382ff' },
  chartContainer: {
    background: 'rgba(99, 130, 255, 0.08)',
    border: '1px solid rgba(99, 130, 255, 0.2)',
    borderRadius: 12,
    padding: 24,
    marginBottom: 24,
    backdropFilter: 'blur(10px)',
  },
  chartTitle: { fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: '#fff' },
  tableContainer: {
    background: 'rgba(99, 130, 255, 0.08)',
    border: '1px solid rgba(99, 130, 255, 0.2)',
    borderRadius: 12,
    padding: 24,
    backdropFilter: 'blur(10px)',
  },
  tableScroll: { overflowX: 'auto' },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  th: {
    textAlign: 'left',
    padding: '12px',
    borderBottom: '1px solid rgba(99, 130, 255, 0.2)',
    fontWeight: 700,
    color: '#6382ff',
  },
  tr: { borderBottom: '1px solid rgba(99, 130, 255, 0.1)' },
  td: { padding: '12px', color: '#ccc' },
};
