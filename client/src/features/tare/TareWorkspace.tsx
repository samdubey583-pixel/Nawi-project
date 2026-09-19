import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Lock, Play, Save } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import './tare.css';
import TestProcedureInfo from '../guidance/TestProcedureInfo';

const units = ['mg', 'g', 'kg', 't'];
const tareTypes = ['SUBTRACTIVE', 'ADDITIVE'] as const;
const tareModes = ['NON_AUTOMATIC', 'SEMI_AUTOMATIC', 'AUTOMATIC'] as const;
type FormState = { tareValue: string; grossLoad: string; indicationI: string; deltaL: string; direction: 'INCREASING' | 'DECREASING'; unit: string; notes: string };
type TareConfiguration = { tareType: '' | typeof tareTypes[number]; maximumTareEffect: string; maximumTareEffectUnit: string; tareOperationMode: '' | typeof tareModes[number]; tareWeighingDevicePresent: '' | 'Yes' | 'No'; presetTareDevicePresent: '' | 'Yes' | 'No' };
const empty: FormState = { tareValue: '', grossLoad: '', indicationI: '', deltaL: '', direction: 'INCREASING', unit: 'g', notes: '' };
const emptyConfiguration: TareConfiguration = { tareType: '', maximumTareEffect: '', maximumTareEffectUnit: '', tareOperationMode: '', tareWeighingDevicePresent: '', presetTareDevicePresent: '' };
const displayMass = (value: unknown, unit: string) => Number.isFinite(Number(value)) ? `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 6 }).format(Number(value))} ${unit}` : '—';

function configurationFromState(state: any): TareConfiguration {
  const instrument = state?.report?.instrument || {};
  const maximumTareEffect = instrument.maximumTareEffect;
  return {
    tareType: tareTypes.includes(instrument.tareType) ? instrument.tareType : '',
    maximumTareEffect: Number.isFinite(Number(maximumTareEffect?.value)) ? String(maximumTareEffect.value) : '',
    maximumTareEffectUnit: typeof maximumTareEffect?.unit === 'string' ? maximumTareEffect.unit : '',
    tareOperationMode: tareModes.includes(instrument.tareOperationMode) ? instrument.tareOperationMode : '',
    tareWeighingDevicePresent: instrument.tareWeighingDevicePresent === true ? 'Yes' : instrument.tareWeighingDevicePresent === false ? 'No' : '',
    presetTareDevicePresent: instrument.presetTareDevicePresent === true ? 'Yes' : instrument.presetTareDevicePresent === false ? 'No' : '',
  };
}

export default function TareWorkspace() {
  const { reportId = '' } = useParams();
  const [state, setState] = useState<any>();
  const [form, setForm] = useState<FormState>(empty);
  const [configuration, setConfiguration] = useState<TareConfiguration>(emptyConfiguration);
  const [error, setError] = useState('');
  const [savingConfiguration, setSavingConfiguration] = useState(false);

  useEffect(() => {
    let active = true;
    void axios.get(`/test-reports/${reportId}/tare`).then(response => {
      if (!active) return;
      setState(response.data);
      setConfiguration(configurationFromState(response.data));
      const unit = response.data.test?.instrumentSnapshot?.unit || response.data.report?.instrument?.unit || 'g';
      setForm(current => ({ ...current, unit }));
    }).catch(e => { if (active) setError(e.response?.data?.message || 'Unable to load Tare.'); });
    return () => { active = false; };
  }, [reportId]);

  const update = (key: keyof FormState, value: string) => setForm(current => ({ ...current, [key]: value }));
  const updateConfiguration = (key: keyof TareConfiguration, value: string) => setConfiguration(current => ({ ...current, [key]: value }));
  const configurationErrors = useMemo(() => {
    const errors: Partial<Record<keyof TareConfiguration, string>> = {};
    if (!configuration.tareType) errors.tareType = 'Select the tare type.';
    if (!configuration.maximumTareEffect || !Number.isFinite(Number(configuration.maximumTareEffect)) || Number(configuration.maximumTareEffect) <= 0) errors.maximumTareEffect = 'Enter a maximum tare effect greater than zero.';
    if (!units.includes(configuration.maximumTareEffectUnit)) errors.maximumTareEffectUnit = 'Select the mass unit.';
    if (!configuration.tareOperationMode) errors.tareOperationMode = 'Select the tare operation mode.';
    if (!configuration.tareWeighingDevicePresent) errors.tareWeighingDevicePresent = 'Select Yes or No.';
    if (!configuration.presetTareDevicePresent) errors.presetTareDevicePresent = 'Select Yes or No.';
    return errors;
  }, [configuration]);

  const saveConfiguration = async () => {
    if (Object.keys(configurationErrors).length) { setError('Complete the highlighted tare configuration fields.'); return; }
    setSavingConfiguration(true); setError('');
    try {
      const response = await axios.patch(`/test-reports/${reportId}/tare/configuration`, {
        tareType: configuration.tareType,
        maximumTareEffect: { value: Number(configuration.maximumTareEffect), unit: configuration.maximumTareEffectUnit },
        tareOperationMode: configuration.tareOperationMode,
        tareWeighingDevicePresent: configuration.tareWeighingDevicePresent === 'Yes',
        presetTareDevicePresent: configuration.presetTareDevicePresent === 'Yes',
      });
      setState((current: any) => ({ ...current, report: response.data.report, applicability: response.data.applicability, stale: response.data.stale, test: response.data.test }));
      setConfiguration(configurationFromState({ report: response.data.report }));
    } catch (e: any) { setError(e.response?.data?.message || 'Unable to save tare configuration.'); }
    finally { setSavingConfiguration(false); }
  };

  const start = async () => { setError(''); try { const response = await axios.post(`/test-reports/${reportId}/tare/start`); setState((current: any) => ({ ...current, test: response.data.test })); } catch (e: any) { setError(e.response?.data?.message || 'Unable to start Tare.'); } };
  const submitObservation = async (complete = false) => { setError(''); try { const response = await axios.patch(`/test-reports/${reportId}/tare/phases/A.4.6.1`, { unit: form.unit, observation: { tareValue: Number(form.tareValue), grossLoad: Number(form.grossLoad), indicationI: Number(form.indicationI), deltaL: Number(form.deltaL), direction: form.direction, notes: form.notes }, complete }); setState((current: any) => ({ ...current, test: response.data.test })); setForm(current => ({ ...empty, unit: current.unit })); } catch (e: any) { setError(e.response?.data?.message || 'Unable to save tare observation.'); } };
  const submitAccuracy = async () => { setError(''); try { const response = await axios.patch(`/test-reports/${reportId}/tare/phases/A.4.6.2`, { unit: form.unit, observation: { loadL: Number(form.grossLoad), indicationI: Number(form.indicationI), deltaL: Number(form.deltaL), notes: form.notes } }); setState((current: any) => ({ ...current, test: response.data.test })); setForm(current => ({ ...empty, unit: current.unit })); } catch (e: any) { setError(e.response?.data?.message || 'Unable to save tare-setting accuracy.'); } };

  if (!state) return <main className="tare-page"><div className="tare-loading">{error || 'Loading Tare…'}</div></main>;
  const test = state.test;
  const instrument = state.report?.instrument || {};
  const instrumentUnit = test?.instrumentSnapshot?.unit || instrument.unit || 'g';
  const configurationRequired = !test && state.applicability?.status === 'REQUIRES_CONFIGURATION';
  const configurationReady = state.applicability?.status === 'APPLICABLE';
  const revalidationRequired = test?.status === 'REVALIDATION_REQUIRED' || state.stale === true;

  return <main className="tare-page">
    <header className="tare-header"><Link to={`/tester/reports/${reportId}/testing`}><ArrowLeft size={16} /> Test route</Link><span>OIML R 76-1:2006 · A.4.6</span></header>
    <section className="tare-content"><div className="tare-title"><div><span className="technical-label">TESTING · TARE</span><h1>Tare</h1><p>Configure the tare procedure before recording observations. Net-load MPE is determined from the actual evaluated net load.</p></div><span className="tare-status">{revalidationRequired ? 'REVALIDATION REQUIRED' : test?.result || (configurationRequired ? 'CONFIGURATION REQUIRED' : configurationReady ? 'READY' : 'NOT APPLICABLE')}</span></div>
      {error && <div className="tare-error">{error}</div>}
      {!test && state.applicability?.status === 'NOT_APPLICABLE' && <section className="tare-start"><h2>A.4.6 Tare</h2><p>{state.applicability.reason}</p></section>}
      {!test && state.applicability?.status !== 'NOT_APPLICABLE' && <>
        <section className="tare-configuration"><div><span className="technical-label">TEST READINESS</span><h2>Tare Configuration</h2><p>{configurationRequired ? 'The instrument has a tare device. Complete these tare characteristics before starting the tare test.' : 'Review the tare characteristics used for this report before starting execution.'}</p></div>
          <div className="tare-config-form">
            <label>Tare Type<select value={configuration.tareType} onChange={event => updateConfiguration('tareType', event.target.value)}><option value="">Select tare type</option><option value="SUBTRACTIVE">Subtractive</option><option value="ADDITIVE">Additive</option></select>{configurationErrors.tareType && <small>{configurationErrors.tareType}</small>}</label>
            <label>Maximum Tare Effect<select value={configuration.maximumTareEffectUnit} onChange={event => updateConfiguration('maximumTareEffectUnit', event.target.value)}><option value="">Unit</option>{units.map(unit => <option key={unit}>{unit}</option>)}</select><input value={configuration.maximumTareEffect} onChange={event => updateConfiguration('maximumTareEffect', event.target.value)} type="number" min="0" step="any" placeholder="Enter value" />{configurationErrors.maximumTareEffect && <small>{configurationErrors.maximumTareEffect}</small>}{configurationErrors.maximumTareEffectUnit && <small>{configurationErrors.maximumTareEffectUnit}</small>}</label>
            <label>Tare Operation<select value={configuration.tareOperationMode} onChange={event => updateConfiguration('tareOperationMode', event.target.value)}><option value="">Select operation</option><option value="NON_AUTOMATIC">Non-automatic</option><option value="SEMI_AUTOMATIC">Semi-automatic</option><option value="AUTOMATIC">Automatic</option></select>{configurationErrors.tareOperationMode && <small>{configurationErrors.tareOperationMode}</small>}</label>
            <label>Tare Weighing Device<select value={configuration.tareWeighingDevicePresent} onChange={event => updateConfiguration('tareWeighingDevicePresent', event.target.value)}><option value="">Select Yes or No</option><option>Yes</option><option>No</option></select>{configurationErrors.tareWeighingDevicePresent && <small>{configurationErrors.tareWeighingDevicePresent}</small>}</label>
            <label>Preset Tare Device<select value={configuration.presetTareDevicePresent} onChange={event => updateConfiguration('presetTareDevicePresent', event.target.value)}><option value="">Select Yes or No</option><option>Yes</option><option>No</option></select>{configurationErrors.presetTareDevicePresent && <small>{configurationErrors.presetTareDevicePresent}</small>}</label>
          </div>
          <div className="tare-config-actions"><button className="route-primary" onClick={saveConfiguration} disabled={savingConfiguration}><Save size={15} /> {savingConfiguration ? 'Saving…' : 'Save Tare Configuration'}</button>{configurationReady && <button className="route-secondary" onClick={start}><Play size={15} /> Start Test</button>}</div>
        </section>
      </>}
      {test && revalidationRequired && <section className="tare-start tare-revalidation"><h2>Revalidation required</h2><p>The tare configuration or its A.4.2 source evidence changed after execution began. Existing observations are preserved; the test must be revalidated before it can contribute to the route.</p></section>}
      {test && !revalidationRequired && <>
        <section className="tare-plan"><div><span className="technical-label">RECOMMENDED PLAN</span><h2>Net-load points</h2><p>Guidance only. Recommended values are not observations and are never copied into actual fields.</p></div><div className="tare-plan-grid">{test.loadPlan.map((item: any) => <div key={`${item.sequence}-${item.representativeTare}`}><b>{displayMass(item.recommendedNetLoad, instrumentUnit)}</b><small>{item.direction} · tare {displayMass(item.representativeTare, instrumentUnit)}</small></div>)}</div></section>
        <section className="tare-phases">{test.phases.map((item: any, index: number) => { const editable = item.status === 'AVAILABLE' || item.status === 'IN_PROGRESS'; return <article className={`tare-phase ${item.status === 'COMPLETED' ? 'completed' : editable ? 'available' : 'locked'}`} key={item.code}>
          <div className="tare-phase-marker">{item.status === 'COMPLETED' ? <Check size={17} /> : item.status === 'LOCKED' ? <Lock size={15} /> : index + 1}</div>
          <div className="tare-phase-body"><div className="tare-phase-heading"><div><span>{item.code}</span><h2>{item.name}</h2></div><strong>{item.status}</strong></div><p>{item.reason}</p>
            {item.code === 'A.4.6.1' && editable && <div className="tare-form"><label>Observation unit<select value={form.unit} onChange={event => update('unit', event.target.value)}>{units.map(unit => <option key={unit}>{unit}</option>)}</select></label><label>Tare value ({form.unit})<input value={form.tareValue} onChange={event => update('tareValue', event.target.value)} type="number" min="0" /></label><label>Gross load ({form.unit})<input value={form.grossLoad} onChange={event => update('grossLoad', event.target.value)} type="number" min="0" /></label><label>Indication I ({form.unit})<input value={form.indicationI} onChange={event => update('indicationI', event.target.value)} type="number" /></label><label>ΔL ({form.unit})<input value={form.deltaL} onChange={event => update('deltaL', event.target.value)} type="number" min="0" /></label><label>Direction<select value={form.direction} onChange={event => update('direction', event.target.value as FormState['direction'])}><option value="INCREASING">INCREASING</option><option value="DECREASING">DECREASING</option></select></label><label className="tare-form-wide">Notes<textarea value={form.notes} onChange={event => update('notes', event.target.value)} /></label><div><button className="route-primary" onClick={() => submitObservation(false)}>Record observation</button><button className="route-secondary" onClick={() => submitObservation(true)}>Record &amp; complete</button></div></div>}
            {item.code === 'A.4.6.2' && editable && <div className="tare-form"><label>Observation unit<select value={form.unit} onChange={event => update('unit', event.target.value)}>{units.map(unit => <option key={unit}>{unit}</option>)}</select></label><label>Load L ({form.unit})<input value={form.grossLoad} onChange={event => update('grossLoad', event.target.value)} type="number" min="0" /></label><label>Indication I ({form.unit})<input value={form.indicationI} onChange={event => update('indicationI', event.target.value)} type="number" /></label><label>ΔL ({form.unit})<input value={form.deltaL} onChange={event => update('deltaL', event.target.value)} type="number" min="0" /></label><button className="route-primary" onClick={submitAccuracy}>Record &amp; complete</button></div>}
            {item.observations?.length > 0 && <div className="tare-observations">{item.observations.map((observation: any) => <div className="tare-observation" key={observation.sequence}><strong>Observation {observation.sequence}</strong><span>Gross {displayMass(observation.grossLoad, instrumentUnit)} · tare {displayMass(observation.tareValue, instrumentUnit)} · net {displayMass(observation.netLoad, instrumentUnit)}</span><span>P {displayMass(observation.trueIndicationP, instrumentUnit)} · E {displayMass(observation.rawErrorE, instrumentUnit)} · E<sub>c</sub> {displayMass(observation.correctedErrorEc, instrumentUnit)}</span><span>MPE {displayMass(observation.mpeValue, observation.mpeUnit || instrumentUnit)} · {observation.complianceResult || 'recorded'}</span></div>)}</div>}
            {item.calculations && <div className="tare-calculation-summary"><span>P <b>{displayMass(item.calculations.trueIndicationP, instrumentUnit)}</b></span><span>E <b>{displayMass(item.calculations.rawErrorE, instrumentUnit)}</b></span><span>E<sub>c</sub> <b>{displayMass(item.calculations.correctedErrorEc, instrumentUnit)}</b></span><span>Tare-setting accuracy limit <b>{displayMass(item.calculations.accuracyLimit, instrumentUnit)}</b></span><span>Result <b>{item.calculations.result}</b></span></div>}
          </div></article>; })}</section>
        {test.status === 'COMPLETED' && <div className="tare-complete"><Check size={18} /> A.4.6 Tare completed with result {test.result}.</div>}
      </>}
      {state.applicability?.status !== 'NOT_APPLICABLE' && <TestProcedureInfo testId="A.4.6" configuration={{ ...(test?.instrumentSnapshot || instrument), tareDevice: instrument.tareDevice, tareOperationMode: configuration.tareOperationMode, applicabilityStatus: state.applicability?.status }} />}
    </section>
  </main>;
}
