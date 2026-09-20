import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, Check, Download, LogOut, Send } from 'lucide-react';
import axios from 'axios';
import { Link, useNavigate, useParams } from 'react-router-dom';
import EvidencePanel from '../evidence/EvidencePanel';
import './final-report.css';

const valueOrDash = (value: unknown) => value === undefined || value === null || value === '' ? '—' : String(value);
const dateTime = (value: unknown) => value ? new Date(String(value)).toLocaleString() : '—';
const mass = (value: unknown, unit = 'g') => Number.isFinite(Number(value)) ? `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 6 }).format(Number(value))} ${unit}` : '—';

export default function FinalReportWorkspace() {
  const { reportId = '' } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [messageNotice, setMessageNotice] = useState('');

  const load = async () => {
    try {
      const response = await axios.get(`/test-reports/${reportId}/review`);
      setData(response.data);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Unable to load the report review.');
    }
  };

  useEffect(() => { void load(); }, [reportId]);

  const downloadPdf = async () => {
    setBusy(true); setError('');
    try {
      const response = await axios.get(`/test-reports/${reportId}/review/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${data.report.testReportId}-draft-report.pdf`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Unable to generate the draft PDF.');
    } finally { setBusy(false); }
  };

  const submitForReview = async () => {
    setBusy(true); setError(''); setConfirmSubmit(false);
    try {
      await axios.post(`/test-reports/${reportId}/review/submit`);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Unable to submit this report for review.');
    } finally { setBusy(false); }
  };

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setMessageNotice('');
    try {
      await axios.post(`/test-reports/${reportId}/review/messages`, { subject, message });
      setSubject(''); setMessage(''); setMessageNotice('Message sent to the reviewing authority.'); await load();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Unable to send the authority message.');
    } finally { setBusy(false); }
  };

  if (!data) return <main className="verification-page"><div className="verification-loading">{error || 'Loading final testing review…'}</div></main>;

  const { report, performance, influenceFactors, endurance } = data;
  const prototype = Boolean(data.prototype);
  const submitted = ['AWAITING_REVIEW', 'UNDER_REVIEW'].includes(String(report.status));
  const finalized = report.stage === 'FINAL_REPORT' && report.status === 'COMPLETED';
  const unit = report.instrument?.unit || performance?.instrumentSnapshot?.unit || 'g';
  const routeTests = [...(data.applicability?.tests || [])].sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
  const records = { performance, influenceFactors, endurance, ...data };
  const pendingTests = data.pendingTests || [];
  const attentionTests = data.attentionTests || [];
  const canSubmit = !submitted && !finalized && !data.readinessError && pendingTests.length === 0 && attentionTests.length === 0;
  const overall = data.overallResult || 'INCOMPLETE';
  const overallClass = String(overall).toLowerCase();

  return <main className="verification-page">
    <header className="workspace-top">
      <Link to={submitted ? '/tester/dashboard' : `/tester/reports/${reportId}/testing`}><ArrowLeft size={16} /> {submitted ? 'Back to Dashboard' : 'Back to Testing'}</Link>
      <div className="workspace-brand"><strong>NAWI</strong><span>TEST &amp; REPORT SYSTEM</span></div>
      <button className="report-logout" onClick={() => { axios.post('/auth/logout').finally(() => nav('/login')); }}><LogOut size={15} /> Sign out</button>
    </header>

    <section className="workspace-content report-review-content">
      <div className="workspace-heading report-review-heading">
        <div><span className="technical-label">FINAL TESTING HANDOFF</span><h1>Final Testing Review</h1><p>Review the completed test record before submitting it to the reviewing authority.</p></div>
        <span className={`workspace-status ${submitted || finalized ? 'complete' : 'active'}`}>{submitted ? 'Submitted for review' : finalized ? 'Finalized' : 'Draft review'}</span>
      </div>
      {prototype && <div className="report-prototype-banner"><strong>PROTOTYPE WORKFLOW</strong><span>This report contains synthetic/prototype test data and must not be treated as a genuine legal-metrology test report.</span></div>}
      {error && <div className="report-error" role="alert">{error}</div>}

      <section className="review-summary-strip">
        <SummaryMetric label="Report number" value={report.testReportId} />
        <SummaryMetric label="Instrument" value={report.instrument?.typeDesignation} />
        <SummaryMetric label="Mathematical result" value={overall} />
        <SummaryMetric label="Workflow status" value={submitted ? 'AWAITING REVIEW' : report.status} />
        {submitted && <SummaryMetric label="Submitted by / at" value={`${valueOrDash(report.testerNameSnapshot || report.laboratory?.testerName)} · ${dateTime(report.submittedForReviewAt)}`} />}
      </section>

      <div className="review-document">
        <ReviewSection title="Report overview" meta={report.testReportId}>
          <SummaryGrid items={[
            ['Report number', report.testReportId], ['Manufacturer', report.manufacturer?.name], ['Model / type', report.instrument?.typeDesignation],
            ['Serial number', report.instrument?.serialNumber], ['Accuracy class', report.instrument?.accuracyClass], ['Min', mass(report.instrument?.min, unit)],
            ['Max', mass(report.instrument?.max, unit)], ['e / d', `${mass(report.instrument?.e, unit)} / ${mass(report.instrument?.d, unit)}`], ['Unit', unit],
            ['Laboratory', report.laboratory?.name], ['Tester', report.laboratory?.testerName || report.testerNameSnapshot],
            ['Test dates', `${dateTime(report.laboratory?.testStartDate)} → ${dateTime(report.laboratory?.testEndDate)}`],
          ]} />
        </ReviewSection>

        <ReviewSection title="Test results" meta={`${routeTests.length} applicable route entries`}>
          <div className="review-overall-row">
            <section className={`review-overall review-overall-${overallClass}`}><div><span className="technical-label">OVERALL MATHEMATICAL RESULT</span><h2>{overall}</h2><p>Derived from the persisted test calculations. Prototype classification is shown separately.</p></div></section>
            {prototype && <div className="review-classification"><small>Classification</small><strong>PROTOTYPE WORKFLOW</strong><span>Not legal-metrology evidence</span></div>}
          </div>
          <div className="review-route-table" role="table" aria-label="Persisted test summary">
            <div className="review-route-header" role="row"><span>Clause</span><span>Test</span><span>Status</span><span>Result</span></div>
            {routeTests.map((test: any) => { const state = routeState(test, records, prototype); return <div className="review-route-row" role="row" key={test.code}><span className="review-route-code">{test.code}</span><div><strong>{friendlyName(test)}</strong><small>{test.source || 'OIML R 76-1:2006 Annex A'}</small></div><span className={`review-state ${state.className}`}>{state.label}</span><span className="review-route-result">{state.result}</span></div>; })}
            {!routeTests.length && <p className="review-empty">No generated test route is available.</p>}
          </div>
        </ReviewSection>

        <ReviewSection title="Validation before submission" meta={canSubmit ? 'Ready' : 'Action required'}>
          {canSubmit ? <div className="review-validation-ok"><Check size={17} /> All applicable test and report prerequisites are ready for submission.</div> : <div className="review-validation-list">
            {data.readinessError && <p><strong>Test conditions:</strong> {data.readinessError}</p>}
            {pendingTests.length > 0 && <p><strong>Incomplete tests:</strong> {pendingTests.map((item: any) => `${item.code} ${item.name || ''}`).join(', ')}</p>}
            {attentionTests.length > 0 && <p><strong>Attention required:</strong> {attentionTests.map((item: any) => `${item.code} ${item.reason || item.name || 'review the test record'}`).join(', ')}</p>}
          </div>}
        </ReviewSection>

        {endurance && <ReviewSection title="A.6 endurance summary" meta={prototype ? 'Prototype workflow' : endurance.status}>
          <div className="review-fields">
            <SummaryMetric label="Applications" value={`${Number(endurance.completedCycles || 0).toLocaleString('en-IN')} / ${Number(endurance.targetCycles || 100000).toLocaleString('en-IN')}`} />
            <SummaryMetric label="Synthetic applications" value={Number(endurance.syntheticCycles || 0).toLocaleString('en-IN')} />
            <SummaryMetric label="Pre-endurance baseline" value={`${valueOrDash(endurance.preWeighing?.sourceObservationId)} · ${mass(endurance.preWeighing?.correctedErrorEc, unit)}`} />
            <SummaryMetric label="Post-endurance error" value={mass(endurance.postWeighing?.Ec, unit)} />
            <SummaryMetric label="Durability result" value={endurance.durabilityAssessment?.result} />
            <SummaryMetric label="Abnormal events" value={(endurance.events || []).filter((item: any) => String(item.action || '').toLowerCase().includes('abnormal')).length} />
            <SummaryMetric label="Recovery checkpoints" value={(endurance.checkpoints || []).length} />
          </div>
          {prototype && <p className="report-prototype-copy">Synthetic endurance counts and prototype navigation remain visibly classified as non-legal evidence.</p>}
        </ReviewSection>}

        <ReviewSection title="Complete results" meta="Persisted observations and calculations">
          <details className="review-detail"><summary>View persisted report details</summary><div className="review-complete-details"><p>Detailed observations and calculations remain in the existing test workspaces and are represented here from their persisted result records.</p>{performance?.loadPoints?.length ? <div className="final-report-table-wrap"><table className="final-report-table"><thead><tr><th>#</th><th>Load</th><th>Indication</th><th>Ec</th><th>MPE</th><th>Result</th></tr></thead><tbody>{performance.loadPoints.map((point: any) => <tr key={point.sequence}><td>{point.sequence}</td><td>{mass(point.loadL, unit)}</td><td>{mass(point.indicationI, unit)}</td><td>{mass(point.correctedErrorEc, unit)}</td><td>{point.mpeValue == null ? '—' : mass(point.mpeValue, unit)}</td><td>{point.complianceResult || point.result || '—'}</td></tr>)}</tbody></table></div> : <p>No A.4.4 observations recorded.</p>}</div></details>
        </ReviewSection>

        <ReviewSection title="Additional evidence" meta="Optional report-level support">
          <EvidencePanel context={{ reportId, category: 'REPORT', evidenceType: 'report_additional', label: 'Additional report evidence', title: 'Additional report evidence', testName: 'Final Testing Review', oimlReference: 'Report' }} />
        </ReviewSection>

        <ReviewSection title="Authority communication" meta="Report-scoped message thread">
          <form className="authority-message-form" onSubmit={sendMessage}><label>Subject<input value={subject} onChange={event => setSubject(event.target.value)} required maxLength={200} placeholder="Report ready for review" /></label><label>Message<textarea value={message} onChange={event => setMessage(event.target.value)} required rows={5} maxLength={10000} placeholder="Write a message to the reviewing authority." /></label><button className="report-primary" type="submit" disabled={busy || !subject.trim() || !message.trim()}><Send size={16} /> Send message</button></form>
          {messageNotice && <div className="handoff-success"><Check size={16} /> {messageNotice}</div>}
          <div className="authority-message-list">{(data.messages || []).map((item: any) => <article key={item._id}><div><strong>{item.subject}</strong><small>{item.senderNameSnapshot} · {dateTime(item.createdAt)}</small></div><p>{item.message}</p></article>)}{!(data.messages || []).length && <p className="review-empty">No authority messages yet.</p>}</div>
        </ReviewSection>
      </div>

      <section className="handoff-actions" aria-label="Final report actions">
        <div><span className="technical-label">SUBMISSION</span><h2>{submitted ? 'Submitted for review' : 'Final actions'}</h2><p>{submitted ? `Submitted ${dateTime(report.submittedForReviewAt)} by ${valueOrDash(report.testerNameSnapshot || report.laboratory?.testerName)}.` : data.readinessError || (pendingTests.length ? `${pendingTests.length} applicable test(s) remain before submission.` : 'Download the draft, then submit the persisted report when ready.')}</p></div>
        <div className="handoff-action-buttons">
          <button className="report-primary" onClick={() => setConfirmSubmit(true)} disabled={busy || submitted || finalized}><Send size={16} /> Submit for Review</button>
          <button className="report-secondary" onClick={() => void downloadPdf()} disabled={busy}><Download size={16} /> {busy ? 'Preparing…' : 'Download Draft PDF'}</button>
          <button className="report-tertiary" onClick={() => nav('/tester/dashboard')}><ArrowLeft size={16} /> Go to Dashboard</button>
        </div>
      </section>

      {confirmSubmit && <div className="report-confirm-backdrop" role="presentation"><div className="report-confirm" role="dialog" aria-modal="true" aria-labelledby="submit-report-title"><span className="technical-label">SUBMIT REPORT FOR REVIEW</span><h2 id="submit-report-title">Send this report to the reviewing authority?</h2>{prototype && <p className="report-prototype-copy">This is a PROTOTYPE workflow. Submission does not make synthetic endurance data legally valid.</p>}{!canSubmit && <p className="report-validation-copy">The server will not accept submission yet: {data.readinessError || (pendingTests.length ? `${pendingTests.length} applicable test(s) remain.` : 'a report prerequisite requires attention.')}</p>}<p>The backend remains authoritative and will confirm or reject the transition.</p><div><button className="report-secondary" onClick={() => setConfirmSubmit(false)}>Cancel</button><button className="report-primary" onClick={() => void submitForReview()} disabled={busy}>Submit for Review <Send size={16} /></button></div></div></div>}
    </section>
  </main>;
}

function SummaryMetric({ label, value }: { label: string; value: unknown }) { return <div className="review-summary-metric"><small>{label}</small><strong>{valueOrDash(value)}</strong></div>; }
function ReviewSection({ title, meta, children }: { title: string; meta?: string; children: ReactNode }) { return <section className="review-section"><div className="review-section-heading"><h2>{title}</h2><span>{valueOrDash(meta)}</span></div>{children}</section>; }
function SummaryGrid({ items }: { items: Array<[string, unknown]> }) { return <div className="review-fields">{items.map(([label, value]) => <div className="review-field" key={label}><small>{label}</small><strong>{valueOrDash(value)}</strong></div>)}</div>; }
function friendlyName(test: any) { const names: Record<string, string> = { 'A.4.2': 'Checking of Zero', 'A.4.3': 'Setting to Zero Before Loading', 'A.4.4': 'Weighing Performance', 'A.4.5': 'Multiple Indicating Devices', 'A.4.6': 'Tare', 'A.4.7': 'Eccentricity', 'A.4.8': 'Discrimination', 'A.4.9': 'Sensitivity', 'A.4.10': 'Repeatability', 'A.4.11': 'Variation of Indication with Time', 'A.4.12': 'Stability of Equilibrium', 'A.5': 'Influence Factors', 'A.6': 'Endurance' }; return names[test.code] || test.name || test.code; }
function routeState(test: any, records: any, prototype: boolean) { if (test.code === 'A.6' && prototype) return { label: 'PROTOTYPE', result: records.endurance?.durabilityAssessment?.result || 'INCOMPLETE', className: 'progress' }; const recordMap: Record<string, any> = { 'A.4.2': records.zeroChecking, 'A.4.3': records.zeroSettingBeforeLoading, 'A.4.4': records.performance, 'A.4.5': records.multipleIndicating, 'A.4.6': records.tare, 'A.4.7': records.eccentricity, 'A.4.8': records.discrimination, 'A.4.9': records.sensitivity, 'A.4.10': records.repeatability?.test || records.repeatability, 'A.4.11': records.variationWithTime, 'A.4.12': records.stabilityOfEquilibrium, 'A.5': records.influenceFactors, 'A.6': records.endurance }; const record = recordMap[test.code]; if (record?.status === 'COMPLETED' || (test.code === 'A.4.5' && ['PASS', 'FAIL'].includes(record?.status))) return { label: 'COMPLETED', result: record.result || record.status || '—', className: 'completed' }; if (record?.status === 'IN_PROGRESS') return { label: 'IN PROGRESS', result: '—', className: 'progress' }; if (test.status === 'NOT_APPLICABLE') return { label: 'NOT APPLICABLE', result: '—', className: 'muted' }; return { label: 'INCOMPLETE', result: '—', className: 'pending' }; }
