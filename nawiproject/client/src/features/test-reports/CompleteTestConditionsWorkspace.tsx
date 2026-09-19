import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Lock, Save } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';

type EndForm = { testEndDate: string; temperatureEnd: string; humidityEnd: string; pressureEnd: string; notes: string };
const blank: EndForm = { testEndDate: '', temperatureEnd: '', humidityEnd: '', pressureEnd: '', notes: '' };
const optionalNumber = (value: string) => value.trim() === '' ? undefined : Number(value);

export default function CompleteTestConditionsWorkspace() {
  const { reportId = '' } = useParams();
  const nav = useNavigate();
  const [report, setReport] = useState<any>(null);
  const [available, setAvailable] = useState(false);
  const [pendingTests, setPendingTests] = useState<any[]>([]);
  const [form, setForm] = useState<EndForm>(blank);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { void axios.get(`/test-reports/${reportId}/test-conditions`).then(response => { const nextReport = response.data.report; setReport(nextReport); setAvailable(response.data.available === true); setPendingTests(response.data.pendingTests || []); setForm({ testEndDate: nextReport.laboratory?.testEndDate || '', temperatureEnd: nextReport.environment?.temperatureEnd == null ? '' : String(nextReport.environment.temperatureEnd), humidityEnd: nextReport.environment?.relativeHumidityEnd == null ? '' : String(nextReport.environment.relativeHumidityEnd), pressureEnd: nextReport.environment?.barometricPressureEnd == null ? '' : String(nextReport.environment.barometricPressureEnd), notes: '' }); }).catch(e => setError(e.response?.data?.message || 'Unable to load the session completion step.')); }, [reportId]);
  const set = (key: keyof EndForm, value: string) => setForm(current => ({ ...current, [key]: value }));
  const save = async () => {
    setBusy(true); setError('');
    try { await axios.patch(`/test-reports/${reportId}/test-conditions`, { testEndDate: form.testEndDate, temperatureEnd: optionalNumber(form.temperatureEnd), relativeHumidityEnd: optionalNumber(form.humidityEnd), barometricPressureEnd: optionalNumber(form.pressureEnd), notes: form.notes }); nav(`/tester/reports/${reportId}/review`); }
    catch (e: any) { setError(e.response?.data?.message || 'Unable to save the final test conditions.'); }
    finally { setBusy(false); }
  };
  if (!report) return <main className="verification-page"><div className="verification-loading">{error || 'Loading Complete Test Conditions…'}</div></main>;
  return <main className="verification-page"><header className="workspace-top"><Link to={`/tester/reports/${reportId}/testing`}><ArrowLeft size={16} /> Testing</Link><div className="workspace-brand"><strong>NAWI</strong><span>TEST &amp; REPORT SYSTEM</span></div></header><section className="workspace-content"><div className="workspace-heading"><div><span className="technical-label">SESSION COMPLETION</span><h1>Complete Test Conditions</h1><p>{report.testReportId} · Record the final conditions at the end of the testing session.</p></div><span className={`workspace-status ${available ? 'active' : ''}`}>{available ? 'Available' : 'Locked'}</span></div>{!available ? <section className="lab-locked"><Lock size={22} /><div><h2>Complete the testing route first</h2><p>Final session conditions become available only after every applicable test has reached its valid completed state.</p><ul>{pendingTests.map(test => <li key={test.code}><strong>{test.code}</strong> {test.name}</li>)}</ul><Link className="report-secondary" to={`/tester/reports/${reportId}/testing`}>Return to Testing</Link></div></section> : <><div className="lab-start-summary"><span><strong>Session setup recorded</strong><small>{report.laboratory?.name || 'Laboratory not named'} · {report.laboratory?.location || 'Location not recorded'}</small></span><span><strong>Started</strong><small>{report.laboratory?.testStartDate ? new Date(report.laboratory.testStartDate).toLocaleString() : 'Not recorded'}</small></span></div><section className="lab-panel"><h2>Session end</h2><p className="lab-help">Record observed end-of-session values. Do not estimate values that were not observed.</p><div className="lab-grid"><LabField label="Test End Date/Time" type="datetime-local" value={form.testEndDate} onChange={value => set('testEndDate', value)} /><LabField label="Ending Temperature (°C)" type="number" step="any" value={form.temperatureEnd} onChange={value => set('temperatureEnd', value)} /><LabField label="Ending Relative Humidity (%)" type="number" min="0" max="100" step="any" value={form.humidityEnd} onChange={value => set('humidityEnd', value)} /><LabField label="Ending Barometric Pressure (hPa)" type="number" min="0" step="any" value={form.pressureEnd} onChange={value => set('pressureEnd', value)} /></div><label className="lab-notes"><span>Final Test-Condition Notes (optional)</span><textarea value={form.notes} onChange={event => set('notes', event.target.value)} /></label></section>{error && <div className="report-error">{error}</div>}<div className="completion-bar"><Link className="report-secondary" to={`/tester/reports/${reportId}/testing`}><ArrowLeft size={16} /> Back to Testing</Link><button className="report-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save & Continue to Review'}{busy ? <Save size={16} /> : <Check size={16} />}</button></div></>}</section></main>;
}

function LabField({ label, value, onChange, type = 'text', min, max, step }: { label: string; value: string; onChange: (value: string) => void; type?: string; min?: string; max?: string; step?: string }) { return <label className="lab-field"><span>{label}</span><input type={type} min={min} max={max} step={step} value={value} onChange={event => onChange(event.target.value)} /></label>; }
