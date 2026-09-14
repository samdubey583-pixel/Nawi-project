import { useEffect, useState } from 'react';
import { ArrowLeft, Check, LogOut, Send } from 'lucide-react';
import axios from 'axios';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

const mass = (value: unknown, unit = 'g') => Number.isFinite(Number(value)) ? `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 6 }).format(Number(value))} ${unit}` : '—';
const valueOrDash = (value: unknown) => value === undefined || value === null || value === '' ? '—' : String(value);

export default function FinalReportWorkspace() {
  const { reportId = '' } = useParams();
  const location = useLocation();
  const nav = useNavigate();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => void axios.get(`/test-reports/${reportId}/review`).then(response => setData(response.data)).catch(e => setError(e.response?.data?.message || 'Unable to load the report preview.'));
  useEffect(load, [reportId]);

  const finalize = async () => {
    setBusy(true); setError('');
    try { await axios.post(`/test-reports/${reportId}/review/submit`); nav(`/tester/reports/${reportId}/final-report`); }
    catch (e: any) { setError(e.response?.data?.message || 'Unable to finalize this report.'); }
    finally { setBusy(false); }
  };

  if (!data) return <main className="verification-page"><div className="verification-loading">{error || 'Loading report preview…'}</div></main>;
  const { report, verification, performance } = data;
  const finalized = report.stage === 'FINAL_REPORT' && report.status === 'COMPLETED';
  const reviewMode = location.pathname.endsWith('/review');
  const points = performance?.loadPoints || [];
  const unit = performance?.instrumentSnapshot?.unit || report.instrument?.unit || 'g';
  const applicableTests = (data.applicability?.tests || []).filter((test: any) => test.status === 'APPLICABLE');
  const pendingTests = data.pendingTests || [];
  const canFinalize = data.readinessError == null && performance?.status === 'COMPLETED';
  const overall = finalized ? performance?.result || 'NEEDS REVIEW' : pendingTests.length ? 'NEEDS REVIEW' : performance?.result || 'NEEDS REVIEW';
  const environment = report.environment || {};

  return <main className="verification-page">
    <header className="workspace-top"><Link to={`/tester/reports/${reportId}/test-conditions`}><ArrowLeft size={16} /> Complete Test Conditions</Link><div className="workspace-brand"><strong>NAWI</strong><span>TEST &amp; REPORT SYSTEM</span></div><button className="report-logout" onClick={() => { axios.post('/auth/logout').finally(() => nav('/login')); }}><LogOut size={15} /> Sign out</button></header>
    <section className="workspace-content report-review-content">
      <div className="workspace-heading report-review-heading"><div><span className="technical-label">TEST REPORT · {reviewMode && !finalized ? 'REVIEW' : 'FINAL REPORT'}</span><h1>{reviewMode && !finalized ? 'Review &amp; Submit' : 'Final Report'}</h1><p>{reviewMode && !finalized ? 'Review the completed report before final submission.' : 'The submitted report and recorded test results.'}</p></div><span className={`workspace-status ${finalized ? 'complete' : 'active'}`}>{finalized ? 'Finalized' : 'Ready for review'}</span></div>
      <section className="report-identity"><div><small>Report number</small><strong>{valueOrDash(report.testReportId)}</strong></div><div><small>Applicant</small><strong>{valueOrDash(report.applicant?.name || report.manufacturer?.name)}</strong></div><div><small>Instrument</small><strong>{valueOrDash(report.instrument?.typeDesignation)}</strong></div><div><small>Status</small><strong>{finalized ? 'Finalized' : 'Review pending'}</strong></div></section>
      <div className="final-report-preview">
        <ReviewSection title="Application" meta={report.externalApplicationReference || report.applicationNumber}><SummaryGrid items={[["Applicant / Manufacturer", report.applicant?.name || report.manufacturer?.name], ["Contact", report.applicant?.contactName], ["Email", report.applicant?.email], ["Phone", report.applicant?.contactNumber], ["Address", report.applicant?.address]]} /></ReviewSection>
        <ReviewSection title="Instrument" meta={report.instrument?.typeDesignation}><SummaryGrid items={[["Manufacturer", report.manufacturer?.name], ["Model", report.instrument?.typeDesignation], ["Serial number", report.instrument?.serialNumber], ["Accuracy Class", report.instrument?.accuracyClass], ["Indication Type", report.instrument?.indicationType], ["Min", mass(report.instrument?.min, unit)], ["Max", mass(report.instrument?.max, unit)], ["e", mass(report.instrument?.e, unit)], ["d", mass(report.instrument?.d, unit)], ["Unit", unit], ["n", report.instrument?.n], ["Software / Firmware", report.instrument?.softwareVersion], ["Load Cell / Module", report.instrument?.loadCellInformation], ["Interfaces", report.instrument?.interfaces || '—']]} /></ReviewSection>
        <ReviewSection title="Test Session" meta={report.laboratory?.name || 'Session conditions'}><SummaryGrid items={[["Laboratory", report.laboratory?.name], ["Location", report.laboratory?.location], ["Start date/time", report.laboratory?.testStartDate], ["End date/time", report.laboratory?.testEndDate]]} /></ReviewSection>
        <ReviewSection title="Test Conditions" meta="Observed session environment"><SummaryGrid items={[["Start temperature", environment.temperatureStart == null ? '—' : `${environment.temperatureStart} °C`], ["End temperature", environment.temperatureEnd == null ? '—' : `${environment.temperatureEnd} °C`], ["Start humidity", environment.relativeHumidityStart == null ? environment.relativeHumidity == null ? '—' : `${environment.relativeHumidity} %` : `${environment.relativeHumidityStart} %`], ["End humidity", environment.relativeHumidityEnd == null ? '—' : `${environment.relativeHumidityEnd} %`], ["Start pressure", environment.barometricPressureStart == null ? environment.barometricPressure == null ? '—' : `${environment.barometricPressure} hPa` : `${environment.barometricPressureStart} hPa`], ["End pressure", environment.barometricPressureEnd == null ? '—' : `${environment.barometricPressureEnd} hPa`], ["Power supply", report.powerSupply?.source], ["Nominal voltage", report.powerSupply?.voltage == null ? '—' : `${report.powerSupply.voltage} V`]]} /></ReviewSection>
        <ReviewSection title="Verification" meta={verification?.status === 'COMPLETED' ? 'Completed' : 'Incomplete'}><SummaryGrid items={[["Status", verification?.status], ["Overall result", verification?.overallStatus], ["Completed", verification?.completedAt ? new Date(verification.completedAt).toLocaleString() : '—']]} /></ReviewSection>
        <ReviewSection title="Test Results" meta={`${applicableTests.length} applicable tests`}><div className="route-result-list">{applicableTests.map((test: any) => { const completed = test.code === 'A.4.4' && performance?.status === 'COMPLETED'; return <div className="route-result-row" key={test.code}><div><strong>{friendlyName(test)}</strong><small>{test.source}</small></div><span className={completed ? 'result-chip pass' : 'result-chip pending'}>{completed ? `COMPLETED · ${performance.result}` : 'INCOMPLETE'}</span></div>; })}{!applicableTests.length && <p className="review-empty">No applicable test results are available.</p>}</div>{performance?.status === 'COMPLETED' && <details className="report-detail"><summary>A.4.4 measurement record · {points.length} load points</summary><div className="final-report-table-wrap"><table className="final-report-table"><thead><tr><th>#</th><th>Direction</th><th>Actual L</th><th>Indication I</th><th>ΔL</th><th>P</th><th>E</th><th>Ec</th><th>MPE</th><th>Result</th></tr></thead><tbody>{points.map((point: any) => <tr key={point.sequence}><td>{point.sequence}</td><td>{point.direction === 'DECREASING' ? 'Decreasing' : 'Increasing'}</td><td>{mass(point.loadL, unit)}</td><td>{mass(point.indicationI, unit)}</td><td>{mass(point.deltaL, unit)}</td><td>{mass(point.trueIndicationP, unit)}</td><td>{mass(point.rawErrorE, unit)}</td><td>{mass(point.correctedErrorEc, unit)}</td><td>{point.mpeValue == null ? '—' : `±${mass(point.mpeValue, unit)}`}</td><td><span className={`point-result ${String(point.complianceResult || point.result || '').toLowerCase()}`}>{point.complianceResult || point.result || '—'}</span></td></tr>)}</tbody></table></div></details>}</ReviewSection>
        <section className={`overall-result ${String(overall).toLowerCase().replace(/\s+/g, '-')}`}><div><small>OVERALL RESULT</small><h2>{overall}</h2><p>{finalized ? 'This result reflects the saved verification and testing record.' : pendingTests.length ? 'Complete the remaining applicable tests before final submission.' : 'Review the saved report before submitting it.'}</p></div></section>
      </div>
      {data.readinessError && <div className="report-error">{data.readinessError}</div>}
      {error && <div className="report-error">{error}</div>}
      <div className="completion-bar report-submit-bar"><Link className="report-secondary" to={`/tester/reports/${reportId}/testing`}><ArrowLeft size={16} /> Back to Testing</Link>{finalized ? <div className="completion-message"><Check size={18} /><div><strong>Report Submitted</strong><span>The final report is saved and available for review.</span></div></div> : <button className="report-primary" onClick={finalize} disabled={busy || !canFinalize}>{busy ? 'Submitting…' : 'Submit Report'}<Send size={16} /></button>}</div>
    </section>
  </main>;
}

function ReviewSection({ title, meta, children }: { title: string; meta?: string; children: React.ReactNode }) { return <section className="final-report-section"><div className="final-report-section-heading"><h2>{title}</h2><span>{valueOrDash(meta)}</span></div>{children}</section>; }
function SummaryGrid({ items }: { items: Array<[string, unknown]> }) { return <div className="final-report-grid">{items.map(([label, value]) => <p key={label}><small>{label}</small><strong>{valueOrDash(value)}</strong></p>)}</div>; }
function friendlyName(test: any) { const names: Record<string, string> = { 'A.4.2': 'Checking of Zero', 'A.4.3': 'Zero Setting', 'A.4.4': 'Weighing Performance', 'A.4.6': 'Tare', 'A.4.7': 'Eccentricity', 'A.4.8': 'Discrimination', 'A.4.10': 'Repeatability', 'A.4.11': 'Variation of Indication with Time', 'A.4.12': 'Stability of Equilibrium', 'A.5.3': 'Influence Factor Tests', A6: 'Endurance' }; return names[test.code] || test.name; }
