import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

export default function ReviewerDashboard() {
  const [reports, setReports] = useState<any[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { void axios.get('/reviewer/reports').then(response => setReports(response.data.reports || [])).catch(e => setError(e.response?.data?.message || 'Unable to load reviewer reports.')); }, []);
  return <main className="reviewer-page"><header className="reviewer-header"><div><span className="technical-label">REVIEWER WORKSPACE</span><h1>Reports for review</h1><p>Inspect submitted test records and return a clear workflow decision.</p></div><Link className="route-secondary" to="/">Exit</Link></header>{error && <div className="tare-error">{error}</div>}<section className="reviewer-list">{reports.length === 0 ? <div className="reviewer-empty">No submitted reports are waiting for review.</div> : reports.map(item => <Link className="reviewer-card" to={`/reviewer/reports/${item.reportNumber || item.id}`} key={item.id}><div><span className="technical-label">{item.status}</span><h2>{item.reportNumber}</h2><p>{item.instrument?.typeDesignation || 'Instrument'} · {item.tester || 'Tester not recorded'}</p></div><div><strong>{item.report?.status || item.status}</strong><small>{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : ''}</small></div></Link>)}</section></main>;
}
