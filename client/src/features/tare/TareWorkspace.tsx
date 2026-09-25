import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Lock, Play } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import './tare.css';
import TestProcedureInfo from '../guidance/TestProcedureInfo';
import EvidencePanel from '../evidence/EvidencePanel';

const units = ['mg', 'g', 'kg', 't'];
type FormState = { tareValue: string; grossLoad: string; indicationI: string; deltaL: string; direction: 'INCREASING' | 'DECREASING'; unit: string; notes: string };
type TareSettingFormState = { tareLoad: string; indicationI0: string; deltaL: string; unit: string; notes: string };
type TareDeviceFormState = { referenceTare: string; tareDeviceIndication: string; mainIndication: string; unit: string; notes: string };
type TareConfigurationFormState = { tareType: string; maximumTareEffect: string; maximumTareUnit: string; tareOperationMode: string; tareWeighingDevicePresent: string; presetTareDevicePresent: string };
const empty: FormState = { tareValue: '', grossLoad: '', indicationI: '', deltaL: '', direction: 'INCREASING', unit: 'g', notes: '' };
const emptyTareSetting: TareSettingFormState = { tareLoad: '', indicationI0: '', deltaL: '', unit: 'g', notes: '' };
const emptyTareDevice: TareDeviceFormState = { referenceTare: '', tareDeviceIndication: '', mainIndication: '', unit: 'g', notes: '' };
const emptyTareConfiguration: TareConfigurationFormState = { tareType: '', maximumTareEffect: '', maximumTareUnit: 'g', tareOperationMode: '', tareWeighingDevicePresent: '', presetTareDevicePresent: '' };
const displayMass = (value: unknown, unit: string) => Number.isFinite(Number(value)) ? `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 6 }).format(Number(value))} ${unit}` : '—';
const unitFactors: Record<string, number> = { mg: 0.001, g: 1, kg: 1000, t: 1000000 };
const displayConvertedMass = (value: unknown, fromUnit: string, toUnit: string) => Number.isFinite(Number(value)) && unitFactors[fromUnit] && unitFactors[toUnit] ? displayMass(Number(value) * unitFactors[fromUnit] / unitFactors[toUnit], toUnit) : '—';
const humanize = (value: unknown) => typeof value === 'string' && value ? value.toLowerCase().replace(/_/g, ' ').replace(/(^|\s)\S/g, (letter: string) => letter.toUpperCase()) : '—';
const yesNo = (value: unknown) => value === true ? 'Yes' : value === false ? 'No' : '—';
const requiredNumericError = (value: string, label: string) => value.trim() === '' ? `${label} is required.` : Number.isFinite(Number(value)) ? '' : `${label} must be a valid number.`;

export default function TareWorkspace() {
  const { reportId = '' } = useParams();
  const [state, setState] = useState<any>();
  const [form, setForm] = useState<FormState>(empty);
  const [tareSettingForm, setTareSettingForm] = useState<TareSettingFormState>(emptyTareSetting);
  const [tareDeviceForm, setTareDeviceForm] = useState<TareDeviceFormState>(emptyTareDevice);
  const [tareConfigurationForm, setTareConfigurationForm] = useState<TareConfigurationFormState>(emptyTareConfiguration);
  const [savingConfiguration, setSavingConfiguration] = useState(false);
  const [editingTareObservation, setEditingTareObservation] = useState<string | null>(null);
  const [editingTareLoadObservation, setEditingTareLoadObservation] = useState<string | null>(null);
  const [editingTareDeviceObservation, setEditingTareDeviceObservation] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void axios.get(`/test-reports/${reportId}/tare`).then(response => {
      if (!active) return;
      setState(response.data);
      const unit = response.data.test?.instrumentSnapshot?.unit || response.data.report?.instrument?.unit || 'g';
      setForm(current => ({ ...current, unit }));
      setTareSettingForm(current => ({ ...current, unit }));
      setTareDeviceForm(current => ({ ...current, unit, referenceTare: current.referenceTare || String(response.data.test?.phases?.find((phase: any) => phase.code === 'A.4.6.1')?.observations?.at(-1)?.tareValue ?? '') }));
      const configuration = response.data.report?.instrument || {};
      setTareConfigurationForm({ tareType: configuration.tareType || '', maximumTareEffect: configuration.maximumTareEffect?.value == null ? '' : String(configuration.maximumTareEffect.value), maximumTareUnit: configuration.maximumTareEffect?.unit || unit, tareOperationMode: configuration.tareOperationMode || '', tareWeighingDevicePresent: configuration.tareWeighingDevicePresent == null ? '' : configuration.tareWeighingDevicePresent ? 'Yes' : 'No', presetTareDevicePresent: configuration.presetTareDevicePresent == null ? '' : configuration.presetTareDevicePresent ? 'Yes' : 'No' });
    }).catch(e => { if (active) setError(e.response?.data?.message || 'Unable to load Tare.'); });
    return () => { active = false; };
  }, [reportId]);

  const update = (key: keyof FormState, value: string) => setForm(current => ({ ...current, [key]: value }));
  const updateTareSetting = (key: keyof TareSettingFormState, value: string) => setTareSettingForm(current => ({ ...current, [key]: value }));
  const updateTareDevice = (key: keyof TareDeviceFormState, value: string) => setTareDeviceForm(current => ({ ...current, [key]: value }));
  const updateTareConfiguration = (key: keyof TareConfigurationFormState, value: string) => setTareConfigurationForm(current => ({ ...current, [key]: value }));

  const start = async () => { setError(''); try { const response = await axios.post(`/test-reports/${reportId}/tare/start`); setState((current: any) => ({ ...current, test: response.data.test })); } catch (e: any) { setError(e.response?.data?.message || 'Unable to start Tare.'); } };
  const saveTareConfiguration = async () => {
    setError('');
    if (!Number.isFinite(Number(tareConfigurationForm.maximumTareEffect)) || Number(tareConfigurationForm.maximumTareEffect) <= 0) { setError('Enter a positive maximum tare effect.'); return; }
    if (!tareConfigurationForm.tareType || !tareConfigurationForm.tareOperationMode || !['Yes', 'No'].includes(tareConfigurationForm.tareWeighingDevicePresent) || !['Yes', 'No'].includes(tareConfigurationForm.presetTareDevicePresent)) { setError('Complete each tare characteristic before saving.'); return; }
    setSavingConfiguration(true);
    try {
      const response = await axios.patch(`/test-reports/${reportId}/tare/configuration`, { tareType: tareConfigurationForm.tareType, maximumTareEffect: { value: Number(tareConfigurationForm.maximumTareEffect), unit: tareConfigurationForm.maximumTareUnit }, tareOperationMode: tareConfigurationForm.tareOperationMode, tareWeighingDevicePresent: tareConfigurationForm.tareWeighingDevicePresent === 'Yes', presetTareDevicePresent: tareConfigurationForm.presetTareDevicePresent === 'Yes' });
      setState((current: any) => ({ ...current, report: response.data.report, applicability: response.data.applicability }));
    } catch (e: any) { setError(e.response?.data?.message || 'Unable to save the report tare configuration.'); }
    finally { setSavingConfiguration(false); }
  };
  const submitObservation = async (complete = false) => { setError(''); const errors = { tareValue: requiredNumericError(form.tareValue, 'Tare value used'), grossLoad: requiredNumericError(form.grossLoad, 'Gross load'), indicationI: requiredNumericError(form.indicationI, 'Indication I'), deltaL: requiredNumericError(form.deltaL, 'ΔL') }; if (Object.values(errors).some(Boolean)) { setError('Complete all required numeric observation fields before recording.'); return; } try { const payload = { unit: form.unit, observation: { tareValue: Number(form.tareValue), grossLoad: Number(form.grossLoad), indicationI: Number(form.indicationI), deltaL: Number(form.deltaL), direction: form.direction, notes: form.notes }, complete: editingTareLoadObservation ? false : complete }; const endpoint = editingTareLoadObservation ? `/test-reports/${reportId}/tare/phases/A.4.6.1/observations/${encodeURIComponent(editingTareLoadObservation)}` : `/test-reports/${reportId}/tare/phases/A.4.6.1`; const response = await axios.patch(endpoint, payload); setState((current: any) => ({ ...current, test: response.data.test })); setForm(current => ({ ...empty, unit: current.unit })); setEditingTareLoadObservation(null); } catch (e: any) { setError(e.response?.data?.message || 'Unable to save tare observation.'); } };
  const submitAccuracy = async (complete = false) => {
    setError('');
    const errors = { tareLoad: requiredNumericError(tareSettingForm.tareLoad, 'Tare load'), indicationI0: requiredNumericError(tareSettingForm.indicationI0, 'Indication I₀'), deltaL: requiredNumericError(tareSettingForm.deltaL, 'ΔL') };
    if (Object.values(errors).some(Boolean)) { setError('Complete all required A.4.6.2 numeric fields before recording.'); return; }
    try {
      const endpoint = editingTareObservation ? `/test-reports/${reportId}/tare/phases/A.4.6.2/observations/${encodeURIComponent(editingTareObservation)}` : `/test-reports/${reportId}/tare/phases/A.4.6.2`;
      const response = await axios.patch(endpoint, { unit: tareSettingForm.unit, observation: { tareLoad: Number(tareSettingForm.tareLoad), indicationI0: Number(tareSettingForm.indicationI0), deltaL: Number(tareSettingForm.deltaL), notes: tareSettingForm.notes }, complete: editingTareObservation ? false : complete });
      setState((current: any) => ({ ...current, test: response.data.test }));
      setEditingTareObservation(null);
      setTareSettingForm(current => ({ ...emptyTareSetting, unit: current.unit }));
    } catch (e: any) { setError(e.response?.data?.message || 'Unable to save tare-setting accuracy.'); }
  };

  const observationIdentity = (observation: any) => String(observation.observationId || `legacy:${observation.recordedAt || ''}:${observation.sequence ?? ''}`);
  const editAccuracyObservation = (observation: any) => {
    const unit = observation.unit || state?.test?.instrumentSnapshot?.unit || state?.report?.instrument?.unit || 'g';
    setEditingTareObservation(observationIdentity(observation));
    setTareSettingForm({ tareLoad: String(observation.inputTareLoad ?? observation.tareLoad ?? ''), indicationI0: String(observation.inputIndicationI0 ?? observation.indicationI0 ?? ''), deltaL: String(observation.inputDeltaL ?? observation.deltaL ?? ''), unit, notes: observation.notes || '' });
    setError('');
  };
  const cancelAccuracyEdit = () => { setEditingTareObservation(null); setTareSettingForm(current => ({ ...emptyTareSetting, unit: current.unit })); setError(''); };
  const editTareLoad = (observation: any) => { const unit = observation.unit || state?.test?.instrumentSnapshot?.unit || state?.report?.instrument?.unit || 'g'; setEditingTareLoadObservation(observationIdentity(observation)); setForm({ tareValue: String(observation.inputTareValue ?? observation.tareValue ?? ''), grossLoad: String(observation.inputGrossLoad ?? observation.grossLoad ?? ''), indicationI: String(observation.inputIndicationI ?? observation.indicationI ?? ''), deltaL: String(observation.inputDeltaL ?? observation.deltaL ?? ''), direction: observation.direction || 'INCREASING', unit, notes: observation.notes || '' }); setError(''); };
  const cancelTareLoadEdit = () => { setEditingTareLoadObservation(null); setForm(current => ({ ...empty, unit: current.unit })); setError(''); };
  const deleteTareLoad = async (observation: any, displayIndex: number) => { if (!window.confirm(`Delete Observation ${displayIndex + 1}?\n\nDeleting this observation will remove it from the current A.4.6.1 test results. You can record a new observation before completing the test.`)) return; setError(''); try { const response = await axios.delete(`/test-reports/${reportId}/tare/phases/A.4.6.1/observations/${encodeURIComponent(observationIdentity(observation))}`); setState((current: any) => ({ ...current, test: response.data.test })); if (editingTareLoadObservation === observationIdentity(observation)) cancelTareLoadEdit(); } catch (e: any) { setError(e.response?.data?.message || 'Unable to delete tare observation.'); } };
  const deleteAccuracyObservation = async (observation: any, displayIndex: number) => {
    if (!window.confirm(`Delete Observation ${displayIndex + 1}?\n\nDeleting this observation will remove it from the current A.4.6.2 test results. You can record a new observation before completing the test.`)) return;
    setError('');
    try {
      const response = await axios.delete(`/test-reports/${reportId}/tare/phases/A.4.6.2/observations/${encodeURIComponent(observationIdentity(observation))}`);
      setState((current: any) => ({ ...current, test: response.data.test }));
      if (editingTareObservation === observationIdentity(observation)) cancelAccuracyEdit();
    } catch (e: any) { setError(e.response?.data?.message || 'Unable to delete tare-setting observation.'); }
  };
  const submitTareDevice = async () => {
    setError('');
    const errors = { referenceTare: requiredNumericError(tareDeviceForm.referenceTare, 'Reference tare'), tareDeviceIndication: requiredNumericError(tareDeviceForm.tareDeviceIndication, 'Tare-weighing-device indication'), mainIndication: requiredNumericError(tareDeviceForm.mainIndication, 'Main indicating-device indication') };
    if (Object.values(errors).some(Boolean)) { setError('Complete all required A.4.6.3 numeric fields before recording.'); return; }
    try {
      const endpoint = editingTareDeviceObservation ? `/test-reports/${reportId}/tare/phases/A.4.6.3/observations/${encodeURIComponent(editingTareDeviceObservation)}` : `/test-reports/${reportId}/tare/phases/A.4.6.3`;
      const response = await axios.patch(endpoint, { unit: tareDeviceForm.unit, observation: { referenceTare: Number(tareDeviceForm.referenceTare), tareDeviceIndication: Number(tareDeviceForm.tareDeviceIndication), mainIndication: Number(tareDeviceForm.mainIndication), notes: tareDeviceForm.notes }, complete: false });
      setState((current: any) => ({ ...current, test: response.data.test }));
      setEditingTareDeviceObservation(null);
      setTareDeviceForm(current => ({ ...emptyTareDevice, unit: current.unit }));
    } catch (e: any) { setError(e.response?.data?.message || 'Unable to save tare-device comparison.'); }
  };
  const completeTareDevice = async () => {
    setError('');
    const phase = state?.test?.phases?.find((item: any) => item.code === 'A.4.6.3');
    if ((phase?.observations?.length || 0) !== 1) { setError('Record exactly one valid A.4.6.3 comparison observation before completing the test.'); return; }
    try {
      const response = await axios.patch(`/test-reports/${reportId}/tare/phases/A.4.6.3`, { complete: true });
      setState((current: any) => ({ ...current, test: response.data.test }));
    } catch (e: any) { setError(e.response?.data?.message || 'Unable to complete tare-device comparison.'); }
  };
  const completeTareSetting = async () => {
    setError('');
    try {
      const response = await axios.patch(`/test-reports/${reportId}/tare/phases/A.4.6.2`, { complete: true });
      setState((current: any) => ({ ...current, test: response.data.test }));
    } catch (e: any) { setError(e.response?.data?.message || 'Unable to complete tare-setting accuracy.'); }
  };
  const editTareDeviceObservation = (observation: any) => {
    const unit = observation.unit || state?.test?.instrumentSnapshot?.unit || state?.report?.instrument?.unit || 'g';
    setEditingTareDeviceObservation(observationIdentity(observation));
    setTareDeviceForm({ referenceTare: String(observation.inputReferenceTare ?? observation.referenceTare ?? ''), tareDeviceIndication: String(observation.inputTareDeviceIndication ?? observation.tareDeviceIndication ?? ''), mainIndication: String(observation.inputMainIndication ?? observation.mainIndication ?? ''), unit, notes: observation.notes || '' });
    setError('');
  };
  const cancelTareDeviceEdit = () => { setEditingTareDeviceObservation(null); setTareDeviceForm(current => ({ ...emptyTareDevice, unit: current.unit })); setError(''); };
  const deleteTareDeviceObservation = async (observation: any, displayIndex: number) => {
    if (!window.confirm(`Delete Observation ${displayIndex + 1}?\n\nDeleting this comparison will remove it from the current A.4.6.3 test results.`)) return;
    setError('');
    try {
      const response = await axios.delete(`/test-reports/${reportId}/tare/phases/A.4.6.3/observations/${encodeURIComponent(observationIdentity(observation))}`);
      setState((current: any) => ({ ...current, test: response.data.test }));
      if (editingTareDeviceObservation === observationIdentity(observation)) cancelTareDeviceEdit();
    } catch (e: any) { setError(e.response?.data?.message || 'Unable to delete tare-device comparison.'); }
  };

  if (!state) return <main className="tare-page"><div className="tare-loading">{error || 'Loading Tare…'}</div></main>;
  const test = state.test;
  const instrument = state.report?.instrument || {};
  const instrumentUnit = test?.instrumentSnapshot?.unit || instrument.unit || 'g';
  const configurationSource = test?.tareConfigurationSnapshot || instrument;
  const maximumTareEffect = configurationSource.maximumTareEffect;
  const maximumTareValue = Number(maximumTareEffect?.value);
  const tareRange = configurationSource.tareType === 'SUBTRACTIVE' && Number.isFinite(maximumTareValue) && maximumTareValue > 0 ? { min: maximumTareValue / 3, max: (maximumTareValue * 2) / 3, midpoint: maximumTareValue / 2, unit: maximumTareEffect?.unit || instrumentUnit } : null;
  const configurationRequired = !test && state.applicability?.status === 'REQUIRES_CONFIGURATION';
  const configurationReady = state.applicability?.status === 'APPLICABLE';
  const blocked = configurationReady && state.prerequisitesComplete === false;
  const missingPrerequisites = state.missingPrerequisites || [];
  const revalidationRequired = test?.status === 'REVALIDATION_REQUIRED' || state.stale === true;
  const a461Errors = { tareValue: requiredNumericError(form.tareValue, 'Tare value used'), grossLoad: requiredNumericError(form.grossLoad, 'Gross load'), indicationI: requiredNumericError(form.indicationI, 'Indication I'), deltaL: requiredNumericError(form.deltaL, 'ΔL') };
  const a461Ready = Object.values(a461Errors).every(errorMessage => !errorMessage);
  const tareSettingProcedure = test?.tareSettingProcedure;
  const a462Phase = test?.phases?.find((phase: any) => phase.code === 'A.4.6.2');
  const a462Completion = a462Phase?.completion;
  const a462RequiredRepetitions = Number(a462Completion?.requiredRepetitions || tareSettingProcedure?.repetitions || 5);
  const a462CanAddObservation = Number(a462Completion?.validRepetitions || 0) < a462RequiredRepetitions;
  const a462Errors = { tareLoad: requiredNumericError(tareSettingForm.tareLoad, 'Tare load'), indicationI0: requiredNumericError(tareSettingForm.indicationI0, 'Indication I₀'), deltaL: requiredNumericError(tareSettingForm.deltaL, 'ΔL') };
  const a462Ready = Object.values(a462Errors).every(errorMessage => !errorMessage);
  const a463Phase = test?.phases?.find((phase: any) => phase.code === 'A.4.6.3');
  const a463ObservationCount = Number(a463Phase?.observations?.length || 0);
  const a463Editable = a463Phase && a463Phase.applicability === 'APPLICABLE' && a463Phase.status !== 'COMPLETED' && a463Phase.status !== 'LOCKED';
  const a463Errors = { referenceTare: requiredNumericError(tareDeviceForm.referenceTare, 'Reference tare'), tareDeviceIndication: requiredNumericError(tareDeviceForm.tareDeviceIndication, 'Tare-weighing-device indication'), mainIndication: requiredNumericError(tareDeviceForm.mainIndication, 'Main indicating-device indication') };
  const a463Ready = Object.values(a463Errors).every(errorMessage => !errorMessage);
  const statusLabel = revalidationRequired ? 'REVALIDATION REQUIRED' : test?.status === 'IN_PROGRESS' ? 'IN PROGRESS' : test?.result || (configurationRequired ? 'CONFIGURATION REQUIRED' : blocked ? 'BLOCKED' : configurationReady ? 'READY' : 'NOT APPLICABLE');

  return <main className="tare-page">
    <header className="tare-header"><Link to={`/tester/reports/${reportId}/testing`}><ArrowLeft size={16} /> Test route</Link><span>OIML R 76-1:2006 · A.4.6</span></header>
    <section className="tare-content"><div className="tare-title"><div><span className="technical-label">TESTING · TARE</span><h1>Tare</h1><p>Review the report configuration before recording observations. Net-load MPE is determined from the actual evaluated net load.</p></div><span className="tare-status">{statusLabel}</span></div>
      {error && <div className="tare-error">{error}</div>}
      {state.retestRequest?.targetPhaseCode && <aside className="tare-retest-notice" role="status"><strong>Retest requested · {state.retestRequest.targetPhaseCode}</strong><p>{state.retestRequest.reason}</p>{state.retestRequest.instructions && <p>{state.retestRequest.instructions}</p>}<small>Only this phase is reopened. Previously completed tare phases and their recorded observations remain preserved.</small></aside>}
      {!test && state.applicability?.status === 'NOT_APPLICABLE' && <section className="tare-start"><h2>A.4.6 Tare</h2><p>{state.applicability.reason}</p></section>}
      {!test && state.applicability?.status !== 'NOT_APPLICABLE' && <>
        <section className="tare-configuration"><div><span className="technical-label">FROM INSTRUMENT CONFIGURATION</span><h2>Tare Configuration</h2><p>{configurationRequired ? 'Complete the tare characteristics in the instrument/report configuration before starting this test.' : 'These characteristics are inherited from the selected instrument/report configuration.'}</p></div>
          <dl className="tare-config-summary">
            <div><dt>Tare type</dt><dd>{humanize(configurationSource.tareType)}</dd></div>
            <div><dt>Maximum tare effect</dt><dd>{displayMass(maximumTareEffect?.value, maximumTareEffect?.unit || instrumentUnit)}</dd></div>
            <div><dt>Tare operation</dt><dd>{humanize(configurationSource.tareOperationMode)}</dd></div>
            <div><dt>Tare weighing device</dt><dd>{yesNo(configurationSource.tareWeighingDevicePresent)}</dd></div>
            <div><dt>Preset tare device</dt><dd>{yesNo(configurationSource.presetTareDevicePresent)}</dd></div>
          </dl>
          {blocked && <div className="tare-dependency-warning">{missingPrerequisites.length ? `Complete ${missingPrerequisites.map((item: any) => item.code).join(', ')} before starting Tare.` : 'Complete the preceding applicable tests before starting Tare.'}</div>}
          {configurationRequired && <div className="tare-config-edit"><span className="technical-label">REPORT CONFIGURATION</span><h3>Complete tare characteristics</h3><p>Saved to this active report only. Existing instrument records and other reports are unchanged.</p><div className="tare-config-form"><label>Tare type<select value={tareConfigurationForm.tareType} onChange={event => updateTareConfiguration('tareType', event.target.value)}><option value="">Select type</option><option value="SUBTRACTIVE">Subtractive</option><option value="ADDITIVE">Additive</option></select></label><label>Maximum tare effect<input type="number" min="0" step="any" value={tareConfigurationForm.maximumTareEffect} onChange={event => updateTareConfiguration('maximumTareEffect', event.target.value)} /></label><label>Unit<select value={tareConfigurationForm.maximumTareUnit} onChange={event => updateTareConfiguration('maximumTareUnit', event.target.value)}>{units.map(unit => <option key={unit}>{unit}</option>)}</select></label><label>Tare operation mode<select value={tareConfigurationForm.tareOperationMode} onChange={event => updateTareConfiguration('tareOperationMode', event.target.value)}><option value="">Select mode</option><option value="NON_AUTOMATIC">Non-automatic</option><option value="SEMI_AUTOMATIC">Semi-automatic</option><option value="AUTOMATIC">Automatic</option></select></label><label>Tare weighing device<select value={tareConfigurationForm.tareWeighingDevicePresent} onChange={event => updateTareConfiguration('tareWeighingDevicePresent', event.target.value)}><option value="">Select</option><option>Yes</option><option>No</option></select></label><label>Preset tare device<select value={tareConfigurationForm.presetTareDevicePresent} onChange={event => updateTareConfiguration('presetTareDevicePresent', event.target.value)}><option value="">Select</option><option>Yes</option><option>No</option></select></label></div><small className="tare-field-hint">Use the prototype profile’s intended configuration. Do not enter a value inconsistent with the instrument’s declared Max or tare capability.</small><div className="tare-config-actions"><button className="route-primary" onClick={() => void saveTareConfiguration()} disabled={savingConfiguration}>{savingConfiguration ? 'Saving…' : 'Save report configuration'}</button></div></div>}
          {!configurationRequired && <div className="tare-config-actions"><button className="route-secondary" onClick={start} disabled={!configurationReady || blocked}><Play size={15} /> Start Test</button></div>}
        </section>
      </>}
      {test && revalidationRequired && <section className="tare-start tare-revalidation"><h2>Revalidation required</h2><p>The tare configuration or its A.4.2 source evidence changed after execution began. Existing observations are preserved; the test must be revalidated before it can contribute to the route.</p></section>}
      {test && !revalidationRequired && <>
        <section className="tare-plan"><div><span className="technical-label">RECOMMENDED PLAN</span><h2>Net-load points</h2><p>Guidance only. Recommended values are not observations and are never copied into actual fields.</p><div className="tare-plan-summary"><span><small>Minimum required</small><strong>{test.phases.find((phase: any) => phase.code === 'A.4.6.1')?.completion?.minimumRequired || 5} valid load steps</strong></span><span><small>System recommendation</small><strong>{test.loadPlan.length} suggested load steps</strong></span><span><small>Actual observations</small><strong>{test.phases.find((phase: any) => phase.code === 'A.4.6.1')?.completion?.validObservationCount || 0} / {test.phases.find((phase: any) => phase.code === 'A.4.6.1')?.completion?.minimumRequired || 5} minimum</strong></span></div></div><div className="tare-plan-grid">{test.loadPlan.map((item: any) => <div key={`${item.sequence}-${item.representativeTare}`}><b>{displayMass(item.recommendedNetLoad, instrumentUnit)}</b><small>{item.direction} · tare {displayMass(item.representativeTare, instrumentUnit)}</small></div>)}</div></section>
        <section className="tare-phases">{test.phases.map((item: any, index: number) => { const completion = item.code === 'A.4.6.1' ? item.completion : null; const a461Locked = item.code === 'A.4.6.1' && item.status === 'LOCKED'; const derivedInProgress = item.code === 'A.4.6.1' && !a461Locked && item.status !== 'COMPLETED' && Number(completion?.validObservationCount) > 0; const editable = !a461Locked && item.status !== 'COMPLETED' && (item.status === 'AVAILABLE' || item.status === 'IN_PROGRESS' || derivedInProgress); const phaseStatus = a461Locked ? 'COMPLETED · LOCKED' : derivedInProgress ? 'IN PROGRESS' : item.status === 'LOCKED' && item.applicability === 'APPLICABLE' ? 'WORKFLOW LOCKED' : item.status; return <article className={`tare-phase ${item.status === 'COMPLETED' ? 'completed' : editable ? 'available' : 'locked'}`} key={item.code}>
          <div className="tare-phase-marker">{item.status === 'COMPLETED' ? <Check size={17} /> : item.status === 'LOCKED' ? <Lock size={15} /> : index + 1}</div>
          <div className="tare-phase-body"><div className="tare-phase-heading"><div><span>{item.code}</span><h2>{item.name}</h2></div><strong>{phaseStatus}</strong></div><p>{item.reason}</p>{item.workflowNote && <small className="tare-workflow-note">{item.workflowNote}</small>}
            {item.code === 'A.4.6.1' && editable && <div className="tare-form"><label>Tare value used ({form.unit})<input aria-invalid={Boolean(a461Errors.tareValue)} value={form.tareValue} onChange={event => update('tareValue', event.target.value)} type="number" min="0" />{a461Errors.tareValue && <small className="tare-field-error">{a461Errors.tareValue}</small>}{tareRange && <small className="tare-field-hint">Subtractive tare range: {displayMass(tareRange.min, tareRange.unit)}–{displayMass(tareRange.max, tareRange.unit)}. Suggested value: {displayMass(tareRange.midpoint, tareRange.unit)}.</small>}</label><label>Gross load ({form.unit})<input aria-invalid={Boolean(a461Errors.grossLoad)} value={form.grossLoad} onChange={event => update('grossLoad', event.target.value)} type="number" min="0" />{a461Errors.grossLoad && <small className="tare-field-error">{a461Errors.grossLoad}</small>}</label><label>Indication I ({form.unit})<input aria-invalid={Boolean(a461Errors.indicationI)} value={form.indicationI} onChange={event => update('indicationI', event.target.value)} type="number" />{a461Errors.indicationI && <small className="tare-field-error">{a461Errors.indicationI}</small>}</label><label>ΔL ({form.unit})<input aria-invalid={Boolean(a461Errors.deltaL)} value={form.deltaL} onChange={event => update('deltaL', event.target.value)} type="number" min="0" />{a461Errors.deltaL && <small className="tare-field-error">{a461Errors.deltaL}</small>}</label><label>Direction<select value={form.direction} onChange={event => update('direction', event.target.value as FormState['direction'])}><option value="INCREASING">INCREASING</option><option value="DECREASING">DECREASING</option></select></label><label className="tare-form-wide">Notes<textarea value={form.notes} onChange={event => update('notes', event.target.value)} /></label><div>{editingTareLoadObservation ? <><button className="route-primary" disabled={!a461Ready} onClick={() => void submitObservation(false)}>Save changes</button><button className="route-secondary" onClick={cancelTareLoadEdit}>Cancel edit</button></> : <><button className="route-primary" disabled={!a461Ready} onClick={() => void submitObservation(false)}>Record observation</button><button className="route-secondary" disabled={!a461Ready} onClick={() => void submitObservation(true)}>Record &amp; complete</button></>}</div></div>}
            {item.code === 'A.4.6.1' && completion && <div className="tare-coverage-summary"><span>Valid observations <b>{completion.validObservationCount} / {completion.minimumRequired} minimum</b></span><span>{completion.coverageComplete ? 'Required load coverage satisfied' : `Coverage remaining: ${completion.missingRequirements.map((requirement: any) => requirement.label).join(', ')}`}</span></div>}
            {item.code === 'A.4.6.2' && editable && (a462CanAddObservation || editingTareObservation) && <>
              <div className="tare-procedure-summary"><span><small>Recommended tare load</small><strong>{displayConvertedMass(tareSettingProcedure?.recommendedTareLoad, instrumentUnit, tareSettingForm.unit)}</strong><em>about 30% of Max</em></span><span><small>Procedural load L₀</small><strong>{displayConvertedMass(tareSettingProcedure?.loadL0, instrumentUnit, tareSettingForm.unit)}</strong><em>{tareSettingProcedure?.loadL0IsApplied ? '10e while automatic zero/zero-tracking is active' : 'Not applied for this configuration'}</em></span><span><small>Accuracy limit</small><strong>{displayConvertedMass(tareSettingProcedure?.accuracyLimit, instrumentUnit, tareSettingForm.unit)}</strong><em>|E₀| ≤ 0.25e</em></span><span><small>Repetitions</small><strong>{a462Completion?.validRepetitions || 0} / {tareSettingProcedure?.repetitions || 5}</strong><em>required</em></span></div>
              <div className="tare-form"><label>Observation unit<select value={tareSettingForm.unit} onChange={event => updateTareSetting('unit', event.target.value)}>{units.map(unit => <option key={unit}>{unit}</option>)}</select></label><label>Tare load ({tareSettingForm.unit})<input aria-invalid={Boolean(a462Errors.tareLoad)} value={tareSettingForm.tareLoad} onChange={event => updateTareSetting('tareLoad', event.target.value)} type="number" min="0" />{a462Errors.tareLoad && <small className="tare-field-error">{a462Errors.tareLoad}</small>}</label><label>Load L₀ ({tareSettingForm.unit})<input value={displayConvertedMass(tareSettingProcedure?.loadL0, instrumentUnit, tareSettingForm.unit).replace(` ${tareSettingForm.unit}`, '')} readOnly aria-label={`Procedural load L₀ (${tareSettingForm.unit})`} /><small className="tare-field-hint">Calculated procedural value; enter the actual indication after tare balancing.</small></label><label>Indication I₀ ({tareSettingForm.unit})<input aria-invalid={Boolean(a462Errors.indicationI0)} value={tareSettingForm.indicationI0} onChange={event => updateTareSetting('indicationI0', event.target.value)} type="number" />{a462Errors.indicationI0 && <small className="tare-field-error">{a462Errors.indicationI0}</small>}</label><label>ΔL ({tareSettingForm.unit})<input aria-invalid={Boolean(a462Errors.deltaL)} value={tareSettingForm.deltaL} onChange={event => updateTareSetting('deltaL', event.target.value)} type="number" min="0" />{a462Errors.deltaL && <small className="tare-field-error">{a462Errors.deltaL}</small>}</label><label className="tare-form-wide">Notes<textarea value={tareSettingForm.notes} onChange={event => updateTareSetting('notes', event.target.value)} /></label><div>{editingTareObservation ? <><button className="route-primary" disabled={!a462Ready} onClick={() => void submitAccuracy(false)}>Save changes</button><button className="route-secondary" onClick={cancelAccuracyEdit}>Cancel edit</button></> : <><button className="route-primary" disabled={!a462Ready} onClick={() => void submitAccuracy(false)}>Record observation</button><button className="route-secondary" disabled={!a462Ready} onClick={() => void submitAccuracy(true)}>Record &amp; complete</button></>}</div></div>
            </>}
            {item.code === 'A.4.6.2' && editable && !a462CanAddObservation && !editingTareObservation && <p className="tare-workflow-note">The required {a462RequiredRepetitions} valid repetitions are recorded. Edit or delete an existing repetition before recording a replacement.</p>}
            {item.code === 'A.4.6.2' && a462Completion && <div className="tare-coverage-summary"><span>Valid repetitions <b>{a462Completion.validRepetitions} / {a462Completion.requiredRepetitions}</b></span><span>{a462Completion.complete ? `Result ${a462Completion.result}` : a462Completion.reason}</span></div>}
            {item.code === 'A.4.6.2' && item.status === 'IN_PROGRESS' && a462Completion?.complete && !editingTareObservation && <div className="tare-form"><button className="route-primary" onClick={() => void completeTareSetting()}>Complete tare-setting test</button><small className="tare-field-hint">All required repetitions are saved. Complete the phase to advance the tare workflow.</small></div>}
            {item.code === 'A.4.6.3' && item.applicability === 'APPLICABLE' && editable && (a463ObservationCount === 0 || editingTareDeviceObservation) && <>
              <p className="tare-workflow-note">Compare the result of the tare-weighing device with the result of the main indicating device for the same tare load.</p>
              <div className="tare-form"><label>Observation unit<select value={tareDeviceForm.unit} onChange={event => updateTareDevice('unit', event.target.value)}>{units.map(unit => <option key={unit}>{unit}</option>)}</select></label><label>Reference tare ({tareDeviceForm.unit})<input aria-invalid={Boolean(a463Errors.referenceTare)} value={tareDeviceForm.referenceTare} onChange={event => updateTareDevice('referenceTare', event.target.value)} type="number" min="0" />{a463Errors.referenceTare && <small className="tare-field-error">{a463Errors.referenceTare}</small>}{tareDeviceForm.referenceTare && <small className="tare-field-hint">Prefilled from a completed A.4.6.1 tare observation; confirm or correct the actual comparison load.</small>}</label><label>Tare-weighing-device result ({tareDeviceForm.unit})<input aria-invalid={Boolean(a463Errors.tareDeviceIndication)} value={tareDeviceForm.tareDeviceIndication} onChange={event => updateTareDevice('tareDeviceIndication', event.target.value)} type="number" />{a463Errors.tareDeviceIndication && <small className="tare-field-error">{a463Errors.tareDeviceIndication}</small>}</label><label>Main indicating-device result ({tareDeviceForm.unit})<input aria-invalid={Boolean(a463Errors.mainIndication)} value={tareDeviceForm.mainIndication} onChange={event => updateTareDevice('mainIndication', event.target.value)} type="number" />{a463Errors.mainIndication && <small className="tare-field-error">{a463Errors.mainIndication}</small>}</label><label className="tare-form-wide">Notes<textarea value={tareDeviceForm.notes} onChange={event => updateTareDevice('notes', event.target.value)} /></label><div>{editingTareDeviceObservation ? <><button className="route-primary" disabled={!a463Ready} onClick={() => void submitTareDevice()}>Save changes</button><button className="route-secondary" onClick={cancelTareDeviceEdit}>Cancel edit</button></> : <button className="route-primary" disabled={!a463Ready} onClick={() => void submitTareDevice()}>Record observation</button>}</div></div>
            </>}
            {item.code === 'A.4.6.3' && item.applicability === 'APPLICABLE' && editable && a463ObservationCount === 1 && !editingTareDeviceObservation && <div className="tare-form"><button className="route-primary" onClick={() => void completeTareDevice()}>Record &amp; complete</button><small className="tare-field-hint">One comparison observation is saved. Complete the test explicitly when you are satisfied with the result.</small></div>}
            {item.observations?.length > 0 && (
              <div className="tare-observations">
                {item.observations.map((observation: any, observationIndex: number) => (
                  <div className="tare-observation" key={`${observation.recordedAt || observation.sequence}-${observationIndex}`}>
                    <strong>Observation {observationIndex + 1}</strong>
                    {item.code === 'A.4.6.2' ? (
                      <>
                        <span>Tare load {displayMass(observation.tareLoad, observation.unit || instrumentUnit)} · L₀ {displayMass(observation.loadL0, instrumentUnit)} · I₀ {displayMass(observation.indicationI0, observation.unit || instrumentUnit)}</span>
                        <span>ΔL {displayMass(observation.deltaL, observation.unit || instrumentUnit)} · E₀ {displayMass(observation.errorE0, instrumentUnit)} · limit {displayMass(observation.accuracyLimit, instrumentUnit)}</span>
                        <span>{observation.result || 'recorded'}</span>
                        {item.status === 'IN_PROGRESS' && <div className="tare-observation-actions"><button className="route-secondary" onClick={() => editAccuracyObservation(observation)}>Edit</button><button className="route-secondary tare-danger-action" onClick={() => void deleteAccuracyObservation(observation, observationIndex)}>Delete</button></div>}
                      </>
                    ) : item.code === 'A.4.6.3' ? (
                      <>
                        <span>Reference tare {displayMass(observation.referenceTare, observation.unit || instrumentUnit)} · tare device {displayMass(observation.tareDeviceIndication, observation.unit || instrumentUnit)}</span>
                        <span>Main indication {displayMass(observation.mainIndication, observation.unit || instrumentUnit)} · difference {displayMass(observation.difference, observation.comparisonCriterionUnit || instrumentUnit)}</span>
                        <span>Applicable comparison criterion (MPE-derived) {displayMass(observation.comparisonCriterion, observation.comparisonCriterionUnit || instrumentUnit)} · {observation.result || 'recorded'}</span>
                        {item.status === 'IN_PROGRESS' && <div className="tare-observation-actions"><button className="route-secondary" onClick={() => editTareDeviceObservation(observation)}>Edit</button><button className="route-secondary tare-danger-action" onClick={() => void deleteTareDeviceObservation(observation, observationIndex)}>Delete</button></div>}
                      </>
                    ) : (
                      <>
                        <span>Gross {displayMass(observation.grossLoad, instrumentUnit)} · tare {displayMass(observation.tareValue, instrumentUnit)} · net {displayMass(observation.netLoad, instrumentUnit)}</span>
                        <span>P {displayMass(observation.trueIndicationP, instrumentUnit)} · E {displayMass(observation.rawErrorE, instrumentUnit)} · E<sub>c</sub> {displayMass(observation.correctedErrorEc, instrumentUnit)}</span>
                        <span>MPE {displayMass(observation.mpeValue, observation.mpeUnit || instrumentUnit)} · {observation.complianceResult || 'recorded'}</span>
                        {item.code === 'A.4.6.1' && editable && <div className="tare-observation-actions"><button className="route-secondary" onClick={() => editTareLoad(observation)}>Edit</button><button className="route-secondary tare-danger-action" onClick={() => void deleteTareLoad(observation, observationIndex)}>Delete</button></div>}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
            {item.calculations && <div className="tare-calculation-summary">{item.code === 'A.4.6.2' ? <><span>Last E₀ <b>{displayMass(item.calculations.lastErrorE0, instrumentUnit)}</b></span><span>Tare-setting accuracy limit <b>{displayMass(item.calculations.accuracyLimit, instrumentUnit)}</b></span><span>Repetitions <b>{item.calculations.completion?.validRepetitions || item.observations?.length || 0} / {item.calculations.procedure?.repetitions || 5}</b></span><span>Result <b>{item.calculations.completion?.result || item.calculations.result}</b></span></> : item.code === 'A.4.6.3' ? <><span>Difference <b>{displayMass(item.calculations.lastDifference, item.calculations.comparisonCriterionUnit || instrumentUnit)}</b></span><span>Applicable comparison criterion (MPE-derived) <b>{displayMass(item.calculations.comparisonCriterion, item.calculations.comparisonCriterionUnit || instrumentUnit)}</b></span><span>Observations <b>{item.calculations.observationCount || item.observations?.length || 0}</b></span><span>Result <b>{item.calculations.result}</b></span></> : <><span>P <b>{displayMass(item.calculations.trueIndicationP, instrumentUnit)}</b></span><span>E <b>{displayMass(item.calculations.rawErrorE, instrumentUnit)}</b></span><span>E<sub>c</sub> <b>{displayMass(item.calculations.correctedErrorEc, instrumentUnit)}</b></span><span>Tare-setting accuracy limit <b>{displayMass(item.calculations.accuracyLimit, instrumentUnit)}</b></span><span>Result <b>{item.calculations.result}</b></span></>}</div>}
          </div></article>; })}</section>
        {test.status === 'COMPLETED' && <div className="tare-complete"><Check size={18} /> A.4.6 Tare completed with result {test.result}.</div>}
      </>}
      {state.applicability?.status !== 'NOT_APPLICABLE' && <TestProcedureInfo testId="A.4.6" configuration={{ ...(test?.instrumentSnapshot || instrument), tareDevice: instrument.tareDevice, tareOperationMode: configurationSource.tareOperationMode, applicabilityStatus: state.applicability?.status }} />}
      {state.applicability?.status !== 'NOT_APPLICABLE' && <EvidencePanel context={a463Phase?.applicability === 'APPLICABLE' ? { reportId, testId: 'A.4.6', subtestId: 'A.4.6.3', instrumentId: state.report?.instrumentId, category: 'TEST_SETUP', evidenceType: 'tare_device_comparison', label: 'A.4.6.3 · Tare weighing device · Comparison', title: 'Tare Weighing Device Comparison', testName: 'Tare weighing device', oimlReference: 'A.4.6.3' } : { reportId, testId: 'A.4.6', subtestId: 'A.4.6.2', instrumentId: state.report?.instrumentId, category: 'TEST_SETUP', evidenceType: 'tare_setup', label: 'A.4.6 · Tare · Test Setup', title: 'Tare Test Setup', testName: 'Tare', oimlReference: 'A.4.6' }} />}
    </section>
  </main>;
}
