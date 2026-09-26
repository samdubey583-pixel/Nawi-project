import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, Download, FileText, MessageSquare, X } from 'lucide-react';
import axios from 'axios';
import { Link, useParams } from 'react-router-dom';
import { downloadBlob } from '../../lib/downloadBlob';
import { latestReportSubmission } from '../../lib/reportSubmission';
import { evidenceFileUrl } from '../evidence/evidenceFileUrl';
import { reviewerCanOpenEvidence } from './reviewerEvidenceAccess';
import { reviewerTestPresentation } from './reviewerTestPresentation';

const dateLabel = (value: unknown) => value ? new Date(String(value)).toLocaleString() : 'Not recorded';
const valueLabel = (value: unknown) => value === null || value === undefined || value === '' ? 'Not recorded' : String(value);
const resultLabel = (value: unknown) => String(value || 'INCOMPLETE').replace(/_/g, ' ');

export default function ReviewerReportDetail() {
  const { reportId = '' } = useParams();
  const [state, setState] = useState<any>();
  const [comment, setComment] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async () => { try { const response = await axios.get(`/reviewer/reports/${reportId}`); setState(response.data); setError(''); } catch (e: any) { setError(e.response?.data?.message || 'Unable to load report.'); } };
  useEffect(() => { void load(); }, [reportId]);
  const decide = async (action: 'approve' | 'reject') => { setBusy(true); setError(''); setNotice(''); try { await axios.post(`/reviewer/reports/${reportId}/${action}`, { comment }); setComment(''); setNotice(action === 'approve' ? 'Report approved and finalized.' : 'Report rejected with the recorded reason.'); await load(); } catch (e: any) { setError(e.response?.data?.message || 'Unable to update the review decision.'); } finally { setBusy(false); } };
  const sendMessage = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setError(''); setNotice(''); try { await axios.post(`/reviewer/reports/${reportId}/messages`, { subject, message }); setSubject(''); setMessage(''); setNotice('Message sent to the tester.'); await load(); } catch (e: any) { setError(e.response?.data?.message || 'Unable to send the message.'); } finally { setBusy(false); } };
  const downloadPdf = async (kind: 'draft' | 'final') => { setBusy(true); setError(''); try { const response = await axios.get(`/reviewer/reports/${reportId}/pdf?kind=${kind}`, { responseType: 'blob' }); downloadBlob(response.data, `${state.report.testReportId}-${kind}-report.pdf`); await load(); } catch (e: any) { setError(e.response?.data?.message || e.message || `Unable to generate the ${kind} PDF.`); } finally { setBusy(false); } };
  if (!state) return <main className="reviewer-page"><div className="reviewer-empty">{error || 'Loading report…'}</div></main>;
  const report = state.report;
  const latestSubmission = latestReportSubmission(report, state.auditHistory);
  const isApproved = report.status === 'COMPLETED';
  const isClosed = isApproved || report.status === 'REJECTED';
  const isRetestRequired = report.status === 'RETEST_REQUIRED';
  const canOpenEvidence = reviewerCanOpenEvidence(report.status);
  const canDecide = ['AWAITING_REVIEW', 'UNDER_REVIEW'].includes(String(report.status));
  return <main className="reviewer-page">
    <header className="reviewer-header"><div><Link to="/reviewer/dashboard"><ArrowLeft size={15} /> Review dashboard</Link><span className="technical-label">REPORT REVIEW</span><h1>{report.testReportId}</h1><p>{report.instrument?.typeDesignation || 'Instrument'} · {report.testerNameSnapshot || report.laboratory?.testerName || 'Tester not recorded'}</p></div><span className={`reviewer-status ${String(report.status).toLowerCase()}`}>{resultLabel(report.status)}</span></header>
    {state.prototype && <div className="reviewer-prototype-banner"><strong>SYNTHETIC PROTOTYPE / REGRESSION DATA</strong><span>Test observations are synthetic. The displayed result is calculated from the persisted report data.</span></div>}
    {error && <div className="tare-error" role="alert">{error}</div>}{notice && <div className="reviewer-notice" role="status"><Check size={16} /> {notice}</div>}
    <section className="reviewer-detail-grid"><article className="reviewer-panel"><h2>Report identity</h2><ReviewFields items={[["Manufacturer", report.manufacturer?.name], ["Model / type", report.instrument?.typeDesignation], ["Serial number", report.instrument?.serialNumber], ["Accuracy class", report.instrument?.accuracyClass], ["Capacity", `${valueLabel(report.instrument?.min)} – ${valueLabel(report.instrument?.max)} ${valueLabel(report.instrument?.unit)}`], ["Laboratory", report.laboratory?.name], ["Assigned tester", report.testerNameSnapshot || report.laboratory?.testerName], ["Workflow", report.status], ["Overall result", state.overallResult], ["Submitted by", latestSubmission.actor], ["Submitted at", dateLabel(latestSubmission.timestamp)], ["Reviewer", report.reviewerNameSnapshot], ["Decision time", dateLabel(report.reviewedAt)]]} /></article><article className="reviewer-panel"><h2>Classification & traceability</h2><p><strong>Mathematical result:</strong> {state.overallResult}</p><p><strong>Classification:</strong> {state.prototype ? 'Synthetic prototype / regression data' : 'Recorded test workflow'}</p>{report.testConditionsMode === 'SYNTHETIC_DEMO' && <p><strong>Test-condition source:</strong> Synthetic demo profile copied from recorded start conditions; no physical end readings were captured.</p>}<p><strong>Reference:</strong> OIML R 76-1:2006 and the applicable R 76-2 report structure.</p>{report.reviewComment && <p><strong>Reviewer decision note:</strong> {report.reviewComment}</p>}</article></section>
    {isRetestRequired && state.retestRequests?.[0] && <section className="reviewer-section reviewer-retest-banner"><div className="reviewer-section-heading"><div><span className="technical-label">RETEST REQUIRED</span><h2>{state.retestRequests[0].testCode} · {state.retestRequests[0].testName}</h2></div><span>Attempt {state.retestRequests[0].attemptNumber}</span></div><p><strong>Reason:</strong> {state.retestRequests[0].reason}</p>{state.retestRequests[0].instructions && <p><strong>Instructions:</strong> {state.retestRequests[0].instructions}</p>}<p className="review-empty">The prior submitted attempt remains preserved in retest history. Approval is unavailable until the tester submits the new attempt.</p></section>}
    <section className="reviewer-section"><div className="reviewer-section-heading"><div><span className="technical-label">TEST-BY-TEST INSPECTION</span><h2>Applicable test results</h2></div><span>{state.tests.length} route entries</span></div><div className="reviewer-test-list">{state.tests.map((test: any) => <ReviewerTestCard reportId={reportId} test={test} evidence={(state.evidence || []).filter((item: any) => String(item.testId || '').toUpperCase() === String(test.code).toUpperCase())} key={test.code} />)}</div></section>
    <section className="reviewer-section"><div className="reviewer-section-heading"><div><span className="technical-label">EVIDENCE</span><h2>Supporting records</h2></div></div>{state.evidence?.length ? <div className="reviewer-evidence-list">{state.evidence.map((item: any, index: number) => <article className="reviewer-evidence" key={item.id}><strong>Evidence {String(index + 1).padStart(2, '0')} · {item.label || item.originalFilename}</strong><small>{item.testId || 'Report'} · {dateLabel(item.capturedAt || item.createdAt)} · {item.uploaderNameSnapshot || 'Tester'}</small>{canOpenEvidence ? <a href={evidenceFileUrl(item.fileUrl || `/evidence/${item.id}/file`)} target="_blank" rel="noreferrer">Open evidence</a> : <small>File access opens when this report is submitted for review.</small>}</article>)}</div> : <p className="review-empty">No evidence attached.</p>}</section>
    <section className="reviewer-section"><div className="reviewer-section-heading"><div><span className="technical-label">COMMUNICATION</span><h2>Report message thread</h2></div></div><div className="reviewer-message-list">{(state.messages || []).map((item: any) => <article key={item._id}><div><strong>{item.subject}</strong><small>{item.senderNameSnapshot} · {item.senderRole} · {dateLabel(item.createdAt)}</small></div><p>{item.message}</p></article>)}{!(state.messages || []).length && <p className="review-empty">No messages recorded.</p>}</div>{!isClosed && <form className="reviewer-message-form" onSubmit={sendMessage}><input value={subject} onChange={event => setSubject(event.target.value)} placeholder="Subject" required maxLength={200} /><textarea value={message} onChange={event => setMessage(event.target.value)} placeholder="Write a message to the tester." required rows={4} maxLength={10000} /><button className="route-primary" disabled={busy}><MessageSquare size={15} /> Send message</button></form>}</section>
    <section className="reviewer-actions"><div className="reviewer-section-heading"><div><span className="technical-label">REVIEW DECISION</span><h2>{isApproved ? 'Approved report' : report.status === 'REJECTED' ? 'Rejected report' : isRetestRequired ? 'Retest in progress' : canDecide ? 'Record decision' : 'Not yet submitted for review'}</h2></div></div>{canDecide && <textarea value={comment} onChange={event => setComment(event.target.value)} placeholder="Optional approval note; required for rejection." rows={4} />}{canDecide && <div className="reviewer-action-buttons"><button className="route-primary" disabled={busy} onClick={() => void decide('approve')}><Check size={16} /> Approve</button><button className="route-secondary reviewer-danger" disabled={busy || !comment.trim()} onClick={() => void decide('reject')}><X size={16} /> Reject</button></div>}{!canDecide && !isClosed && !isRetestRequired && <p className="review-empty">Reviewer decisions become available after the tester submits this report.</p>}{isApproved ? <div className="reviewer-action-buttons"><button className="route-primary" disabled={busy} onClick={() => void downloadPdf('final')}><FileText size={16} /> Download Final PDF</button></div> : <button className="route-secondary pdf-download-action" disabled={busy} onClick={() => void downloadPdf('draft')}><Download size={16} /> Download Draft PDF</button>}</section>
  </main>;
}

function ReviewFields({ items }: { items: Array<[string, unknown]> }) { return <div className="reviewer-fields">{items.map(([name, value]) => <div key={name}><small>{name}</small><strong>{valueLabel(value)}</strong></div>)}</div>; }
function ReviewerTestCard({ reportId, test, evidence }: { reportId: string; test: any; evidence: any[] }) {
  const presentation = reviewerTestPresentation(test, evidence.length);
  const preview = presentation.showRecordedValues ? test.record.fields.slice(0, 3) : [];
  const needsExplanation = ['BLOCKED', 'UNSUPPORTED', 'REQUIRES_CONFIGURATION', 'DEFERRED', 'REVALIDATION_REQUIRED'].includes(String(test.status));

  if (presentation.isNotApplicable) {
    return <article className="reviewer-test-card reviewer-test-card-na">
      <div className="reviewer-test-summary">
        <div className="reviewer-test-summary-copy"><span className="technical-label">{test.code}</span><h3>{test.name}</h3><small>{test.source}</small></div>
        <div className="reviewer-test-summary-action"><span className="reviewer-result not-applicable">NOT APPLICABLE</span></div>
      </div>
      <div className="reviewer-test-na-reason"><span className="technical-label">APPLICABILITY REASON</span><p>{presentation.reason || 'Applicability reason not recorded.'}</p></div>
    </article>;
  }

  return <article className="reviewer-test-card"><div className="reviewer-test-summary"><div className="reviewer-test-summary-copy"><span className="technical-label">{test.code}</span><h3>{test.name}</h3><small>{test.source}</small></div><div className="reviewer-test-summary-action"><span className={`reviewer-result ${String(test.result || test.status || 'INCOMPLETE').toLowerCase()}`}>{resultLabel(test.result || test.status)}</span>{presentation.showDetailsLink && <Link className="route-secondary reviewer-test-details-link" to={`/reviewer/reports/${reportId}/tests/${encodeURIComponent(test.code)}`}>Open test details <ArrowRight size={14} /></Link>}</div></div>{preview.length > 0 && <div className="reviewer-test-preview"><span className="technical-label">RECORDED VALUES</span><div>{preview.map((field: any) => <span key={field.label}><small>{field.label}</small><strong>{valueLabel(field.value)}</strong></span>)}</div><em>Open test details for the complete persisted record.</em></div>}{needsExplanation && <p className="reviewer-test-na">{test.status === 'BLOCKED' ? 'Blocked by dependency' : resultLabel(test.status)}{test.reason ? ` — ${test.reason}` : ''}</p>}{presentation.showEvidenceCount && <p className="reviewer-test-evidence-count">{evidence.length} supporting record{evidence.length === 1 ? '' : 's'} attached</p>}</article>;
}
