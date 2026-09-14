import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Lock, Play, Save } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import './zero-checking.css';

const units = ['mg', 'g', 'kg', 't'];
const phases = [
  ['A.4.2.1', 'Zero-setting Range'],
  ['A.4.2.2', 'Zero Indicator'],
  ['A.4.2.3', 'Accuracy of Zero-setting'],
] as const;

type FormState = { [key: string]: string };
const empty = { unit: 'g', startingZeroState: '', appliedLoad: '', zeroRestored: '', observedPositiveRange: '', observedNegativeRange: '', startingIndication: '', increment: '', indicationChanges: '', observedLowerRange: '', observedUpperRange: '', zeroIndicationI0: '', deltaL0: '', loadL: '', indicationI: '', deltaL: '', notes: '' };

export default function ZeroCheckingWorkspace() {
  const { reportId = '' } = useParams();
  const nav = useNavigate();
  const [report, setReport] = useState<any>();
  const [applicability, setApplicability] = useState<any>();
  const [test, setTest] = useState<any>();
  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { const response = await axios.get(`/test-reports/${reportId}/zero-checking`); setReport(response.data.report); setApplicability(response.data.applicability); setTest(response.data.test); if (response.data.test?.instrumentSnapshot?.unit) setForm(current => ({ ...current, unit: response.data.test.instrumentSnapshot.unit })); } catch (e: any) { setError(e.response?.data?.message || 'Unable to load Checking of Zero.'); }
  };
  useEffect(() => { void load(); }, [reportId]);
  const instrumentUnit = test?.instrumentSnapshot?.unit || report?.instrument?.unit || 'g';
  const applicablePhases = useMemo(() => (test?.phases || applicability?.phases || []).filter((phase: any) => phase.status === 'APPLICABLE' || phase.applicability === 'APPLICABLE'), [test?.phases, applicability?.phases]);
  const activePhase = test?.phases?.find((phase: any) => phase.applicability === 'APPLICABLE' && phase.status !== 'COMPLETED');
  const begin = async () => { setBusy(true); try { const response = await axios.post(`/test-reports/${reportId}/zero-checking/start`); setReport(response.data.report); setApplicability(response.data.applicability); setTest(response.data.test); setError(''); } catch (e: any) { setError(e.response?.data?.message || 'Unable to start Checking of Zero.'); } finally { setBusy(false); } };
  const set = (key: string, value: string) => setForm(current => ({ ...current, [key]: value }));
  const number = (key: string) => form[key] === '' ? undefined : Number(form[key]);
  const savePhase = async () => {
    if (!activePhase) return;
    setBusy(true);
    try {
      const body: any = { unit: form.unit || instrumentUnit, notes: form.notes };
      if (activePhase.code === 'A.4.2.1') Object.assign(body, { startingZeroState: form.startingZeroState, appliedLoad: Number(form.appliedLoad), zeroRestored: form.zeroRestored, observedPositiveRange: Number(form.observedPositiveRange), observedNegativeRange: number('observedNegativeRange') });
      if (activePhase.code === 'A.4.2.2') Object.assign(body, { startingIndication: Number(form.startingIndication), increment: Number(form.increment), indicationChanges: form.indicationChanges, observedLowerRange: Number(form.observedLowerRange), observedUpperRange: Number(form.observedUpperRange) });
      if (activePhase.code === 'A.4.2.3') Object.assign(body, { zeroIndicationI0: Number(form.zeroIndicationI0), deltaL0: Number(form.deltaL0), loadL: Number(form.loadL), indicationI: Number(form.indicationI), deltaL: Number(form.deltaL) });
      const response = await axios.patch(`/test-reports/${reportId}/zero-checking/phases/${activePhase.code}`, body); setTest(response.data.test); setError('');
    } catch (e: any) { setError(e.response?.data?.message || 'Unable to save this A.4.2 phase.'); } finally { setBusy(false); }
  };
  if (!report) return <main className="zero-checking-page"><div className="zero-checking-loading">{error || 'Loading Checking of Zero…'}</div></main>;
  if (!applicability || applicability.status !== 'APPLICABLE') return <main className="zero-checking-page"><Header reportId={reportId} /><section className="zero-checking-content"><div className="zero-checking-error"><h1>Checking of Zero unavailable</h1><p>{applicability?.reason || 'Instrument configuration is required before this procedure can start.'}</p><Link className="zero-secondary" to={`/tester/reports/${reportId}/testing`}>Back to Testing</Link></div></section></main>;
  return <main className="zero-checking-page"><Header reportId={reportId} /><section className="zero-checking-content">
    <div className="zero-checking-heading"><div><span className="technical-label">A.4.2 · OIML R 76-1:2006 ANNEX A</span><h1>Checking of Zero</h1><p>{report.testReportId} · Follow the applicable zero-setting procedure and record the observed evidence.</p></div><span className={`zero-status ${test?.status === 'COMPLETED' ? 'complete' : ''}`}>{test?.status === 'COMPLETED' ? `COMPLETED · ${test.result}` : test ? 'IN PROGRESS' : 'NOT STARTED'}</span></div>
    <section className="zero-stepper" aria-label="Checking of Zero phases">{phases.map(([code, name], index) => { const phase = test?.phases?.find((item: any) => item.code === code) || applicability.phases?.find((item: any) => item.code === code); const status = phase?.status || phase?.applicability || 'REQUIRES_CONFIGURATION'; return <div className={`zero-step ${status.toLowerCase()}`} key={code}><span>{status === 'COMPLETED' ? <Check size={16} /> : status === 'LOCKED' ? <Lock size={15} /> : index + 1}</span><div><strong>Phase {index + 1}</strong><b>{name}</b><small>{code} · {status.replace(/_/g, ' ')}</small></div></div>; })}</section>
    {!test ? <section className="zero-panel zero-start"><Play size={24} /><div><h2>Begin the zero-checking procedure</h2><p>The test will create an editable record for the applicable A.4.2 phases. No observations are generated automatically.</p></div><button className="zero-primary" onClick={begin} disabled={busy}><Play size={16} /> Begin Checking of Zero</button></section> : <>
      {test.status === 'COMPLETED' ? <section className="zero-panel zero-complete"><Check size={25} /><div><h2>Checking of Zero completed</h2><p>All applicable phases have been recorded. Result: <strong>{test.result}</strong>.</p>{test.phases?.find((phase: any) => phase.code === 'A.4.2.3')?.calculations && <CalculationDetails calculations={test.phases.find((phase: any) => phase.code === 'A.4.2.3').calculations} unit={instrumentUnit} />}<Link className="zero-primary" to={`/tester/reports/${reportId}/testing`}>Return to Test Route</Link></div></section> : activePhase && <PhaseForm phase={activePhase} form={form} set={set} instrumentUnit={instrumentUnit} onSave={savePhase} busy={busy} />}
      <section className="zero-panel zero-trace"><span className="technical-label">TRACEABILITY</span><p>OIML R 76-1:2006 Annex A A.4.2. A.4.2.3 uses the shared A.4.4.3 changeover calculation and the existing initial-verification MPE/compliance services.</p></section>
    </>}
    {error && <div className="zero-error">{error}</div>}
  </section></main>;
}

function Header({ reportId }: { reportId: string }) { return <header className="zero-top"><Link to={`/tester/reports/${reportId}/testing`}><ArrowLeft size={16} /> Testing route</Link><div className="zero-brand"><strong>NAWI</strong><span>TEST &amp; REPORT SYSTEM</span></div><Link to="/tester/reports">All Test Reports</Link></header>; }

function PhaseForm({ phase, form, set, instrumentUnit, onSave, busy }: { phase: any; form: FormState; set: (key: string, value: string) => void; instrumentUnit: string; onSave: () => void; busy: boolean }) {
  const saved = phase.observations || {};
  return <section className="zero-panel zero-phase"><div className="zero-phase-heading"><div><span className="technical-label">{phase.code}</span><h2>{phase.name}</h2><p>{phase.code === 'A.4.2.1' ? 'Observe the zero-setting range for the configured zero-setting arrangement.' : phase.code === 'A.4.2.2' ? 'Use small increments to observe the range indicated by the digital zero-indicating device.' : 'Record the changeover observation; P, E, Ec, MPE, and compliance are calculated automatically.'}</p></div><span className="zero-phase-badge">AVAILABLE</span></div>
    {phase.code === 'A.4.2.1' && <><div className="zero-fields"><Field label="Starting zero state" value={form.startingZeroState || saved.startingZeroState || ''} set={value => set('startingZeroState', value)} /><Field label={`Applied / removed load (${form.unit || instrumentUnit})`} type="number" min="0" value={form.appliedLoad || saved.inputAppliedLoad || ''} set={value => set('appliedLoad', value)} /><Select label="Was zero successfully restored?" value={form.zeroRestored || saved.zeroRestored || ''} options={['Yes', 'No']} set={value => set('zeroRestored', value)} /><Field label={`Observed positive zero-setting range (${form.unit || instrumentUnit})`} type="number" min="0" value={form.observedPositiveRange || saved.inputObservedPositiveRange || ''} set={value => set('observedPositiveRange', value)} /><Field label={`Observed negative zero-setting range (${form.unit || instrumentUnit}) · optional`} type="number" min="0" value={form.observedNegativeRange || saved.inputObservedNegativeRange || ''} set={value => set('observedNegativeRange', value)} /></div></>}
    {phase.code === 'A.4.2.2' && <><div className="zero-fields"><Field label={`Starting indication (${form.unit || instrumentUnit})`} type="number" value={form.startingIndication || saved.inputStartingIndication || ''} set={value => set('startingIndication', value)} /><Field label={`Small increment used (${form.unit || instrumentUnit})`} type="number" min="0" value={form.increment || saved.inputIncrement || ''} set={value => set('increment', value)} /><Field label="Observed indication changes" value={form.indicationChanges || saved.indicationChanges || ''} set={value => set('indicationChanges', value)} /><Field label={`Observed lower zero range (${form.unit || instrumentUnit})`} type="number" value={form.observedLowerRange || saved.inputObservedLowerRange || ''} set={value => set('observedLowerRange', value)} /><Field label={`Observed upper zero range (${form.unit || instrumentUnit})`} type="number" value={form.observedUpperRange || saved.inputObservedUpperRange || ''} set={value => set('observedUpperRange', value)} /></div></>}
    {phase.code === 'A.4.2.3' && <><div className="zero-fields"><Field label={`Zero indication I0 (${form.unit || instrumentUnit})`} type="number" value={form.zeroIndicationI0} set={value => set('zeroIndicationI0', value)} /><Field label={`Additional load ΔL0 (${form.unit || instrumentUnit})`} type="number" min="0" value={form.deltaL0} set={value => set('deltaL0', value)} /><Field label={`Test load L (${form.unit || instrumentUnit})`} type="number" min="0" value={form.loadL} set={value => set('loadL', value)} /><Field label={`Indication I (${form.unit || instrumentUnit})`} type="number" value={form.indicationI} set={value => set('indicationI', value)} /><Field label={`Additional load ΔL (${form.unit || instrumentUnit})`} type="number" min="0" value={form.deltaL} set={value => set('deltaL', value)} /></div>{phase.calculations && <CalculationDetails calculations={phase.calculations} unit={instrumentUnit} />}</>}
    <label className="zero-notes"><span>Operator notes (optional)</span><textarea value={form.notes || saved.notes || ''} onChange={event => set('notes', event.target.value)} /></label><div className="zero-phase-actions"><label>Observation unit<select value={form.unit || instrumentUnit} onChange={event => set('unit', event.target.value)}>{units.map(unit => <option key={unit}>{unit}</option>)}</select></label><button className="zero-primary" onClick={onSave} disabled={busy}><Save size={16} /> Save &amp; Complete Phase</button></div>
  </section>;
}

function Field({ label, value, set, type = 'text', min }: { label: string; value: string; set: (value: string) => void; type?: string; min?: string }) { return <label><span>{label}</span><input type={type} min={min} step="any" value={value} onChange={event => set(event.target.value)} /></label>; }
function Select({ label, value, options, set }: { label: string; value: string; options: string[]; set: (value: string) => void }) { return <label><span>{label}</span><select value={value} onChange={event => set(event.target.value)}><option value="">Select</option>{options.map(option => <option key={option}>{option}</option>)}</select></label>; }
function CalculationDetails({ calculations, unit }: { calculations: any; unit: string }) { return <div className="zero-calculations"><span>Calculated A.4.2.3 result</span><div><b>P</b><strong>{format(calculations.trueIndicationP)} {unit}</strong><b>E</b><strong>{format(calculations.rawErrorE)} {unit}</strong><b>E0</b><strong>{format(calculations.calculatedE0)} {unit}</strong><b>Ec</b><strong>{format(calculations.correctedErrorEc)} {unit}</strong><b>MPE</b><strong>±{format(calculations.mpeValue)} {unit}</strong><b>Result</b><strong className={String(calculations.complianceResult).toLowerCase()}>{calculations.complianceResult}</strong></div><small>{calculations.ruleReference} · {calculations.rangeLabel}</small></div>; }
function format(value: unknown) { return Number.isFinite(Number(value)) ? Number(value).toFixed(4) : '—'; }
