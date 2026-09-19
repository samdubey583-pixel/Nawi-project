import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Save } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';

type StartForm = {
  name: string; location: string; testStartDate: string;
  temperatureStart: string; humidityStart: string; pressureStart: string;
  powerSource: string; nominalVoltage: string; instrumentLevelled: string; zeroSetting: string;
  smallerThanEIndicationDeviceUsed: string; simulatorUsed: string; adjustmentPerformed: string;
  notes: string;
};

const blank: StartForm = {
  name: '', location: '', testStartDate: '', temperatureStart: '', humidityStart: '', pressureStart: '',
  powerSource: '', nominalVoltage: '', instrumentLevelled: '', zeroSetting: '',
  smallerThanEIndicationDeviceUsed: '', simulatorUsed: '', adjustmentPerformed: '', notes: '',
};

const optionalNumber = (value: string) => value.trim() === '' ? undefined : Number(value);
const loadForm = (report: any): StartForm => ({
  ...blank,
  name: report.laboratory?.name || '', location: report.laboratory?.location || '', testStartDate: report.laboratory?.testStartDate || '',
  temperatureStart: report.environment?.temperatureStart == null ? '' : String(report.environment.temperatureStart),
  humidityStart: report.environment?.relativeHumidityStart == null ? report.environment?.relativeHumidity == null ? '' : String(report.environment.relativeHumidity) : String(report.environment.relativeHumidityStart),
  pressureStart: report.environment?.barometricPressureStart == null ? report.environment?.barometricPressure == null ? '' : String(report.environment.barometricPressure) : String(report.environment.barometricPressureStart),
  powerSource: report.powerSupply?.source || '', nominalVoltage: report.powerSupply?.voltage == null ? '' : String(report.powerSupply.voltage),
  instrumentLevelled: report.instrumentSetup?.instrumentLevelled || '', zeroSetting: report.instrumentSetup?.zeroSetting || '',
  smallerThanEIndicationDeviceUsed: report.instrumentSetup?.smallerThanEIndicationDeviceUsed || '', simulatorUsed: report.instrumentSetup?.simulatorUsed || '',
  adjustmentPerformed: report.instrumentSetup?.adjustmentPerformed || '', notes: report.instrumentSetup?.notes || report.environment?.notes || '',
});

export default function LaboratoryEnvironmentWorkspace() {
  const { reportId = '' } = useParams();
  const nav = useNavigate();
  const [report, setReport] = useState<any>(null);
  const [form, setForm] = useState<StartForm>(blank);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { void axios.get(`/test-reports/${reportId}`).then(response => { setReport(response.data.report); setForm(loadForm(response.data.report)); }).catch(e => setError(e.response?.data?.message || 'Unable to load Laboratory & Environment.')); }, [reportId]);
  const set = (key: keyof StartForm, value: string) => setForm(current => ({ ...current, [key]: value }));
  const save = async () => {
    setBusy(true); setError('');
    try {
      const response = await axios.patch(`/test-reports/${reportId}/laboratory`, {
        laboratory: { name: form.name, location: form.location, testStartDate: form.testStartDate },
        environment: { temperatureStart: optionalNumber(form.temperatureStart), relativeHumidityStart: optionalNumber(form.humidityStart), barometricPressureStart: optionalNumber(form.pressureStart), notes: form.notes },
        powerSupply: { source: form.powerSource, voltage: optionalNumber(form.nominalVoltage), notes: '' },
        instrumentSetup: { instrumentLevelled: form.instrumentLevelled, zeroSetting: form.zeroSetting, smallerThanEIndicationDeviceUsed: form.smallerThanEIndicationDeviceUsed, simulatorUsed: form.simulatorUsed, adjustmentPerformed: form.adjustmentPerformed, notes: form.notes },
        testPreparation: { notes: form.notes },
      });
      setReport(response.data.report);
      await axios.post(`/test-reports/${reportId}/verification/start`);
      nav(`/tester/reports/${reportId}`);
    } catch (e: any) { setError(e.response?.data?.message || 'Unable to save Laboratory & Environment.'); } finally { setBusy(false); }
  };

  if (!report) return <main className="verification-page"><div className="verification-loading">{error || 'Loading Laboratory & Environment…'}</div></main>;
  return <main className="verification-page"><header className="workspace-top"><Link to={`/tester/reports/${reportId}`}><ArrowLeft size={16} /> Report workspace</Link><div className="workspace-brand"><strong>NAWI</strong><span>TEST &amp; REPORT SYSTEM</span></div></header><section className="workspace-content"><div className="workspace-heading"><div><span className="technical-label">TEST CONDITIONS</span><h1>Laboratory &amp; Environment</h1><p>{report.testReportId} · Session setup — record the conditions before verification begins.</p></div><span className="workspace-status active">Session setup</span></div><div className="lab-notice">Record only conditions known at the beginning of the session. Final temperature, humidity, pressure, and end time are completed after testing.</div><section className="lab-panel"><h2>Laboratory / session</h2><div className="lab-grid"><LabField label="Laboratory Name" value={form.name} onChange={value => set('name', value)} /><LabField label="Laboratory Location" value={form.location} onChange={value => set('location', value)} /><LabField label="Test Start Date/Time" type="datetime-local" value={form.testStartDate} onChange={value => set('testStartDate', value)} /></div></section><section className="lab-panel"><h2>Starting environment</h2><p className="lab-help">Enter the observed starting conditions. Do not estimate future or end-of-session values.</p><div className="lab-grid"><LabField label="Starting Temperature (°C)" type="number" step="any" value={form.temperatureStart} onChange={value => set('temperatureStart', value)} /><LabField label="Starting Relative Humidity (%)" type="number" min="0" max="100" step="any" value={form.humidityStart} onChange={value => set('humidityStart', value)} /><LabField label="Starting Barometric Pressure (hPa)" type="number" min="0" step="any" value={form.pressureStart} onChange={value => set('pressureStart', value)} /></div></section><section className="lab-panel"><h2>Power &amp; instrument setup</h2><div className="lab-grid"><LabField label="Power Supply / Mains Condition" value={form.powerSource} onChange={value => set('powerSource', value)} /><LabField label="Nominal Voltage (V)" type="number" min="0" value={form.nominalVoltage} onChange={value => set('nominalVoltage', value)} /><LabSelect label="Instrument Levelled / Reference Position" value={form.instrumentLevelled} onChange={value => set('instrumentLevelled', value)} /><LabSelect label="Automatic Zero-setting / Zero-tracking" value={form.zeroSetting} onChange={value => set('zeroSetting', value)} /><LabSelect label="Smaller-than-e Indication Device Used" value={form.smallerThanEIndicationDeviceUsed} onChange={value => set('smallerThanEIndicationDeviceUsed', value)} /><LabSelect label="Simulator Used" value={form.simulatorUsed} onChange={value => set('simulatorUsed', value)} /><LabSelect label="Adjustment Performed" value={form.adjustmentPerformed} onChange={value => set('adjustmentPerformed', value)} /></div><label className="lab-notes"><span>Additional Test-Condition Notes</span><textarea value={form.notes} onChange={event => set('notes', event.target.value)} /></label></section>{error && <div className="report-error">{error}</div>}<div className="completion-bar"><Link className="report-secondary" to={`/tester/reports/${reportId}`}><ArrowLeft size={16} /> Back</Link><button className="report-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save & Continue to Verification'}{busy ? <Save size={16} /> : <Check size={16} />}</button></div></section></main>;
}

function LabField({ label, value, onChange, type = 'text', min, max, step }: { label: string; value: string; onChange: (value: string) => void; type?: string; min?: string; max?: string; step?: string }) { return <label className="lab-field"><span>{label}</span><input type={type} min={min} max={max} step={step} value={value} onChange={event => onChange(event.target.value)} /></label>; }
function LabSelect({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="lab-field"><span>{label}</span><select value={value} onChange={event => onChange(event.target.value)}><option value="">Not recorded</option><option value="YES">Yes</option><option value="NO">No</option><option value="NOT_APPLICABLE">Not applicable</option></select></label>; }
