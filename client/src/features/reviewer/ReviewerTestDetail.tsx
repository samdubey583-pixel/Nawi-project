import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, Check, Download, FileText, MessageSquare, X } from 'lucide-react';
import axios from 'axios';
import { Link, useParams } from 'react-router-dom';
import { downloadBlob } from '../../lib/downloadBlob';
import { latestReportSubmission } from '../../lib/reportSubmission';
import { evidenceFileUrl } from '../evidence/evidenceFileUrl';
import { reviewerCanOpenEvidence } from './reviewerEvidenceAccess';

const dateLabel = (value: unknown) => value ? new Date(String(value)).toLocaleString() : 'Not recorded';
const valueLabel = (value: unknown) => {
  if (value === null || value === undefined || value === '') return 'Not recorded';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 12, useGrouping: false }).format(value);
  }
  return String(value);
};
const fieldValueLabel = (label: string, value: unknown) => {
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === 'string' && /(?:\bat\b|\btime\b)$/i.test(label.trim())) {
    const timestamp = Date.parse(value);
    if (Number.isFinite(timestamp)) return new Date(timestamp).toLocaleString();
  }
  return valueLabel(value);
};
const resultLabel = (value: unknown) => String(value || 'INCOMPLETE').replace(/_/g, ' ');
const prettyField = (value: string) => value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');

export default function ReviewerTestDetail() {
  const { reportId = '', testCode = '' } = useParams();
  const [state, setState] = useState<any>();
  const [comment, setComment] = useState('');
  const [retestOpen, setRetestOpen] = useState(false);
  const [retestReason, setRetestReason] = useState('');
  const [retestInstructions, setRetestInstructions] = useState('');
  const [retestTargetPhase, setRetestTargetPhase] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const response = await axios.get(`/reviewer/reports/${reportId}`);
      setState(response.data);
      setError('');
    } catch (e: any) {
      setError(e.response?.data?.message || 'Unable to load test details.');
    }
  };
  useEffect(() => { void load(); }, [reportId]);

  const decideRetest = async (event: FormEvent) => {
    event.preventDefault();
    if (!retestReason.trim()) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await axios.post(`/reviewer/reports/${reportId}/retests`, { testCode, targetPhaseCode: retestTargetPhase || undefined, reason: retestReason, instructions: retestInstructions });
      setRetestOpen(false); setRetestReason(''); setRetestInstructions(''); setRetestTargetPhase('');
      setNotice(`Retest requested for ${retestTargetPhase || testCode}. The previous attempt is preserved.`);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Unable to request the retest.');
    } finally { setBusy(false); }
  };

  const downloadPdf = async () => {
    setBusy(true); setError('');
    try {
      const kind = state?.report?.status === 'COMPLETED' ? 'final' : 'draft';
      const response = await axios.get(`/reviewer/reports/${reportId}/pdf?kind=${kind}`, { responseType: 'blob' });
      downloadBlob(response.data, `${state.report.testReportId}-${kind}-report.pdf`);
    } catch (e: any) { setError(e.response?.data?.message || 'Unable to generate the draft PDF.'); } finally { setBusy(false); }
  };

  if (!state) return <main className="reviewer-page"><div className="reviewer-empty">{error || 'Loading test details…'}</div></main>;
  const report = state.report;
  const canOpenEvidence = reviewerCanOpenEvidence(report.status);
  const latestSubmission = latestReportSubmission(report, state.auditHistory);
  const test = state.tests?.find((item: any) => String(item.code).toUpperCase() === decodeURIComponent(testCode).toUpperCase());
  if (!test) return <main className="reviewer-page"><div className="reviewer-empty">This test is not part of the persisted report.</div></main>;
  const evidence = (state.evidence || []).filter((item: any) => String(item.testId || '').toUpperCase() === String(test.code).toUpperCase());
  const record = test.record;
  const retestRequest = (state.retestRequests || []).find((item: any) => String(item.testCode).toUpperCase() === String(test.code).toUpperCase());
  const retestAlreadyOpen = (state.retestRequests || []).some((item: any) => item.status === 'OPEN');
  const canRequestRetest = !retestAlreadyOpen && (['AWAITING_REVIEW', 'UNDER_REVIEW'].includes(String(report.status)) || (report.status === 'REJECTED' && state.prototype));

  return <main className="reviewer-page">
    <header className="reviewer-header"><div><Link to={`/reviewer/reports/${reportId}`}><ArrowLeft size={15} /> Back to report</Link><span className="technical-label">TEST DETAIL · READ ONLY</span><h1>{test.code}</h1><p>{test.name} · {report.testReportId}</p></div><span className={`reviewer-status ${String(test.result || test.status).toLowerCase()}`}>{resultLabel(test.result || test.status)}</span></header>
    {state.prototype && <div className="reviewer-prototype-banner"><strong>SYNTHETIC PROTOTYPE / REGRESSION DATA</strong><span>Test observations are synthetic. The displayed result is calculated from the persisted report data.</span></div>}
    {error && <div className="tare-error" role="alert">{error}</div>}{notice && <div className="reviewer-notice" role="status"><Check size={16} /> {notice}</div>}
    <section className="reviewer-detail-grid"><article className="reviewer-panel"><h2>Test summary</h2><div className="reviewer-test-hero"><div><span className="technical-label">{test.code}</span><h2>{test.name}</h2><p>{test.source}</p></div><span className={`reviewer-result ${String(test.result || test.status).toLowerCase()}`}>{resultLabel(test.result || test.status)}</span></div><ReviewFields items={[["Workflow status", test.status], ["Applicability", test.applicability], ["Report", report.testReportId], ["Assigned tester", report.testerNameSnapshot || report.laboratory?.testerName], ["Recorded at", dateLabel(record?.fields?.find((field: any) => String(field.label).toLowerCase() === 'completed at')?.value)]]} />{test.reason && <p className="reviewer-detail-note">{test.reason}</p>}</article><article className="reviewer-panel"><h2>Report context</h2><ReviewFields items={[["Instrument", report.instrument?.typeDesignation], ["Serial number", report.instrument?.serialNumber], ["Accuracy class", report.instrument?.accuracyClass], ["Overall result", state.overallResult], ["Workflow", report.status], ["Submitted by", latestSubmission.actor], ["Submitted at", dateLabel(latestSubmission.timestamp)]]} /></article></section>
    <section className="reviewer-section"><div className="reviewer-section-heading"><div><span className="technical-label">RECORDED VALUES</span><h2>Tester observations and calculations</h2></div><span>Read only</span></div><p className="reviewer-detail-note">These values are the persisted tester entry and the calculations produced by the test service. Reviewer actions cannot edit them.</p>{record ? <ReviewRecord record={record} /> : <div className="reviewer-na-note"><strong>{test.applicability === 'NOT_APPLICABLE' ? 'NOT APPLICABLE' : 'No persisted execution record'}</strong><p>{test.reason || 'No persisted execution record is available for this test.'}</p></div>}</section>
    {retestRequest?.previousAttempt && <section className="reviewer-section"><div className="reviewer-section-heading"><div><span className="technical-label">RETEST HISTORY</span><h2>Previous submitted attempt</h2></div><span>Preserved</span></div><p className="reviewer-detail-note">{retestRequest.targetPhaseCode ? `Only ${retestRequest.targetPhaseCode} was reopened. ` : ''}The prior attempt is retained for comparison with the current attempt.</p><ReviewRecord record={retestRequest.previousAttempt} /></section>}
    <section className="reviewer-section"><div className="reviewer-section-heading"><div><span className="technical-label">EVIDENCE</span><h2>Supporting records</h2></div><span>{evidence.length} attached</span></div>{evidence.length ? <div className="reviewer-evidence-list">{evidence.map((item: any) => <article className="reviewer-evidence" key={item.id}><strong>{item.label || item.originalFilename || 'Supporting record'}</strong><small>{item.testId || test.code} · {dateLabel(item.capturedAt || item.createdAt)} · {item.uploaderNameSnapshot || 'Tester'}</small>{canOpenEvidence ? <a href={evidenceFileUrl(item.fileUrl || `/evidence/${item.id}/file`)} target="_blank" rel="noreferrer">Open evidence</a> : <small>File access opens when this report is submitted for review.</small>}</article>)}</div> : <p className="review-empty">No evidence attached to this test.</p>}</section>
    <section className="reviewer-actions"><div className="reviewer-section-heading"><div><span className="technical-label">TEST ACTIONS</span><h2>Review this test</h2></div></div><div className="reviewer-action-buttons reviewer-test-detail-actions">{canRequestRetest && <button className="route-secondary" disabled={busy} onClick={() => setRetestOpen(true)}>Request Retest</button>}<Link className="route-secondary" to={`/reviewer/reports/${reportId}`}><ArrowLeft size={15} /> Back to report</Link><button className="route-secondary pdf-download-action" disabled={busy} onClick={() => void downloadPdf()}><Download size={15} /> Download {report.status === 'COMPLETED' ? 'Final' : 'Draft'} PDF</button></div></section>
    {retestOpen && <div className="reviewer-modal-backdrop" role="presentation"><form className="reviewer-modal reviewer-retest-modal" role="dialog" aria-modal="true" onSubmit={decideRetest}><button type="button" className="reviewer-modal-close" onClick={() => setRetestOpen(false)} aria-label="Close"><X size={17} /></button><span className="technical-label">REQUEST RETEST</span><h2>{test.code} · {test.name}</h2><p>Report: {report.testReportId}</p>{test.code === 'A.4.6' && <label>Retest scope<select value={retestTargetPhase} onChange={event => setRetestTargetPhase(event.target.value)}><option value="">Entire tare test</option>{['A.4.6.1', 'A.4.6.2', 'A.4.6.3'].map(phase => <option key={phase} value={phase}>{phase} only</option>)}</select><small>Choose a phase to reopen only that part; completed sibling phases remain preserved and locked.</small></label>}<label>Reason<textarea value={retestReason} onChange={event => setRetestReason(event.target.value)} required rows={4} placeholder="Explain what must be verified again." /></label><label>Optional reviewer instructions<textarea value={retestInstructions} onChange={event => setRetestInstructions(event.target.value)} rows={4} placeholder="Provide focused instructions for the new attempt." /></label><div className="reviewer-action-buttons"><button type="button" className="route-secondary" onClick={() => setRetestOpen(false)}>Cancel</button><button type="submit" className="route-primary" disabled={busy || !retestReason.trim()}>Request Retest</button></div></form></div>}
  </main>;
}

function ReviewFields({ items, className = '' }: { items: Array<[string, unknown]>; className?: string }) { return <div className={`reviewer-fields ${className}`.trim()}>{items.map(([name, value], index) => <div key={`${name}-${index}`}><small>{name}</small>{Array.isArray(value) ? <span className="reviewer-value-list">{value.map((entry, entryIndex) => <strong key={entryIndex}>{fieldValueLabel(name, entry)}</strong>)}</span> : <strong>{value !== null && typeof value === 'object' ? JSON.stringify(value) : fieldValueLabel(name, value)}</strong>}</div>)}</div>; }

function ReviewRecord({ record }: { record: any }) {
  const groupedFields = new Map<string, Array<[string, unknown]>>();
  for (const field of record.fields || []) {
    const label = String(field.label || 'Recorded value');
    const split = label.match(/^([^·:]+)[·:](.+)$/);
    const group = split ? split[1].trim() : 'Test record';
    const title = /calculation/i.test(group) ? 'Calculation results' : /observation/i.test(group) ? 'Tester observations' : prettyField(group);
    const values = groupedFields.get(title) || [];
    values.push([split ? split[2].trim() : label, field.value]);
    groupedFields.set(title, values);
  }
  return <div className="reviewer-record-view">
    {Array.from(groupedFields.entries()).map(([title, items]) => <section className={`reviewer-record-fields ${title === 'Calculation results' ? 'calculation-results' : ''}`} key={title}><h3>{title}</h3><ReviewFields className="reviewer-record-field-grid" items={items} /></section>)}
    {record.sections?.map((section: any, sectionIndex: number) => <section className="reviewer-observation-section" key={`${section.label}-${sectionIndex}`}><h4>{section.label}</h4><div className="reviewer-observation-table">{(Array.isArray(section.rows) ? section.rows : []).map((row: any, index: number) => <div className="reviewer-observation-row" key={index}>{Object.entries(row || {}).map(([key, value]) => <span key={key}><small>{prettyField(key)}</small><b>{fieldValueLabel(prettyField(key), value)}</b></span>)}</div>)}</div></section>)}
    {!record.fields?.length && !record.sections?.length && <p className="review-empty">No recorded values are available.</p>}
  </div>;
}
