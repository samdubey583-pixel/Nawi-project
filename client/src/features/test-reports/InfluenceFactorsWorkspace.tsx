import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Lock, Play, Save } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import './influence-factors.css';
import './a5-recalculation.css';
import TestProcedureInfo from '../guidance/TestProcedureInfo';
import EvidencePanel from '../evidence/EvidencePanel';

const API = (id: string, suffix = '') => `/test-reports/${id}/influence-factors${suffix}`;
const num = (value: unknown) => value === '' || value === undefined ? undefined : Number(value);
const syntheticA5Defaults = { tiltConfiguration: 'true', hasLevelIndicator: 'false', hasAutomaticTiltSensor: 'false', mobileOutdoorUse: 'false', powerSourceType: 'AC_MAINS', nominalVoltage: '230', specifiedMinimumTemperature: '-10', specifiedMaximumTemperature: '40', manufacturerReferenceTemperature: '20' };

export default function InfluenceFactorsWorkspace() {
  const { reportId = '' } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState<any>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [a5Profile, setA5Profile] = useState(syntheticA5Defaults);
  const load = () => axios.get(API(reportId)).then(response => {
    setData(response.data);
    const saved = response.data.report?.instrument || {};
    setA5Profile(current => ({
      ...current,
      ...(typeof saved.tiltConfiguration === 'boolean' ? { tiltConfiguration: String(saved.tiltConfiguration) } : {}),
      ...(typeof saved.hasLevelIndicator === 'boolean' ? { hasLevelIndicator: String(saved.hasLevelIndicator) } : {}),
      ...(typeof saved.hasAutomaticTiltSensor === 'boolean' ? { hasAutomaticTiltSensor: String(saved.hasAutomaticTiltSensor) } : {}),
      ...(typeof saved.mobileOutdoorUse === 'boolean' ? { mobileOutdoorUse: String(saved.mobileOutdoorUse) } : {}),
      ...(saved.powerSourceType ? { powerSourceType: saved.powerSourceType } : {}),
      ...(saved.nominalVoltage != null ? { nominalVoltage: String(saved.nominalVoltage) } : {}),
      ...(saved.specifiedMinimumTemperature != null ? { specifiedMinimumTemperature: String(saved.specifiedMinimumTemperature) } : {}),
      ...(saved.specifiedMaximumTemperature != null ? { specifiedMaximumTemperature: String(saved.specifiedMaximumTemperature) } : {}),
      ...(saved.manufacturerReferenceTemperature != null ? { manufacturerReferenceTemperature: String(saved.manufacturerReferenceTemperature) } : {}),
    }));
  }).catch((e: any) => setError(e.response?.data?.message || 'Unable to load Influence Factors.'));
  useEffect(() => { void load(); }, [reportId]);
  const test = data?.test;
  const applicability = data?.applicability;
  const snapshot = test?.instrumentSnapshot || data?.report?.instrument || {};
  const phases = test?.phases || applicability?.branches || [];
  const active = phases.find((phase: any) => phase.status === 'AVAILABLE' || phase.status === 'IN_PROGRESS');

  const start = async () => { setBusy(true); setError(''); try { const response = await axios.post(API(reportId, '/start')); setData((current: any) => ({ ...current, ...response.data, test: response.data.test })); } catch (e: any) { setError(e.response?.data?.message || 'Unable to start Influence Factors.'); } finally { setBusy(false); } };
  const saveSyntheticProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await axios.patch(API(reportId, '/configuration'), {
        tiltConfiguration: a5Profile.tiltConfiguration === 'true', hasLevelIndicator: a5Profile.hasLevelIndicator === 'true',
        hasAutomaticTiltSensor: a5Profile.hasAutomaticTiltSensor === 'true', mobileOutdoorUse: a5Profile.mobileOutdoorUse === 'true',
        powerSourceType: a5Profile.powerSourceType, nominalVoltage: Number(a5Profile.nominalVoltage),
        specifiedMinimumTemperature: Number(a5Profile.specifiedMinimumTemperature), specifiedMaximumTemperature: Number(a5Profile.specifiedMaximumTemperature),
        manufacturerReferenceTemperature: Number(a5Profile.manufacturerReferenceTemperature), syntheticProfileConfirmed: true,
      });
      setData((current: any) => ({ ...current, report: response.data.report, applicability: response.data.applicability, prerequisitesComplete: response.data.prerequisitesComplete }));
    } catch (e: any) { setError(e.response?.data?.message || 'Unable to save the synthetic A.5 profile.'); }
    finally { setBusy(false); }
  };
  const saveSetup = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); setBusy(true); try { const body = Object.fromEntries(new FormData(event.currentTarget)); await axios.patch(API(reportId, '/setup'), { environmentalConditionsStableConfirmed: body.environmentalConditionsStableConfirmed === 'on', notes: body.notes || '' }); await load(); } catch (e: any) { setError(e.response?.data?.message || 'Unable to save A.5 setup.'); } finally { setBusy(false); } };
  const recalculateSyntheticTilting = async () => { setBusy(true); setError(''); try { await axios.patch(API(reportId, '/tilting/recalculate')); await load(); } catch (e: any) { setError(e.response?.data?.message || 'Unable to recalculate the saved synthetic A.5.1 readings.'); } finally { setBusy(false); } };

  if (!data) return <main className="influence-page"><div className="influence-loading">{error || 'Loading Influence Factors…'}</div></main>;
  return <main className="influence-page">
    <header className="workspace-top"><Link to={`/tester/reports/${reportId}/testing`}><ArrowLeft size={16} /> A.4 Performance Tests</Link><div className="workspace-brand"><strong>NAWI</strong><span>TEST &amp; REPORT SYSTEM</span></div><span className="influence-route-label">ROUTE 2 OF 3 · A.5</span></header>
    <section className="influence-content">
      <div className="influence-heading"><div><span className="technical-label">ANNEX A · INFLUENCE FACTORS</span><h1>A.5 Influence Factors</h1><p>Configuration-driven environmental, electrical, and tilt procedures.</p></div><span className={`influence-badge ${test?.status === 'COMPLETED' ? 'complete' : ''}`}>{test?.result || applicability?.status || 'READY'}</span></div>
      {error && <div className="influence-error">{error}</div>}
      <section className="influence-context"><div><span className="technical-label">INSTRUMENT CONTEXT</span><h2>{snapshot.typeDesignation || 'Instrument'}</h2></div><div className="influence-context-grid"><span><b>Class</b>{snapshot.accuracyClass || '—'}</span><span><b>Max</b>{snapshot.max ?? '—'} {snapshot.unit || 'g'}</span><span><b>Min</b>{snapshot.min ?? '—'} {snapshot.unit || 'g'}</span><span><b>e / d</b>{snapshot.e ?? '—'} / {snapshot.d ?? '—'} {snapshot.unit || 'g'}</span><span><b>Power</b>{snapshot.powerSourceType || snapshot.powerSupplyType || '—'}</span><span><b>Nominal</b>{snapshot.nominalVoltage ? `${snapshot.nominalVoltage} V` : '—'}</span></div></section>
      {!test && <section className="influence-start"><span className="technical-label">A.5 ROUTE</span><h2>Influence Factors setup</h2><p>{applicability?.reason || 'The applicable A.5 branches are determined by the saved instrument profile.'}</p>{applicability?.branches?.map((branch: any) => <div className="influence-branch-preview" key={branch.code}><strong>{branch.code} · {branch.name}</strong><span>{branch.status.replace(/_/g, ' ')} · {branch.reason}</span></div>)}{applicability?.status === 'APPLICABLE' ? <>{data.prerequisitesComplete === false && <div className="influence-prerequisite-note" role="status">Complete all preceding applicable A.4 tests before starting A.5. Your A.5 profile can be saved now, but test execution remains locked until the report is ready.</div>}<button className="influence-primary" onClick={start} disabled={busy || data.prerequisitesComplete === false}><Play size={16} /> {busy ? 'Starting…' : 'Start A.5 Setup'}</button></> : applicability?.status === 'REQUIRES_CONFIGURATION' ? <form className="influence-synthetic-profile" onSubmit={saveSyntheticProfile}><span className="technical-label">REPORT-SCOPED SYNTHETIC PROFILE</span><h3>Define the A.5 test scenario</h3><p>These supplemental values apply only to this report's A.5 workflow; they do not alter the registered instrument. They are marked Synthetic Prototype / Regression Data and are not manufacturer specifications.</p><div className="influence-profile-grid"><label>Tilt test profile<select value={a5Profile.tiltConfiguration} onChange={event => setA5Profile({ ...a5Profile, tiltConfiguration: event.target.value })}><option value="true">Liable to tilt · A.5.1.2</option><option value="false">Not liable to tilt · A.5.1 N/A</option></select></label><label>Mobile outdoor use<select value={a5Profile.mobileOutdoorUse} onChange={event => setA5Profile({ ...a5Profile, mobileOutdoorUse: event.target.value })}><option value="false">No · indoor/mobile profile</option><option value="true">Yes · outdoor open location</option></select></label><div className="influence-profile-static"><b>Level indicator</b><span>No · this report-only scenario uses the configured 50/1000 branch.</span></div><div className="influence-profile-static"><b>Automatic tilt sensor</b><span>No · this report-only scenario uses the configured 50/1000 branch.</span></div><label>Power source<select value={a5Profile.powerSourceType} onChange={event => setA5Profile({ ...a5Profile, powerSourceType: event.target.value })}><option value="AC_MAINS">AC mains</option><option value="EXTERNAL_AC_DC">External AC/DC supply</option><option value="NON_RECHARGEABLE_BATTERY">Non-rechargeable battery</option><option value="ROAD_VEHICLE_BATTERY_12V">12 V road-vehicle battery</option><option value="ROAD_VEHICLE_BATTERY_24V">24 V road-vehicle battery</option></select></label><label>Nominal voltage (V)<input required type="number" min="0.1" step="any" value={a5Profile.nominalVoltage} onChange={event => setA5Profile({ ...a5Profile, nominalVoltage: event.target.value })} /></label><label>Specified minimum temperature (°C)<input required type="number" step="any" value={a5Profile.specifiedMinimumTemperature} onChange={event => setA5Profile({ ...a5Profile, specifiedMinimumTemperature: event.target.value })} /></label><label>Specified maximum temperature (°C)<input required type="number" step="any" value={a5Profile.specifiedMaximumTemperature} onChange={event => setA5Profile({ ...a5Profile, specifiedMaximumTemperature: event.target.value })} /></label><label>Reference temperature (°C)<input required type="number" step="any" value={a5Profile.manufacturerReferenceTemperature} onChange={event => setA5Profile({ ...a5Profile, manufacturerReferenceTemperature: event.target.value })} /></label></div><button className="influence-primary" disabled={busy}><Save size={16} /> {busy ? 'Saving profile…' : 'Save report-only A.5 profile'}</button></form> : <p className="influence-notice">This profile selects a specialized A.5 procedure that is not implemented; the test is not silently skipped.</p>}</section>}
      {test && <>
        <section className="influence-setup"><div className="section-heading"><div><span className="technical-label">A.5 SETUP</span><h2>Session conditions</h2></div><span>Derived values are read-only; actual conditions remain tester evidence.</span></div>{!test.setup ? <form onSubmit={saveSetup} className="influence-form"><label className="influence-check"><input name="environmentalConditionsStableConfirmed" type="checkbox" required /> I confirm the EUT is stabilized under constant environmental conditions for the applicable A.5 procedure.</label><label>Setup notes<textarea name="notes" rows={2} /></label><button className="influence-primary" disabled={busy}><Save size={16} /> Save setup</button></form> : <div className="influence-saved"><Check size={16} /> Setup confirmed {test.setup.notes ? `· ${test.setup.notes}` : ''}</div>}</section>
        <section className="influence-phases"><div className="section-heading"><div><span className="technical-label">TEST SEQUENCE</span><h2>Applicable A.5 procedures</h2></div><span>{phases.filter((phase: any) => phase.applicability === 'APPLICABLE').length} configured branches</span></div>{phases.map((phase: any, index: number) => <PhaseCard key={phase.code} phase={phase} index={index} active={active?.code === phase.code} snapshot={snapshot} test={test} reportId={reportId} reload={load} setError={setError} busy={busy} setBusy={setBusy} synthetic={/synthetic prototype|regression data/i.test(String(data.report?.instrument?.additionalInformation || ''))} onRecalculate={recalculateSyntheticTilting} />)}</section>
        {test.status === 'COMPLETED' ? <div className="influence-next"><Check size={18} /><span>A.5 Influence Factors is complete. The final route is Endurance.</span><Link className="influence-primary" to={`/tester/reports/${reportId}/endurance`}>Continue to Endurance →</Link></div> : <button className="influence-primary influence-complete" onClick={async () => { setBusy(true); setError(''); try { await axios.patch(API(reportId, '/complete')); nav(`/tester/reports/${reportId}/endurance`); } catch (e: any) { setError(e.response?.data?.message || 'Unable to complete Influence Factors.'); } finally { setBusy(false); } }} disabled={busy}>Complete Influence Factors</button>}
        <EvidencePanel context={{ reportId, testId: active?.code || 'A.5.1', instrumentId: data.report?.instrumentId, category: 'ENVIRONMENT', evidenceType: active?.code === 'A.5.3' ? 'temperature_setup' : active?.code === 'A.5.4' ? 'power_source_setup' : active?.code === 'A.5.1' ? 'tilt_setup' : 'other', label: active?.code ? `${active.code} · ${active.name || 'Influence Factors'} · Setup` : 'A.5 · Influence Factors · Setup', testName: active?.name || 'Influence Factors', oimlReference: active?.code || 'A.5' }} />
      </>}
      {applicability?.status !== 'NOT_APPLICABLE' && <TestProcedureInfo testId={active?.code || 'A.5.1'} configuration={{ ...snapshot, method: active?.method, powerSourceType: snapshot.powerSourceType || snapshot.powerSupplyType, applicabilityStatus: applicability?.status }} />}
    </section>
  </main>;
}

function PhaseCard({ phase, index, active, snapshot, test, reportId, reload, setError, busy, setBusy, synthetic, onRecalculate }: any) {
  const disabled = !active || phase.status === 'LOCKED';
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(''); const body = Object.fromEntries(new FormData(event.currentTarget));
    if (phase.code === 'A.5.4') {
      const points = voltageObservationPoints(test.plan, snapshot);
      for (const point of points) {
        const actualVoltage = Number(body[`${point.id}_actual`]);
        const load = Number(body[`${point.id}_load`]);
        const behavior = body[`${point.id}_behavior`];
        const pointName = `${point.loadConditionLabel} · ${point.label.toLowerCase().replace(/_/g, ' ')}`;
        if (!Number.isFinite(actualVoltage) || actualVoltage <= 0) {
          setError(`${pointName}: enter an actual voltage greater than zero.`);
          return;
        }
        if (!Number.isFinite(load) || load < 0) {
          setError(`${pointName}: enter a valid actual load.`);
          return;
        }
        if (behavior === 'OPERATED') {
          const indication = num(body[`${point.id}_indication`]);
          const deltaL = num(body[`${point.id}_deltaL`]);
          const zeroError = num(body[`${point.id}_zeroError`]);
          if (indication === undefined || !Number.isFinite(indication)) {
            setError(`${pointName}: enter an indication when the instrument operated as designed.`);
            return;
          }
          if (deltaL === undefined || !Number.isFinite(deltaL) || deltaL < 0) {
            setError(`${pointName}: enter a valid ΔL (zero or greater) when the instrument operated as designed.`);
            return;
          }
          if (zeroError === undefined || !Number.isFinite(zeroError)) {
            setError(`${pointName}: enter E₀ when the instrument operated as designed.`);
            return;
          }
        }
      }
    }
    setBusy(true);
    try {
      if (phase.code === 'A.5.1') {
        const observations = ['LONGITUDINAL', 'TRANSVERSE'].flatMap(direction => ['NO_LOAD', 'LOW_LOAD', 'MAX_LOAD'].map(position => ({ direction, position, requiredTilt: num(body[`${direction}_${position}_requiredTilt`]), actualTilt: Number(body[`${direction}_${position}_actualTilt`]), load: Number(body[`${direction}_${position}_load`]), indication: Number(body[`${direction}_${position}_indication`]), deltaL: Number(body[`${direction}_${position}_deltaL`]), zeroError: Number(body[`${direction}_${position}_zeroError`]), unit: snapshot.unit || 'g' })));
        await axios.patch(API(reportId, '/tilting'), { zeroSettingOffConfirmed: body.zeroSettingOffConfirmed === 'on', observations });
      } else if (phase.code === 'A.5.2') {
        const observations = ['T5', 'T15', 'T30'].map(checkpoint => ({ checkpoint, observedAt: String(body[`${checkpoint}_observedAt`]), load: Number(body[`${checkpoint}_load`]), indication: Number(body[`${checkpoint}_indication`]), deltaL: Number(body[`${checkpoint}_deltaL`]), zeroError: Number(body[`${checkpoint}_zeroError`]), unit: snapshot.unit || 'g' }));
        await axios.patch(API(reportId, '/warm-up'), { disconnectedAt: body.disconnectedAt, connectedAt: body.connectedAt, stabilizationAt: body.stabilizationAt, eightHourPreconditionConfirmed: body.eightHourPreconditionConfirmed === 'on', observations });
      } else if (phase.code === 'A.5.3') {
        const targets = test.plan?.temperature?.targets || [];
        const stabilityConfirmed = body.temperatureStabilityConfirmed === 'on';
        const points = targets.map((target: any) => ({ pointId: target.id, targetTemperature: target.value, actualTemperature: Number(body[`${target.id}_actual`]), stabilizedAt: new Date().toISOString(), twoHourStabilityConfirmed: stabilityConfirmed, heatingCoolingRate: Number(body[`${target.id}_rate`]), relativeHumidity: num(body[`${target.id}_rh`]), pressure: num(body[`${target.id}_pressure`]), load: Number(body[`${target.id}_load`]), indication: Number(body[`${target.id}_indication`]), deltaL: Number(body[`${target.id}_deltaL`]), zeroError: Number(body[`${target.id}_zeroError`]), unit: snapshot.unit || 'g' }));
        await axios.patch(API(reportId, '/temperature'), { points });
      } else if (phase.code === 'A.5.4') {
        const observations = voltageObservationPoints(test.plan, snapshot).map(point => ({ label: point.voltageId, loadCondition: point.loadConditionId, targetVoltage: point.targetVoltage, actualVoltage: Number(body[`${point.id}_actual`]), load: Number(body[`${point.id}_load`]), functionBehavior: body[`${point.id}_behavior`] || 'OPERATED', indication: num(body[`${point.id}_indication`]), deltaL: num(body[`${point.id}_deltaL`]), zeroError: num(body[`${point.id}_zeroError`]), unit: snapshot.unit || 'g' }));
        await axios.patch(API(reportId, '/voltage'), { observations });
      }
      await reload();
    } catch (e: any) { setError(e.response?.data?.message || e.message || `Unable to save ${phase.code}.`); } finally { setBusy(false); }
  };
  if (phase.applicability === 'NOT_APPLICABLE') return <article className="influence-phase not-applicable"><div className="phase-index">{index + 1}</div><div><h3>{phase.code} · {phase.name}</h3><p>{phase.reason}</p></div><span>NOT APPLICABLE</span></article>;
  return <article className={`influence-phase ${active ? 'active' : ''} ${phase.status === 'COMPLETED' ? 'completed' : ''}`}><div className="phase-index">{phase.status === 'COMPLETED' ? <Check size={17} /> : disabled ? <Lock size={15} /> : index + 1}</div><div className="phase-body"><div className="phase-title"><div><h3>{phase.code} · {phase.name}</h3><p>{phase.reason}</p></div><span>{phase.status.replace(/_/g, ' ')}</span></div>{phase.status === 'COMPLETED' ? phase.code === 'A.5.1' ? <><TiltingSavedSummary test={test} snapshot={snapshot} result={phase.result} />{synthetic && phase.result === 'FAIL' && <div className="influence-recalculate-note"><p>Re-evaluate this saved synthetic result using the corrected floating-point boundary handling. Original entered observations are retained in revision history.</p><button className="influence-primary" disabled={busy} onClick={() => void onRecalculate()}>Recalculate saved synthetic readings</button></div>}</> : phase.code === 'A.5.4' ? <VoltageSavedSummary test={test} snapshot={snapshot} result={phase.result} /> : <div className="influence-saved"><Check size={15} /> Recorded result: {phase.result}</div> : active && <form noValidate={phase.code === 'A.5.4'} onSubmit={submit} className={`influence-form ${phase.code === 'A.5.1' ? 'tilt-form' : phase.code === 'A.5.4' ? 'voltage-form' : ''}`}>{phase.code === 'A.5.1' && <TiltingForm snapshot={snapshot} phase={phase} test={test} />}{phase.code === 'A.5.2' && <WarmupForm />}{phase.code === 'A.5.3' && <TemperatureForm plan={test.plan?.temperature} unit={snapshot.unit || 'g'} />}{phase.code === 'A.5.4' && <VoltageForm plan={test.plan} snapshot={snapshot} unit={snapshot.unit || 'g'} />}<button className="influence-primary" disabled={busy} aria-live="polite"><Save size={15} /> {busy ? 'Saving observations…' : phase.code === 'A.5.1' ? 'Save tilting observations' : 'Save observations'}</button></form>}</div></article>;
}

function tiltingMethod(snapshot: any, phase: any) {
  if (phase?.method === 'A.5.1.1' || snapshot.hasLevelIndicator === true || snapshot.hasAutomaticTiltSensor === true) return snapshot.hasAutomaticTiltSensor === true ? 'Automatic tilt sensor' : 'Level indicator / configured tilt limit';
  return 'Configured 50/1000 tilt method';
}

function configuredTilt(snapshot: any, phase: any) {
  const value = Number(phase?.tiltLimit ?? snapshot.manufacturerTiltLimit);
  return Number.isFinite(value) && value > 0 ? `${value}°` : '50/1000 ratio';
}

function configuredTiltValue(snapshot: any, phase: any) {
  const value = Number(phase?.tiltLimit ?? snapshot.manufacturerTiltLimit);
  return Number.isFinite(value) && value > 0 ? value : '';
}

function zeroSettingDisplay(snapshot: any) {
  const method = snapshot.zeroSettingMethod || 'Not specified';
  const tracking = snapshot.zeroTracking === true ? 'ON' : snapshot.zeroTracking === false ? 'OFF' : 'Not specified';
  return `${method} / tracking ${tracking}`;
}

function TiltingForm({ snapshot, phase, test }: any) {
  const positions = ['NO_LOAD', 'LOW_LOAD', 'MAX_LOAD'];
  const directions = [{ id: 'LONGITUDINAL', description: 'Observe the instrument along its longitudinal axis.' }, { id: 'TRANSVERSE', description: 'Observe the instrument along its transverse axis.' }];
  const requiredTilt = configuredTilt(snapshot, phase);
  const requiredTiltValue = configuredTiltValue(snapshot, phase);
  const savedObservations = test?.tilting?.observations || [];
  return <>
    <section className="tilt-configuration" aria-labelledby="tilt-configuration-heading">
      <div className="tilt-section-heading"><div><span className="technical-label">TEST CONFIGURATION</span><h4 id="tilt-configuration-heading">Configured test conditions</h4></div><span className="tilt-read-only-note">Read-only from instrument configuration</span></div>
      <div className="tilt-configuration-grid">
        <div><span>Limiting tilt</span><strong>{requiredTilt}</strong><small>Configured value</small></div>
        <div><span>Zero-setting / zero-tracking</span><strong>{zeroSettingDisplay(snapshot)}</strong><small>Instrument configuration</small></div>
        <div><span>Method</span><strong>{tiltingMethod(snapshot, phase)}</strong><small>Applicable A.5.1 method</small></div>
      </div>
    </section>
    <section className="tilt-confirmation" aria-labelledby="tilt-confirmation-heading">
      <span className="technical-label">PROCEDURE CONFIRMATION</span>
      <h4 id="tilt-confirmation-heading">Test condition</h4>
      <label className="tilt-confirmation-control"><input name="zeroSettingOffConfirmed" type="checkbox" required /> <span><strong>Automatic zero-setting / zero-tracking is OFF for this tilting test.</strong><small>This records the tester's procedural confirmation; it does not electronically prove the physical condition.</small></span></label>
    </section>
    <p className="tilt-form-note">Record the actual achieved tilt and the physical observations for both directions. Required tilt is configured and cannot be edited here.</p>
    <div className="tilt-direction-grid">
      {directions.map(direction => <section className="tilt-direction-card" key={direction.id} aria-labelledby={`${direction.id}-heading`}>
        <div className="tilt-direction-heading"><div><span className="technical-label">DIRECTION</span><h4 id={`${direction.id}-heading`}>{direction.id}</h4><p>{direction.description}</p></div><span className="tilt-direction-count">{savedObservations.filter((observation: any) => (observation.raw?.direction || observation.direction) === direction.id).length} / 3 observations completed</span></div>
        <div className="tilt-observation-stack">
          {positions.map(position => <section className="tilt-observation-card" key={`${direction.id}_${position}`}>
            <div className="tilt-observation-heading"><div><span className="tilt-observation-kicker">OBSERVATION</span><h5>{position.replace('_', ' ')}</h5></div><span className="tilt-observation-state">Actual observation</span></div>
            <input name={`${direction.id}_${position}_requiredTilt`} type="hidden" value={requiredTiltValue} />
            <div className="tilt-field-grid">
              <div className="tilt-derived-field"><span>Required tilt</span><strong>{requiredTilt}</strong><small>Configured</small></div>
              <label>Actual tilt<input name={`${direction.id}_${position}_actualTilt`} type="number" step="any" min="0" placeholder="e.g. 2.0" required /></label>
              <label>Actual load used ({snapshot.unit || 'g'})<input name={`${direction.id}_${position}_load`} type="number" step="any" min="0" placeholder="Tester observation" required /></label>
              <label>Indication ({snapshot.unit || 'g'})<input name={`${direction.id}_${position}_indication`} type="number" step="any" placeholder="Tester observation" required /></label>
              <label>ΔL ({snapshot.unit || 'g'})<input name={`${direction.id}_${position}_deltaL`} type="number" step="any" min="0" placeholder="Tester observation" required /></label>
              <label className="tilt-recorded-field">Zero error E₀ ({snapshot.unit || 'g'})<input name={`${direction.id}_${position}_zeroError`} type="number" step="any" placeholder="Recorded observation" required /><small>Recorded input; compliance is calculated after save.</small></label>
            </div>
          </section>)}
        </div>
      </section>)}
    </div>
  </>;
}

function formatTiltValue(value: any, unit: string) { return value === undefined || value === null || value === '' || !Number.isFinite(Number(value)) ? '—' : `${Number(value)} ${unit}`; }

function TiltingSavedSummary({ test, snapshot, result }: any) {
  const observations = test?.tilting?.observations || [];
  const unit = snapshot.unit || 'g';
  const byKey = new Map<string, any>(observations.map((observation: any) => [`${observation.raw?.direction || observation.direction}:${observation.raw?.position || observation.position}`, observation] as [string, any]));
  return <div className="tilt-saved-summary">
    <div className="tilt-saved-heading"><div><span className="technical-label">A.5.1 OBSERVATIONS</span><h4>Tilting test recorded</h4></div><span className={`tilt-result ${result === 'PASS' ? 'pass' : result === 'FAIL' ? 'fail' : ''}`}>{result}</span></div>
    {['LONGITUDINAL', 'TRANSVERSE'].map(direction => <section className="tilt-saved-direction" key={direction}><div className="tilt-saved-direction-heading"><strong>{direction}</strong><span>{observations.filter((observation: any) => (observation.raw?.direction || observation.direction) === direction).length} / 3 observations completed</span></div><div className="tilt-saved-grid">{['NO_LOAD', 'LOW_LOAD', 'MAX_LOAD'].map(position => { const observation = byKey.get(`${direction}:${position}`); const raw = observation?.raw || observation || {}; return <article className="tilt-saved-card" key={`${direction}_${position}`}><div className="tilt-saved-card-heading"><strong>{position.replace('_', ' ')}</strong><span className={`tilt-result ${observation?.compliance === 'PASS' ? 'pass' : observation?.compliance === 'FAIL' ? 'fail' : ''}`}>{observation?.compliance || 'INCOMPLETE'}</span></div><dl><div><dt>Required tilt</dt><dd>{raw.requiredTilt ?? configuredTilt(snapshot, {})}</dd></div><div><dt>Actual tilt</dt><dd>{raw.actualTilt === undefined ? '—' : `${raw.actualTilt}°`}</dd></div><div><dt>Actual load</dt><dd>{formatTiltValue(observation?.load ?? raw.load, unit)}</dd></div><div><dt>Indication</dt><dd>{formatTiltValue(observation?.indication ?? raw.indication, unit)}</dd></div><div><dt>ΔL</dt><dd>{formatTiltValue(observation?.deltaL ?? raw.deltaL, unit)}</dd></div><div><dt>Zero error E₀</dt><dd>{formatTiltValue(observation?.E0 ?? raw.zeroError, unit)}</dd></div></dl></article>; })}</div></section>)}
  </div>;
}
function WarmupForm() { return <>
  <section className="warmup-attestation" aria-labelledby="warmup-attestation-title">
    <span className="technical-label">A.5.2 · PRECONDITION</span>
    <h4 id="warmup-attestation-title">Confirm the power-off period</h4>
    <p>Before reconnecting the instrument, verify that it was disconnected from the electrical supply for at least 8 hours.</p>
    <label className="influence-check warmup-attestation-check"><input name="eightHourPreconditionConfirmed" type="checkbox" required /> I confirm the instrument remained disconnected for at least 8 hours.</label>
    <small>The system records this tester confirmation and the times entered below; it does not independently monitor the power supply.</small>
  </section>
  <div className="warmup-times">
    <label>Disconnected at<input name="disconnectedAt" type="datetime-local" required /></label>
    <label>Reconnected at<input name="connectedAt" type="datetime-local" required /></label>
    <label>Indication stabilized at<input name="stabilizationAt" type="datetime-local" required /></label>
  </div>
  {['T5', 'T15', 'T30'].map(point => <div className="observation-row" key={point}><strong>{point}</strong><input name={`${point}_observedAt`} type="datetime-local" required /><input name={`${point}_load`} type="number" step="any" placeholder="Load" required /><input name={`${point}_indication`} type="number" step="any" placeholder="Indication" required /><input name={`${point}_deltaL`} type="number" step="any" placeholder="ΔL" required /><input name={`${point}_zeroError`} type="number" step="any" placeholder="E₀" required /></div>)}
</>; }
function temperatureCardTitle(target: any) {
  const displayLabels: Record<string, string> = {
    REFERENCE_START: 'Reference temperature',
    SPECIFIED_HIGH: 'Specified high temperature',
    SPECIFIED_LOW: 'Specified low temperature',
    FIVE_DEGREES: '5 °C check',
    REFERENCE_END: 'Reference return',
  };
  const label = displayLabels[target.id] || target.label;
  if (target.id === 'FIVE_DEGREES') return label;

  const numericTemperature = Number(target.value);
  const formattedTemperature = Number.isFinite(numericTemperature) && numericTemperature < 0
    ? `−${Math.abs(numericTemperature)}`
    : String(target.value);
  return `${label} · ${formattedTemperature} °C`;
}

function TemperatureForm({ plan, unit }: any) {
  const targets = plan?.targets || [];
  return <>
    <section className="temperature-confirmation" aria-labelledby="temperature-confirmation-heading">
      <span className="technical-label">TEMPERATURE STABILITY CONFIRMATION</span>
      <h4 id="temperature-confirmation-heading">Required 2-hour stability at each applicable point</h4>
      <label className="temperature-confirmation-control"><input name="temperatureStabilityConfirmed" type="checkbox" required /> <span><strong>I confirm that the EUT reached temperature stability and the required 2-hour stability period was completed at each applicable temperature before the corresponding weighing observations were recorded.</strong><small>Tester procedural confirmation; the software does not electronically verify the physical temperature stability.</small></span></label>
    </section>
    <section className="temperature-observations" aria-labelledby="temperature-observations-heading">
      <div className="temperature-section-heading"><div><span className="technical-label">TEMPERATURE OBSERVATIONS</span><h4 id="temperature-observations-heading">Five-point temperature sequence</h4></div><span>{targets.length} applicable points · maximum change rate 1 °C/min</span></div>
      <div className="temperature-sequence">
        {targets.map((target: any, index: number) => <article className="temperature-card" key={target.id}>
          <div className="temperature-card-heading"><div><span className="temperature-point-kicker">POINT {index + 1} OF {targets.length}</span><h5>{temperatureCardTitle(target)}</h5></div><span className="temperature-stability-badge">2 h stability required</span></div>
          <div className="temperature-field-group"><span className="temperature-group-label">OBSERVATIONS</span><div className="temperature-field-grid">
            <label>Actual °C<input name={`${target.id}_actual`} type="number" step="any" placeholder="Actual temperature" required /></label>
            <label>Rate °C/min<input name={`${target.id}_rate`} type="number" step="any" placeholder="Maximum rate" required /></label>
            <label>RH %<input name={`${target.id}_rh`} type="number" step="any" placeholder="Optional" /></label>
            <label>Load ({unit})<input name={`${target.id}_load`} type="number" step="any" min="0" placeholder="Tester observation" required /></label>
            <label>Indication ({unit})<input name={`${target.id}_indication`} type="number" step="any" placeholder="Tester observation" required /></label>
            <label>ΔL ({unit})<input name={`${target.id}_deltaL`} type="number" step="any" min="0" placeholder="Tester observation" required /></label>
          </div></div>
          <div className="temperature-recorded-group"><span className="temperature-group-label">CALCULATED / RECORDED</span><label className="temperature-recorded-field">E₀ ({unit})<input name={`${target.id}_zeroError`} type="number" step="any" placeholder="Recorded E₀" required /><small>Recorded input used by the existing calculation.</small></label></div>
        </article>)}
      </div>
    </section>
  </>;
}
function voltageObservationPoints(plan: any, snapshot: any) {
  const limits = plan?.voltage || {};
  const reference = Number.isFinite(Number(limits.reference)) ? Number(limits.reference) : Number(snapshot?.nominalVoltage);
  const sequence = [
    { id: 'REFERENCE_START', label: 'Reference voltage', targetVoltage: reference },
    { id: 'LOWER', label: 'Lower voltage', targetVoltage: limits.lower },
    { id: 'UPPER', label: 'Upper voltage', targetVoltage: limits.upper },
    { id: 'REFERENCE_END', label: 'Reference return', targetVoltage: reference },
  ];
  const conditions = [
    { id: '10E', label: '10e test load', targetLoad: Number(snapshot?.e) * 10 },
    { id: 'HALF_MAX_TO_MAX', label: '½ Max to Max test load', targetLoad: undefined },
  ];
  return conditions.flatMap(condition => sequence.map(point => ({
    ...point,
    id: `${condition.id}_${point.id}`,
    voltageId: point.id,
    loadConditionId: condition.id,
    loadConditionLabel: condition.label,
    targetLoad: condition.targetLoad,
  })));
}

function formatVoltage(value: unknown) {
  if (!Number.isFinite(Number(value))) return '—';
  const numeric = Number(value);
  return Number.isInteger(numeric) ? numeric.toFixed(1) : numeric.toFixed(2).replace(/0$/, '');
}

function formatVoltageMass(value: unknown, unit: string) {
  return Number.isFinite(Number(value)) ? `${Number(value).toFixed(3)} ${unit}` : '—';
}

function voltagePointTitle(id: string) {
  return ({ REFERENCE_START: 'Reference value', LOWER: '−15% · lower voltage', UPPER: '+10% · upper voltage', REFERENCE_END: 'Reference value' } as Record<string, string>)[id] || id;
}

function VoltageForm({ plan, snapshot, unit }: any) {
  const limits = plan?.voltage || {};
  const points = voltageObservationPoints(plan, snapshot);
  const powerSourceLabel = String(snapshot?.powerSourceType || 'Configured power source').replace(/_/g, ' ');
  const lowLoad = plan?.testLoads?.find((item: any) => item.label === '10e');
  const highLoad = plan?.testLoads?.find((item: any) => item.label === 'Between 1/2 Max and Max');
  const rangeText = snapshot?.specifiedVoltageRange?.min !== undefined && snapshot?.specifiedVoltageRange?.max !== undefined
    ? `Marked range ${formatVoltage(snapshot.specifiedVoltageRange.min)}–${formatVoltage(snapshot.specifiedVoltageRange.max)} V → ${formatVoltage(limits.lower)}–${formatVoltage(limits.upper)} V`
    : `Nominal voltage ${formatVoltage(snapshot?.nominalVoltage)} V → ${formatVoltage(limits.lower)}–${formatVoltage(limits.upper)} V`;
  return <>
    <section className="voltage-configuration" aria-labelledby="voltage-configuration-heading">
      <div className="voltage-section-heading"><div><span className="technical-label">{limits.branch || 'A.5.4'} · {powerSourceLabel}</span><h4 id="voltage-configuration-heading">Voltage variation test</h4><p>All functions should operate as designed and indications remain within the applicable maximum permissible errors.</p></div><span className="voltage-branch-badge">OIML-derived</span></div>
      <div className="voltage-configuration-grid"><div><span>Power source</span><strong>{snapshot?.powerSourceType || 'Configured power source'}</strong><small>Configured branch {limits.branch || 'A.5.4'}</small></div><div><span>Nominal voltage</span><strong>{formatVoltage(snapshot?.nominalVoltage)} V</strong><small>{rangeText}</small></div><div><span>Test sequence</span><strong>Reference · lower · upper · reference</strong><small>R 76-2 report form</small></div></div>
      <div className="voltage-load-guidance"><div><span>Required test load</span><strong>{lowLoad ? `10e = ${formatVoltageMass(lowLoad.value, unit)}` : `10e = ${formatVoltageMass(Number(snapshot?.e) * 10, unit)}`}</strong><small>First load condition</small></div><div><span>Required test-load range</span><strong>{highLoad ? `½ Max to Max = ${formatVoltageMass(highLoad.value, unit)}–${formatVoltageMass(snapshot?.max, unit)}` : `½ Max to Max = ${formatVoltageMass(Number(snapshot?.max) / 2, unit)}–${formatVoltageMass(snapshot?.max, unit)}`}</strong><small>Select an actual load within the derived range.</small></div></div>
    </section>
    <section className="voltage-observations" aria-labelledby="voltage-observations-heading">
      <div className="voltage-section-heading"><div><span className="technical-label">VOLTAGE OBSERVATIONS</span><h4 id="voltage-observations-heading">Record the actual tester observations</h4></div><span>Mass unit: {unit}</span></div>
      <div className="voltage-sequence">{points.map((point, index) => <article className="voltage-card" key={point.id}>
        <div className="voltage-card-heading"><div><span className="voltage-point-kicker">{point.loadConditionLabel} · Point {index % 4 + 1} of 4</span><h5>{voltagePointTitle(point.voltageId)} · {point.label}</h5><small>{point.loadConditionId === '10E' ? `Required load: exactly ${formatVoltageMass(point.targetLoad, unit)}` : `Required load range: ${formatVoltageMass(Number(snapshot?.max) / 2, unit)} to ${formatVoltageMass(snapshot?.max, unit)}`}</small></div><div className="voltage-target"><span>Target voltage</span><strong>{formatVoltage(point.targetVoltage)} V</strong><small>Read-only · OIML-derived</small></div></div>
        <div className="voltage-field-group"><span className="voltage-group-label">OBSERVATIONS</span><div className="voltage-field-grid">
          <label>Actual voltage (V)<input name={`${point.id}_actual`} type="number" step="any" min="0" placeholder="Tester observation" required /></label>
          <label>Actual load ({unit})<input name={`${point.id}_load`} type="number" step="any" min="0" placeholder="Tester observation" required /></label>
          <label>Indication ({unit})<input name={`${point.id}_indication`} type="number" step="any" placeholder="Tester observation" /></label>
          <label>Operating behaviour<select className="voltage-behavior" name={`${point.id}_behavior`} defaultValue="OPERATED"><option value="OPERATED">Operated as designed</option><option value="SWITCHED_OFF">Indication switched off</option></select></label>
          <label>ΔL ({unit})<input name={`${point.id}_deltaL`} type="number" step="any" min="0" placeholder="Tester observation" /></label>
          <label className="voltage-derived-field">E₀ ({unit})<input name={`${point.id}_zeroError`} type="number" step="any" placeholder="Zero error" /><small>Recorded/determined zero error</small></label>
        </div></div>
      </article>)}</div>
    </section>
  </>;
}

function VoltageSavedSummary({ test, snapshot, result }: any) {
  const unit = snapshot?.unit || 'g';
  const observations = test?.voltage?.observations || [];
  return <section className="voltage-saved-summary"><div className="voltage-saved-heading"><div><span className="technical-label">A.5.4 OBSERVATIONS</span><h4>Voltage variation test recorded</h4></div><span className={`voltage-result ${result === 'PASS' ? 'pass' : result === 'FAIL' ? 'fail' : ''}`}>{result}</span></div><div className="voltage-results-table"><div className="voltage-results-header"><strong>Load condition</strong><strong>Point</strong><strong>Actual / target</strong><strong>Load</strong><strong>Indication</strong><strong>ΔL</strong><strong>E₀</strong><strong>Corrected error</strong><strong>MPE</strong><strong>Behaviour / result</strong></div>{observations.map((item: any, index: number) => <div className="voltage-results-row" key={`${item.loadCondition}-${item.label}-${index}`}><span>{item.loadCondition === '10E' ? '10e' : '½ Max to Max'}</span><span>{voltagePointTitle(item.label)}</span><span>{formatVoltage(item.actualVoltage)} / {formatVoltage(item.targetVoltage)} V</span><span>{formatVoltageMass(item.load, unit)}</span><span>{formatVoltageMass(item.indication, unit)}</span><span>{formatVoltageMass(item.deltaL, unit)}</span><span>{formatVoltageMass(item.zeroError, unit)}</span><span>{formatVoltageMass(item.correctedErrorEc, unit)}</span><span>{item.mpeValue === undefined ? '—' : `±${formatVoltageMass(item.mpeValue, unit)}`}</span><span>{item.functionBehavior === 'SWITCHED_OFF' ? 'Indication switched off' : 'Operated as designed'} · {item.compliance || 'INCOMPLETE'}</span></div>)}</div></section>;
}
