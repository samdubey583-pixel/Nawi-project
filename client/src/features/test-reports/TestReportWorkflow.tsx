import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, ArrowRight, Check, Plus } from 'lucide-react';
import './report-workflow.css';
import { SCALE_INTERVAL_ERROR, validateScaleIntervals } from '../metrology/scaleInterval';

type Form = {
  applicationNumber: string; referenceMode: string; externalReference: string; organization: string; contactName: string; email: string; phone: string; address: string;
  manufacturer: string; model: string; serial: string; accuracyClass: string; indication: string; unit: string; min: string; max: string; e: string; d: string; software: string; softwareVersion?: string; loadCell: string; notes: string;
  rangeType: string; intervalType: string; tareDevice: string; multipleIndicatingDevices: string; loadReceptorType: string; numberOfSupportPoints: string; usesElectricPower: string; powerSupplyType: string; mobileInstrument: string; portableRoadVehicleInstrument: string; rollingLoad: string; zeroSettingMethod: string; zeroTracking: string; zeroIndicatingDevice: string; digitalIndication: string; stableEquilibriumFunction: string; printingCapability: string; dataStorageCapability: string; zeroSettingCapability: string; tareCapability: string; differentiatedScaleDivisions: string; tiltConfiguration: string; hasLevelIndicator: string; hasAutomaticTiltSensor: string; manufacturerTiltLimit: string; mobileOutdoorUse: string; powerSourceType: string; nominalVoltage: string; minimumOperatingVoltage: string; maximumVoltage: string; specifiedVoltageMin: string; specifiedVoltageMax: string; threePhaseSupply: string; rechargeableBattery: string; rechargeableBatteryCanChargeDuringOperation: string; specifiedMinimumTemperature: string; specifiedMaximumTemperature: string; manufacturerReferenceTemperature: string; controlStage: string;
};

const blank: Form = {
  applicationNumber: '', referenceMode: 'generated', externalReference: '', organization: '', contactName: '', email: '', phone: '', address: '', manufacturer: '', model: '', serial: '', accuracyClass: '', indication: '', unit: 'g', min: '', max: '', e: '', d: '', software: '', loadCell: '', notes: '', rangeType: '', intervalType: '', tareDevice: '', multipleIndicatingDevices: '', loadReceptorType: '', numberOfSupportPoints: '', usesElectricPower: '', powerSupplyType: '', mobileInstrument: '', portableRoadVehicleInstrument: '', rollingLoad: '', zeroSettingMethod: '', zeroTracking: '', zeroIndicatingDevice: '', digitalIndication: '', stableEquilibriumFunction: '', printingCapability: '', dataStorageCapability: '', zeroSettingCapability: '', tareCapability: '', differentiatedScaleDivisions: '', tiltConfiguration: '', hasLevelIndicator: '', hasAutomaticTiltSensor: '', manufacturerTiltLimit: '', mobileOutdoorUse: '', powerSourceType: '', nominalVoltage: '', minimumOperatingVoltage: '', maximumVoltage: '', specifiedVoltageMin: '', specifiedVoltageMax: '', threePhaseSupply: '', rechargeableBattery: '', rechargeableBatteryCanChargeDuringOperation: '', specifiedMinimumTemperature: '', specifiedMaximumTemperature: '', manufacturerReferenceTemperature: '', controlStage: 'VERIFICATION',
};

const steps = ['Application', 'Instrument', 'Instrument Configuration', 'Review & Submit'] as const;
const accuracyClasses = ['Class I', 'Class II', 'Class III', 'Class IIII'];
const indicationTypes = ['Self-indicating', 'Semi-self-indicating', 'Non-self-indicating'];
const massUnits = ['g', 'kg', 'mg', 't'];
const yesNo = ['Yes', 'No'];

function Field({ label, value, onChange, required = true, type = 'text', min, max, step, error }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string; min?: string; max?: string; step?: string; error?: string }) {
  return <label className={`report-field${error ? ' field-invalid' : ''}`}><span>{label}{required && <i> *</i>}</span><input aria-invalid={Boolean(error)} type={type} min={min} max={max} step={step} value={value} onChange={event => onChange(event.target.value)} />{error && <small className="field-error">{error}</small>}</label>;
}

function reviewOption(value: string) {
  if (!value) return '—';
  return value.replace(/-/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function ReviewCard({ eyebrow, title, meta, children }: { eyebrow: string; title: string; meta?: string; children: ReactNode }) {
  return <section className="setup-review-card"><header className="setup-review-card-heading"><div><span>{eyebrow}</span><h3>{title}</h3></div>{meta && <small>{meta}</small>}</header><div className="setup-review-properties">{children}</div></section>;
}

function ReviewProperty({ label, value, emphasis = false, wide = false }: { label: string; value: ReactNode; emphasis?: boolean; wide?: boolean }) {
  const displayValue = value === undefined || value === null || value === '' ? '—' : value;
  return <div className={`setup-review-property${emphasis ? ' emphasis' : ''}${wide ? ' wide' : ''}`}><small>{label}</small><strong>{displayValue}</strong></div>;
}

function SelectField({ label, value, onChange, options, required = true }: { label: string; value: string; onChange: (v: string) => void; options: string[]; required?: boolean }) {
  return <label className="report-field"><span>{label}{required && <i> *</i>}</span><select value={value} onChange={event => onChange(event.target.value)}><option value="">Select</option>{options.map(option => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function TextArea({ label, value, onChange, required = false }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return <label className="report-field"><span>{label}{required && <i> *</i>}</span><textarea value={value} onChange={event => onChange(event.target.value)} /></label>;
}

const formatNumber = (value: string | number) => Number.isFinite(Number(value)) ? new Intl.NumberFormat('en-IN', { maximumFractionDigits: 6 }).format(Number(value)) : '—';

export default function TestReportWorkflow() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(blank);
  const [existingInstruments, setExistingInstruments] = useState<any[]>([]);
  const [selectedInstrumentId, setSelectedInstrumentId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [submittedReportId, setSubmittedReportId] = useState('');
  const set = (key: keyof Form, value: string | string[]) => setForm(current => ({ ...current, [key]: value, ...(key === 'softwareVersion' ? { software: value as string } : {}) }));
  useEffect(() => { void axios.get('/instruments').then(response => setExistingInstruments(response.data.instruments || [])).catch(() => {}); }, []);
  const selectExistingInstrument = async (id: string) => {
    setSelectedInstrumentId(id);
    if (!id) return;
    try {
      const response = await axios.get(`/instruments/${id}`);
      const instrument = response.data.instrument;
       setForm(current => ({ ...current, manufacturer: instrument.manufacturer, model: instrument.typeDesignation, serial: instrument.serialNumber, accuracyClass: instrument.accuracyClass, indication: instrument.indicationType, unit: instrument.unit || 'g', min: String(instrument.min), max: String(instrument.max), e: String(instrument.e), d: String(instrument.d), software: instrument.softwareVersion || '', loadCell: instrument.loadCellInformation || '', interfaces: instrument.interfaces ? String(instrument.interfaces).split(',').map((value: string) => value.trim()).filter(Boolean) : [], notes: instrument.additionalInformation || '', rangeType: instrument.rangeType, intervalType: instrument.intervalType, tareDevice: instrument.tareDevice, multipleIndicatingDevices: instrument.multipleIndicatingDevices ? 'Yes' : 'No', loadReceptorType: instrument.loadReceptorType, numberOfSupportPoints: instrument.numberOfSupportPoints == null ? '' : String(instrument.numberOfSupportPoints), usesElectricPower: instrument.usesElectricPower ? 'Yes' : 'No', powerSupplyType: instrument.powerSupplyType, mobileInstrument: instrument.mobileInstrument ? 'Yes' : 'No', portableRoadVehicleInstrument: instrument.portableRoadVehicleInstrument ? 'Yes' : 'No', rollingLoad: instrument.rollingLoad == null ? '' : instrument.rollingLoad ? 'Yes' : 'No', zeroSettingMethod: instrument.zeroSettingMethod || '', zeroTracking: instrument.zeroTracking == null ? '' : instrument.zeroTracking ? 'Yes' : 'No', zeroIndicatingDevice: instrument.zeroIndicatingDevice == null ? '' : instrument.zeroIndicatingDevice ? 'Yes' : 'No', digitalIndication: instrument.digitalIndication == null ? '' : instrument.digitalIndication ? 'Yes' : 'No', stableEquilibriumFunction: instrument.stableEquilibriumFunction == null ? '' : instrument.stableEquilibriumFunction ? 'Yes' : 'No', printingCapability: instrument.printingCapability == null ? '' : instrument.printingCapability ? 'Yes' : 'No', dataStorageCapability: instrument.dataStorageCapability == null ? '' : instrument.dataStorageCapability ? 'Yes' : 'No', zeroSettingCapability: instrument.zeroSettingCapability == null ? '' : instrument.zeroSettingCapability ? 'Yes' : 'No', tareCapability: instrument.tareCapability == null ? '' : instrument.tareCapability ? 'Yes' : 'No', differentiatedScaleDivisions: instrument.differentiatedScaleDivisions == null ? '' : instrument.differentiatedScaleDivisions ? 'Yes' : 'No', tiltConfiguration: instrument.tiltConfiguration == null ? '' : instrument.tiltConfiguration ? 'Yes' : 'No', hasLevelIndicator: instrument.hasLevelIndicator == null ? '' : instrument.hasLevelIndicator ? 'Yes' : 'No', hasAutomaticTiltSensor: instrument.hasAutomaticTiltSensor == null ? '' : instrument.hasAutomaticTiltSensor ? 'Yes' : 'No', manufacturerTiltLimit: instrument.manufacturerTiltLimit == null ? '' : String(instrument.manufacturerTiltLimit), mobileOutdoorUse: instrument.mobileOutdoorUse == null ? '' : instrument.mobileOutdoorUse ? 'Yes' : 'No', powerSourceType: instrument.powerSourceType || '', nominalVoltage: instrument.nominalVoltage == null ? '' : String(instrument.nominalVoltage), minimumOperatingVoltage: instrument.minimumOperatingVoltage == null ? '' : String(instrument.minimumOperatingVoltage), maximumVoltage: instrument.maximumVoltage == null ? '' : String(instrument.maximumVoltage), specifiedVoltageMin: instrument.specifiedVoltageRange?.min == null ? '' : String(instrument.specifiedVoltageRange.min), specifiedVoltageMax: instrument.specifiedVoltageRange?.max == null ? '' : String(instrument.specifiedVoltageRange.max), threePhaseSupply: instrument.threePhaseSupply == null ? '' : instrument.threePhaseSupply ? 'Yes' : 'No', rechargeableBattery: instrument.rechargeableBattery == null ? '' : instrument.rechargeableBattery ? 'Yes' : 'No', rechargeableBatteryCanChargeDuringOperation: instrument.rechargeableBatteryCanChargeDuringOperation == null ? '' : instrument.rechargeableBatteryCanChargeDuringOperation ? 'Yes' : 'No', specifiedMinimumTemperature: instrument.specifiedMinimumTemperature == null ? '' : String(instrument.specifiedMinimumTemperature), specifiedMaximumTemperature: instrument.specifiedMaximumTemperature == null ? '' : String(instrument.specifiedMaximumTemperature), manufacturerReferenceTemperature: instrument.manufacturerReferenceTemperature == null ? '' : String(instrument.manufacturerReferenceTemperature) }));
      setError('');
    } catch (e: any) { setError(e.response?.data?.message || 'Unable to load the selected instrument.'); }
  };
  useEffect(() => { const id = searchParams.get('instrumentId'); if (id) { setStep(0); void selectExistingInstrument(id); } }, [searchParams]);
  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email);
  const applicationInvalid = !form.organization.trim() || !form.contactName.trim() || !emailValid || !/^\d{10}$/.test(form.phone) || !form.address.trim() || (form.referenceMode === 'external' && !form.externalReference.trim());
  const min = Number(form.min); const max = Number(form.max); const eValue = Number(form.e); const dValue = Number(form.d);
  const calculatedN = Number.isFinite(max) && max > 0 && Number.isFinite(eValue) && eValue > 0 ? max / eValue : NaN;
  const scaleInterval = validateScaleIntervals({ accuracyClass: form.accuracyClass, e: form.e, d: form.d, unit: form.unit });
  const scaleError = form.e.trim() && form.d.trim() && !scaleInterval.valid ? SCALE_INTERVAL_ERROR : undefined;
  const instrumentInvalid = !form.manufacturer.trim() || !form.model.trim() || !form.serial.trim() || !accuracyClasses.includes(form.accuracyClass) || !indicationTypes.includes(form.indication) || form.min.trim() === '' || form.max.trim() === '' || form.e.trim() === '' || form.d.trim() === '' || !Number.isFinite(min) || min < 0 || !Number.isFinite(max) || max <= 0 || max <= min || !Number.isFinite(eValue) || eValue <= 0 || !Number.isFinite(dValue) || dValue <= 0 || !Number.isInteger(calculatedN) || calculatedN <= 0 || !scaleInterval.valid;
  const configurationInvalid = !['single-range', 'multiple-range'].includes(form.rangeType) || !['single-interval', 'multi-interval'].includes(form.intervalType) || !yesNo.includes(form.tareDevice) || !yesNo.includes(form.multipleIndicatingDevices) || !['normal platform', 'other / special configuration'].includes(form.loadReceptorType) || (form.numberOfSupportPoints.trim() !== '' && (!Number.isInteger(Number(form.numberOfSupportPoints)) || Number(form.numberOfSupportPoints) < 0)) || !yesNo.includes(form.usesElectricPower) || !['AC mains', 'DC / battery', 'Other', 'Not specified'].includes(form.powerSupplyType) || !yesNo.includes(form.mobileInstrument) || !yesNo.includes(form.portableRoadVehicleInstrument) || !yesNo.includes(form.rollingLoad) || !['Non-automatic', 'Semi-automatic', 'Automatic'].includes(form.zeroSettingMethod) || !yesNo.includes(form.zeroTracking) || !yesNo.includes(form.zeroIndicatingDevice) || !yesNo.includes(form.digitalIndication) || !yesNo.includes(form.stableEquilibriumFunction) || !yesNo.includes(form.printingCapability) || !yesNo.includes(form.dataStorageCapability) || !yesNo.includes(form.zeroSettingCapability) || !yesNo.includes(form.tareCapability) || !yesNo.includes(form.differentiatedScaleDivisions);
  const generate = async () => {
    try { const response = await axios.post('/test-reports/application-number'); set('applicationNumber', response.data.applicationNumber); setError(''); }
    catch { setError('Unable to generate an application number right now.'); }
  };

  const next = () => {
    setError('');
    if (step === 0 && applicationInvalid) return setError('Complete the required Application fields. Check the email and enter a 10-digit Indian phone number.');
    if (step === 1 && instrumentInvalid) return setError(scaleError || 'Complete the instrument fields and use valid values: Max must be greater than Min, and Max ÷ e must be a whole number.');
    if (step === 2 && configurationInvalid) return setError('Complete the required Instrument Configuration selections before continuing.');
    if (step < 3) return setStep(current => current + 1);
    void submit();
  };

  const submit = async () => {
    if (applicationInvalid || instrumentInvalid || configurationInvalid) return setError('Please complete the Application, Instrument, and Instrument Configuration sections before submitting.');
    setBusy(true);
    try {
      const response = await axios.post('/test-reports', { controlStage: form.controlStage,
        applicationNumber: form.applicationNumber,
        externalApplicationReference: form.externalReference,
        referenceSource: form.referenceMode,
        applicant: { name: form.organization, contactName: form.contactName, email: form.email, contactNumber: `+91 ${form.phone}`, address: form.address },
        manufacturer: { name: form.manufacturer, address: form.address },
        instrumentId: selectedInstrumentId || undefined,
        instrument: { typeDesignation: form.model, accuracyClass: form.accuracyClass, indicationType: form.indication, zeroSettingMethod: form.zeroSettingMethod, zeroTracking: form.zeroTracking === 'Yes', zeroIndicatingDevice: form.zeroIndicatingDevice === 'Yes', digitalIndication: form.digitalIndication === 'Yes', unit: form.unit, min, max, e: eValue, d: dValue, n: calculatedN, serialNumber: form.serial, softwareVersion: form.software, loadCellInformation: form.loadCell, additionalInformation: form.notes, tareDevice: form.tareDevice, rangeType: form.rangeType, intervalType: form.intervalType, multipleIndicatingDevices: form.multipleIndicatingDevices === 'Yes', loadReceptorType: form.loadReceptorType, numberOfSupportPoints: form.numberOfSupportPoints.trim() === '' ? undefined : Number(form.numberOfSupportPoints), usesElectricPower: form.usesElectricPower === 'Yes', powerSupplyType: form.powerSupplyType, mobileInstrument: form.mobileInstrument === 'Yes', portableRoadVehicleInstrument: form.portableRoadVehicleInstrument === 'Yes', rollingLoad: form.rollingLoad === 'Yes', stableEquilibriumFunction: form.stableEquilibriumFunction === 'Yes', printingCapability: form.printingCapability === 'Yes', dataStorageCapability: form.dataStorageCapability === 'Yes', zeroSettingCapability: form.zeroSettingCapability === 'Yes', tareCapability: form.tareCapability === 'Yes', differentiatedScaleDivisions: form.differentiatedScaleDivisions === 'Yes', tiltConfiguration: form.tiltConfiguration === '' ? undefined : form.tiltConfiguration === 'Yes', hasLevelIndicator: form.hasLevelIndicator === '' ? undefined : form.hasLevelIndicator === 'Yes', hasAutomaticTiltSensor: form.hasAutomaticTiltSensor === '' ? undefined : form.hasAutomaticTiltSensor === 'Yes', manufacturerTiltLimit: form.manufacturerTiltLimit.trim() === '' ? undefined : Number(form.manufacturerTiltLimit), mobileOutdoorUse: form.mobileOutdoorUse === '' ? undefined : form.mobileOutdoorUse === 'Yes', powerSourceType: form.powerSourceType || undefined, nominalVoltage: form.nominalVoltage.trim() === '' ? undefined : Number(form.nominalVoltage), minimumOperatingVoltage: form.minimumOperatingVoltage.trim() === '' ? undefined : Number(form.minimumOperatingVoltage), maximumVoltage: form.maximumVoltage.trim() === '' ? undefined : Number(form.maximumVoltage), specifiedVoltageRange: form.specifiedVoltageMin.trim() === '' && form.specifiedVoltageMax.trim() === '' ? undefined : { min: form.specifiedVoltageMin.trim() === '' ? undefined : Number(form.specifiedVoltageMin), max: form.specifiedVoltageMax.trim() === '' ? undefined : Number(form.specifiedVoltageMax) }, threePhaseSupply: form.threePhaseSupply === '' ? undefined : form.threePhaseSupply === 'Yes', rechargeableBattery: form.rechargeableBattery === '' ? undefined : form.rechargeableBattery === 'Yes', rechargeableBatteryCanChargeDuringOperation: form.rechargeableBatteryCanChargeDuringOperation === '' ? undefined : form.rechargeableBatteryCanChargeDuringOperation === 'Yes', specifiedMinimumTemperature: form.specifiedMinimumTemperature.trim() === '' ? undefined : Number(form.specifiedMinimumTemperature), specifiedMaximumTemperature: form.specifiedMaximumTemperature.trim() === '' ? undefined : Number(form.specifiedMaximumTemperature), manufacturerReferenceTemperature: form.manufacturerReferenceTemperature.trim() === '' ? undefined : Number(form.manufacturerReferenceTemperature) },
        testEquipment: [],
      });
      const createdReportId = response.data.report.testReportId;
      setSubmittedReportId(createdReportId);
      window.setTimeout(() => nav(`/tester/reports/${createdReportId}`), 900);
    } catch (submissionError: any) { setError(submissionError.response?.data?.message || 'Unable to submit the report.'); }
    finally { setBusy(false); }
  };

  if (submittedReportId) return <main className="report-page"><section className="report-card report-submitted"><div className="report-title"><span>REPORT SUBMITTED</span><h1>Report Submitted</h1><p>Your test report has been created successfully. Opening the report workspace…</p></div><div className="submitted-reference"><small>Test Report Number</small><strong>{submittedReportId}</strong></div></section></main>;
  const stepDescription = step === 0 ? 'Application and submission information.' : step === 1 ? 'Static instrument identification and technical characteristics.' : step === 2 ? 'Configuration characteristics used to determine the applicable OIML test route.' : 'Confirm the report setup before creating the test report.';
   return <main className="report-page"><header className="report-header"><Link to="/tester/dashboard">← Back to dashboard</Link><h1>New Test Report</h1><p>Prepare the application and instrument record before Verification.</p></header><div className="report-steps">{steps.map((name, index) => <button type="button" key={name} className={index === step ? 'current' : ''} disabled><span>{index + 1}</span>{name}</button>)}</div><section className="report-card"><div className="report-title"><span>STEP {step + 1} OF {steps.length} · REPORT SETUP</span><h2>{steps[step]}</h2><p>{stepDescription}</p></div>{step === 1 && existingInstruments.length > 0 && <div className="existing-instrument-picker"><label><span>Select Existing Instrument</span><select value={selectedInstrumentId} onChange={event => void selectExistingInstrument(event.target.value)}><option value="">Register a new instrument</option>{existingInstruments.map(item => <option key={item.instrument._id} value={item.instrument._id}>{item.instrument.typeDesignation} · {item.instrument.serialNumber}</option>)}</select></label>{selectedInstrumentId && <small>Using the persistent instrument record; its characteristics are loaded automatically.</small>}</div>}
    {step === 0 && <><h3>Application reference</h3><div className="reference-choice"><button type="button" className={form.referenceMode === 'generated' ? 'selected' : ''} onClick={() => { set('referenceMode', 'generated'); set('externalReference', ''); }}><strong>Generate internal reference</strong><small>Assigned securely by NAWI.</small></button><button type="button" className={form.referenceMode === 'external' ? 'selected' : ''} onClick={() => { set('referenceMode', 'external'); set('applicationNumber', ''); }}><strong>Use external reference</strong><small>Enter a reference supplied by another system.</small></button></div>{form.referenceMode === 'generated' ? <div className="application-number-option"><div><strong>Internal application number</strong><small>Generated from the secure server counter.</small>{form.applicationNumber && <b>{form.applicationNumber}</b>}</div><button type="button" className="secondary" onClick={generate}>{form.applicationNumber ? 'Generate another' : 'Generate application number'}<Plus /></button></div> : <div className="report-fields"><Field label="External Application / Submission Reference" value={form.externalReference} onChange={value => set('externalReference', value)} required={false} /></div>}<h3>Applicant / manufacturer</h3><div className="report-fields"><Field label="Manufacturer / Applicant Organization" value={form.organization} onChange={value => set('organization', value)} /><Field label="Contact Person Name" value={form.contactName} onChange={value => set('contactName', value)} /><Field label="Email" type="email" value={form.email} onChange={value => set('email', value)} /><label className="report-field"><span>Phone <i> *</i></span><div className="combined-phone"><span aria-hidden="true">🇮🇳</span><b>+91</b><input inputMode="numeric" maxLength={10} value={form.phone} onChange={event => set('phone', event.target.value.replace(/\D/g, ''))} placeholder="10-digit mobile number" /></div>{form.phone.length > 0 && form.phone.length !== 10 && <small className="field-error">Please enter a valid 10-digit Indian mobile number.</small>}</label><TextArea label="Address" value={form.address} onChange={value => set('address', value)} required /></div>{form.email.length > 0 && !emailValid && <small className="field-error">Please enter a valid email address.</small>}</>}
    {step === 1 && <><h3>Instrument identification</h3><div className="report-fields"><Field label="Manufacturer" value={form.manufacturer} onChange={value => set('manufacturer', value)} /><Field label="Type Designation / Model" value={form.model} onChange={value => set('model', value)} /><Field label="Serial Number" value={form.serial} onChange={value => set('serial', value)} /><SelectField label="Accuracy Class" value={form.accuracyClass} onChange={value => set('accuracyClass', value)} options={accuracyClasses} /><SelectField label="Indication Type" value={form.indication} onChange={value => set('indication', value)} options={indicationTypes} /><SelectField label="Instrument Mass Unit" value={form.unit} onChange={value => set('unit', value)} options={massUnits} /></div><h3>Metrological characteristics ({form.unit})</h3><div className="report-fields"><Field label={`Min (${form.unit})`} type="number" min="0" step="any" value={form.min} onChange={value => set('min', value)} /><Field label={`Max (${form.unit})`} type="number" min="0" step="any" value={form.max} onChange={value => set('max', value)} /><Field label={`e (${form.unit})`} type="number" min="0" step="any" value={form.e} onChange={value => set('e', value)} /><Field label={`d (${form.unit})`} type="number" min="0" step="any" value={form.d} onChange={value => set('d', value)} error={scaleError} /><label className="report-field"><span>Number of verification scale intervals (n)</span><input type="text" value={Number.isInteger(calculatedN) ? formatNumber(calculatedN) : ''} readOnly placeholder="Calculated from Max ÷ e" /><small className="field-help">Calculated from Max ÷ e; n is dimensionless and is not entered manually.</small></label></div><h3>Software &amp; electronics</h3><div className="report-fields"><Field label="Software / Firmware Version" required={false} value={form.software} onChange={value => set('softwareVersion', value)} /><Field label="Load Cell / Weighing Module Information" required={false} value={form.loadCell} onChange={value => set('loadCell', value)} /><TextArea label="Additional Technical Information / Notes" value={form.notes} onChange={value => set('notes', value)} /></div></>}
     {step === 2 && <><h3>Range and interval configuration</h3><div className="report-fields"><SelectField label="Range Configuration" value={form.rangeType} onChange={value => set('rangeType', value)} options={['single-range', 'multiple-range']} /><SelectField label="Interval Configuration" value={form.intervalType} onChange={value => set('intervalType', value)} options={['single-interval', 'multi-interval']} /></div><h3>Zero-setting characteristics</h3><div className="report-fields"><SelectField label="Zero-setting Method" value={form.zeroSettingMethod} onChange={value => set('zeroSettingMethod', value)} options={['Non-automatic', 'Semi-automatic', 'Automatic']} /><SelectField label="Zero-tracking" value={form.zeroTracking} onChange={value => set('zeroTracking', value)} options={yesNo} /><SelectField label="Zero-indicating Device" value={form.zeroIndicatingDevice} onChange={value => set('zeroIndicatingDevice', value)} options={yesNo} /><SelectField label="Digital Indication" value={form.digitalIndication} onChange={value => set('digitalIndication', value)} options={yesNo} /></div><h3>Instrument devices and construction</h3><div className="report-fields"><SelectField label="Tare Device" value={form.tareDevice} onChange={value => set('tareDevice', value)} options={yesNo} /><SelectField label="Multiple Indicating Devices" value={form.multipleIndicatingDevices} onChange={value => set('multipleIndicatingDevices', value)} options={yesNo} /><SelectField label="Load Receptor Configuration" value={form.loadReceptorType} onChange={value => set('loadReceptorType', value)} options={['normal platform', 'other / special configuration']} /><Field label="Number of Support Points" type="number" min="0" step="1" required={false} value={form.numberOfSupportPoints} onChange={value => set('numberOfSupportPoints', value)} /></div><h3>Power and mobility</h3><div className="report-fields"><SelectField label="Electrically Powered" value={form.usesElectricPower} onChange={value => set('usesElectricPower', value)} options={yesNo} /><SelectField label="Power Supply" value={form.powerSupplyType} onChange={value => set('powerSupplyType', value)} options={['AC mains', 'DC / battery', 'Other', 'Not specified']} /><SelectField label="Mobile Instrument" value={form.mobileInstrument} onChange={value => set('mobileInstrument', value)} options={yesNo} /><SelectField label="Portable Road-Vehicle Weighbridge" value={form.portableRoadVehicleInstrument} onChange={value => set('portableRoadVehicleInstrument', value)} options={yesNo} /><SelectField label="Rolling-load Instrument" value={form.rollingLoad} onChange={value => set('rollingLoad', value)} options={yesNo} /></div><h3>Stable-equilibrium capabilities</h3><div className="report-fields"><SelectField label="Stable-equilibrium Function" value={form.stableEquilibriumFunction} onChange={value => set('stableEquilibriumFunction', value)} options={yesNo} /><SelectField label="Printing Capability" value={form.printingCapability} onChange={value => set('printingCapability', value)} options={yesNo} /><SelectField label="Data-storage Capability" value={form.dataStorageCapability} onChange={value => set('dataStorageCapability', value)} options={yesNo} /><SelectField label="Zero-setting Capability" value={form.zeroSettingCapability} onChange={value => set('zeroSettingCapability', value)} options={yesNo} /><SelectField label="Tare Capability" value={form.tareCapability} onChange={value => set('tareCapability', value)} options={yesNo} /><SelectField label="Differentiated Scale Divisions" value={form.differentiatedScaleDivisions} onChange={value => set('differentiatedScaleDivisions', value)} options={yesNo} /></div><p className="field-help">Influence-factor characteristics are inherited from the selected instrument and used when A.5 begins. Test-specific conditions are recorded in the A.5 workspace.</p></>}
    {step === 3 && <div className="setup-review">
      <ReviewCard eyebrow="01" title="Application & Applicant" meta={form.referenceMode === 'external' ? form.externalReference : form.applicationNumber || 'Generated on submission'}>
        <ReviewProperty label="Application reference" value={form.referenceMode === 'external' ? form.externalReference : form.applicationNumber || 'Generated on submission'} emphasis />
        <ReviewProperty label="Applicant / manufacturer organization" value={form.organization} emphasis />
        <ReviewProperty label="Contact person" value={form.contactName} />
        <ReviewProperty label="Email" value={form.email} />
        <ReviewProperty label="Phone" value={form.phone ? `+91 ${form.phone}` : ''} />
        <ReviewProperty label="Address" value={form.address} wide />
      </ReviewCard>
      <ReviewCard eyebrow="02" title="Instrument" meta={form.model}>
        <ReviewProperty label="Manufacturer" value={form.manufacturer} />
        <ReviewProperty label="Model / type designation" value={form.model} emphasis />
        <ReviewProperty label="Serial number" value={form.serial} emphasis />
        <ReviewProperty label="Accuracy class" value={form.accuracyClass} emphasis />
        <ReviewProperty label="Indication type" value={form.indication} />
        <ReviewProperty label="Instrument mass unit" value={form.unit} />
        <ReviewProperty label="Min" value={`${formatNumber(min)} ${form.unit}`} emphasis />
        <ReviewProperty label="Max" value={`${formatNumber(max)} ${form.unit}`} emphasis />
        <ReviewProperty label="e" value={`${formatNumber(eValue)} ${form.unit}`} emphasis />
        <ReviewProperty label="d" value={`${formatNumber(dValue)} ${form.unit}`} emphasis />
        <ReviewProperty label="n" value={formatNumber(calculatedN)} emphasis />
        <ReviewProperty label="Software / firmware" value={form.software} />
        <ReviewProperty label="Load cell / module" value={form.loadCell} />
        <ReviewProperty label="Notes" value={form.notes} wide />
      </ReviewCard>
      <ReviewCard eyebrow="03" title="Instrument Configuration" meta="Persisted setup values">
        <ReviewProperty label="Range" value={reviewOption(form.rangeType)} />
        <ReviewProperty label="Interval" value={reviewOption(form.intervalType)} />
        <ReviewProperty label="Tare device" value={form.tareDevice} />
        <ReviewProperty label="Multiple indicating devices" value={form.multipleIndicatingDevices} />
        <ReviewProperty label="Load receptor" value={form.loadReceptorType === 'normal platform' ? 'Platform' : reviewOption(form.loadReceptorType)} />
        <ReviewProperty label="Support points" value={form.numberOfSupportPoints || 'Not specified'} />
        <ReviewProperty label="Electrical supply" value={form.usesElectricPower} />
        <ReviewProperty label="Power source" value={form.powerSupplyType} />
        <ReviewProperty label="Mobile" value={form.mobileInstrument} />
        <ReviewProperty label="Road-vehicle" value={form.portableRoadVehicleInstrument} />
      </ReviewCard>
      <ReviewCard eyebrow="04" title="Technical / Verification Context" meta={form.controlStage}>
        <ReviewProperty label="Zero-setting method" value={form.zeroSettingMethod} />
        <ReviewProperty label="Zero-tracking" value={form.zeroTracking} />
        <ReviewProperty label="Zero-indicating device" value={form.zeroIndicatingDevice} />
        <ReviewProperty label="Digital indication" value={form.digitalIndication} />
        <ReviewProperty label="Stable-equilibrium function" value={form.stableEquilibriumFunction} />
        <ReviewProperty label="Printing capability" value={form.printingCapability} />
        <ReviewProperty label="Data-storage capability" value={form.dataStorageCapability} />
        <ReviewProperty label="Zero-setting capability" value={form.zeroSettingCapability} />
        <ReviewProperty label="Tare capability" value={form.tareCapability} />
        <ReviewProperty label="Differentiated scale divisions" value={form.differentiatedScaleDivisions} />
        <ReviewProperty label="Influence-factor characteristics" value="Inherited from the selected instrument; reviewed in A.5." wide />
      </ReviewCard>
    </div>}
    {error && <div className="error">{error}</div>}<div className="report-actions">{step > 0 && <button className="secondary" onClick={() => setStep(current => current - 1)}><ArrowLeft />Back</button>}<button className="primary" disabled={busy} onClick={next}>{busy ? step === 3 ? 'Submitting…' : 'Saving…' : step === 1 ? 'Continue to Configuration' : step === 2 ? 'Save & Continue to Review' : step === 3 ? 'Submit Report' : 'Continue'}{step === 3 ? <Check /> : <ArrowRight />}</button></div></section></main>;
}
