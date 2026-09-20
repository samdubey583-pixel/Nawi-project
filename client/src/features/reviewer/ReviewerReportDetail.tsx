import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';

export default function ReviewerReportDetail() {
  const { reportId = '' } = useParams();
  const [state, setState] = useState<any>();
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async () => { try { const response = await axios.get(`/reviewer/reports/${reportId}`); setState(response.data); } catch (e: any) { setError(e.response?.data?.message || 'Unable to load report.'); } };
  useEffect(() => { void load(); }, [reportId]);
  const decide = async (action: string) => { setBusy(true); setError(''); try { await axios.post(`/reviewer/reports/${reportId}/${action}`, { comment }); setComment(''); await load(); } catch (e: any) { setError(e.response?.data?.message || 'Unable to update review.'); } finally { setBusy(false); } };
  if (!state) return <main className="reviewer-page"><div className="reviewer-empty">{error || 'Loading report…'}</div></main>;
  const report = state.report;
  return <main className="reviewer-page"><header className="reviewer-header"><div><Link to="/reviewer/dashboard">← Reports for review</Link><span className="technical-label">{report.status}</span><h1>{report.testReportId}</h1><p>{report.instrument?.typeDesignation} · {report.testerNameSnapshot || 'Tester not recorded'}</p></div></header>{error && <div className="tare-error">{error}</div>}<section className="reviewer-detail-grid"><article className="reviewer-panel"><h2>Test execution</h2><p>Stage: {report.stage}</p><p>Instrument: {report.instrument?.typeDesignation}</p><p>Serial: {report.instrument?.serialNumber}</p><p>A.4.6: {state.tare ? `${state.tare.result} · ${state.tare.status}` : 'Not started'}</p></article><article className="reviewer-panel"><h2>Evidence</h2>{state.evidence?.length ? state.evidence.map((item: any) => <div className="reviewer-evidence" key={item._id}><strong>{item.label || item.originalFilename}</strong><small>{item.testId || 'Report'} · {new Date(item.capturedAt || item.createdAt).toLocaleString()}</small></div>) : <p>No evidence attached.</p>}</article></section><section className="reviewer-actions"><h2>Review decision</h2><textarea value={comment} onChange={event => setComment(event.target.value)} placeholder="Required for changes or rejection; optional for approval." rows={4} /><div><button className="route-primary" disabled={busy} onClick={() => void decide('approve')}>Approve</button><button className="route-secondary" disabled={busy || !comment.trim()} onClick={() => void decide('request-changes')}>Request Changes</button><button className="route-secondary reviewer-danger" disabled={busy || !comment.trim()} onClick={() => void decide('reject')}>Reject</button></div></section></main>;
}
