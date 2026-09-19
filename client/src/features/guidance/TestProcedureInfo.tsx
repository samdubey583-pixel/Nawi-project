import { ChevronDown, ExternalLink, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import './test-procedure-info.css';

const OIML_SOURCE = 'https://www.oiml.org/en/files/pdf_r/r076-1-e06.pdf';

type GuidanceConfiguration = Record<string, unknown>;

type Guidance = {
  about: string;
  procedure: string[];
  automatic: string[];
  evaluation: string;
  reference: string;
};

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function mathText(value: string): ReactNode {
  const parts = value.split(/(ΔL₀|I₀|E₀|E_c|Ec|I0|E0|ΔL0)/g);
  return parts.map((part, index) => {
    if (part === 'ΔL₀' || part === 'ΔL0') return <span className="math-variable" aria-label="delta L sub zero" key={index}>ΔL<sub>0</sub></span>;
    if (part === 'I₀' || part === 'I0') return <span className="math-variable" aria-label="I sub zero" key={index}>I<sub>0</sub></span>;
    if (part === 'E₀' || part === 'E0') return <span className="math-variable" aria-label="E sub zero" key={index}>E<sub>0</sub></span>;
    if (part === 'E_c' || part === 'Ec') return <span className="math-variable" aria-label="E sub c" key={index}>E<sub>c</sub></span>;
    return <span key={index}>{part}</span>;
  });
}

function isTrue(value: unknown): boolean {
  return value === true || value === 'Yes' || value === 'YES';
}

function indicationType(configuration: GuidanceConfiguration): string {
  return text(configuration.indicationType).toLowerCase().replace(/[_-]/g, ' ');
}

function getZeroSettingGuidance(configuration: GuidanceConfiguration): Guidance {
  const method = text(configuration.zeroSettingMethod).toLowerCase();
  if (method.includes('automatic')) {
    return {
      about: 'A.4.2.1.3 covers the zero-setting range of an automatic zero-setting device.',
      procedure: [
        'Apply the load used to bring the instrument to zero.',
        'Remove weights in small amounts and allow the automatic device time to restore the zero indication after each removal.',
        'Record the maximum load that can be removed while the device still resets the indication to zero.',
        'Record the next removal that does not restore zero, together with any operator notes.',
      ],
      automatic: ['The maximum successful removal is recorded as the observed automatic zero-setting range.', 'The application does not infer physical operation or turn the observation into a conformity result by itself.'],
      evaluation: 'Keep the observed range, the applicable requirement, and the final conformity assessment distinct.',
      reference: 'OIML R 76-1:2006 Annex A A.4.2.1.3; §4.5.1',
    };
  }
  if (method.includes('semi')) {
    return {
      about: 'A.4.2.1.2 covers the zero-setting range for a semi-automatic zero-setting device.',
      procedure: ['Use the configured semi-automatic zero-setting control.', 'Record the applicable observed zero-setting range and the physical result.', 'Keep the instrument in the required reference condition while recording the observation.'],
      automatic: ['The tester supplies the physical observation; no range is fabricated by the application.'],
      evaluation: 'Record the observed result separately from the applicable requirement and conformity assessment.',
      reference: 'OIML R 76-1:2006 Annex A A.4.2.1.2; §4.5.1',
    };
  }
  return {
    about: 'A.4.2.1.1 covers the initial zero-setting range for a non-automatic arrangement.',
    procedure: ['Empty the load receptor and set the instrument to zero using the applicable configured procedure.', 'Apply and remove the relevant load portions as required by the procedure.', 'Record the positive and negative portions only where they apply to the configured zero-setting arrangement.'],
    automatic: ['The tester supplies the physical observation; the application retains the configured method.'],
    evaluation: 'Record the observed range separately from the applicable requirement and conformity assessment.',
    reference: 'OIML R 76-1:2006 Annex A A.4.2.1.1; §4.5.1',
  };
}

function a412Guidance(configuration: GuidanceConfiguration): Guidance {
  const operations = Array.isArray(configuration.activeOperations) ? configuration.activeOperations.map(text).filter(Boolean) : [];
  const printing = isTrue(configuration.printingCapability) || operations.includes('PRINT');
  const storage = isTrue(configuration.dataStorageCapability) || operations.includes('STORE');
  const zero = isTrue(configuration.zeroSettingCapability) || isTrue(configuration.zeroSetting) || operations.includes('ZERO');
  const tare = isTrue(configuration.tareCapability) || isTrue(configuration.tareDevice) || operations.includes('TARE');
  const mobile = isTrue(configuration.mobileInstrument) || isTrue(configuration.mobile);
  const functionNames = [printing && 'printing', storage && 'data storage', zero && 'zero-setting', tare && 'tare'].filter(Boolean).join(', ');
  const procedure = [
    'Review the manufacturer documentation for the stable-equilibrium principle, criteria, adjustable and non-adjustable parameters, parameter security, and worst-case adjustment.',
  ];
  if (printing || storage) procedure.push('After one deliberate disturbance, initiate each configured print or storage function immediately and observe the indication for five seconds.');
  if (zero) procedure.push('For the configured zero-setting function, verify the required stable-equilibrium behavior and retain the linked A.4.2.3 evidence for the five repetitions.');
  if (tare) procedure.push('For the configured tare function, verify the required stable-equilibrium behavior and retain the linked A.4.6.2 evidence for the five repetitions.');
  if (mobile) procedure.push('Use the applicable mobile/vehicle branch only when the persisted instrument configuration requires it.');
  if (!printing && !storage && !zero && !tare && !mobile) procedure.push('No function-specific execution branch is configured; resolve the required stable-equilibrium capabilities before execution.');
  return {
    about: functionNames ? `Stable equilibrium is examined for the configured functions: ${functionNames}.` : 'Stable-equilibrium capabilities are not fully configured for this report.',
    procedure,
    automatic: [
      printing || storage ? 'For print/storage, the five-second observation uses the actual indication sequence and printed or stored value.' : 'No print/storage branch is shown because those capabilities are not configured.',
      zero || tare ? 'Zero-setting and tare accuracy use the existing A.4.2.3 and A.4.6.2 evidence; no duplicate calculation is created.' : 'No zero-setting or tare branch is shown because those capabilities are not configured.',
      mobile ? 'The mobile branch is configuration-driven.' : 'The mobile/vehicle branch is not applicable to this configuration.',
    ],
    evaluation: printing || storage ? 'Stable equilibrium for the print/storage case is satisfied when no more than two adjacent indicated values are present, one of which is the printed value. For differentiated scale divisions, the comparison interval is e rather than d. Other branches are evaluated from their recorded function behavior and linked source evidence.' : 'Evaluate only the configured branches. Do not infer a print/storage result when those functions are absent.',
    reference: 'OIML R 76-1:2006 §4.4.2; Annex A A.4.12',
  };
}

export function getTestProcedureGuidance(testId: string, configuration: GuidanceConfiguration = {}): Guidance | null {
  switch (testId) {
    case 'A.4.2':
    case 'A.4.2.1': return getZeroSettingGuidance(configuration);
    case 'A.4.2.2': return { about: 'A.4.2.2 examines the zero-indicating device using the configured indication arrangement.', procedure: ['Use the applicable zero-indicating device and record the actual observed indication changes.', 'Record the observed lower and upper zero range where required by the configured device.'], automatic: ['The application stores observations and derives configured calculation values; it does not fabricate indication changes.'], evaluation: 'Use the applicable A.4.2 requirement and preserve observed evidence separately from conformity assessment.', reference: 'OIML R 76-1:2006 Annex A A.4.2.2' };
    case 'A.4.2.3': return { about: 'A.4.2.3 determines the accuracy of zero-setting using the applicable zero reference and weighing evidence.', procedure: ['Establish the applicable zero reference.', 'Record the physical changeover observations required by the configured procedure.', 'Allow the shared weighing/error service to derive P, E, E₀, E_c and MPE where applicable.'], automatic: ['The canonical weighing calculation and MPE services remain the source of calculated values.'], evaluation: 'Use the existing A.4.4.3 calculation basis and applicable MPE rule; do not manually select the result.', reference: 'OIML R 76-1:2006 Annex A A.4.2.3' };
    case 'A.4.3': return { about: 'A.4.3 checks setting to zero before loading using the applicable zero-setting evidence.', procedure: ['Use the applicable configured zero-setting procedure.', 'Confirm the zero reference before loading where the route requires it.', 'Record only physical observations that are not already supplied by the source zero-setting test.'], automatic: ['The existing A.4.2.3 source result is reused where the application marks this procedure as derived.'], evaluation: 'The route result is derived from the applicable source evidence and configured procedure.', reference: 'OIML R 76-1:2006 Annex A A.4.3' };
    case 'A.4.4': return { about: 'A.4.4 establishes weighing performance from the configured load plan and physical observations.', procedure: ['Follow the progressive loading and unloading plan shown by the application.', 'Record the actual load, indication and changeover observations in the selected observation unit.', 'Allow the shared service to calculate P, E, E₀, E_c and the applicable MPE.'], automatic: ['Recommended loads are system recommendations; actual tester-entered loads remain independent.', 'Units are normalized before calculation.'], evaluation: 'The existing A.4.4.3 path and canonical R76 MPE engine determine the weighing result.', reference: 'OIML R 76-1:2006 Annex A A.4.4; A.4.4.3' };
    case 'A.4.5': return { about: 'A.4.5 compares multiple indicating devices during the A.4.4 weighing observations.', procedure: ['Use the persisted A.4.4 observation set.', 'Compare indications corresponding to the same weighing observation and configured devices.'], automatic: ['No additional weighing sequence is required.', 'The comparison is derived from source observation IDs and configured device identities.'], evaluation: 'The comparison result is calculated under the applicable R76 permissible-difference rule; it is not a duplicate A.4.4 test.', reference: 'OIML R 76-1:2006 §3.6.3; Annex A A.4.5' };
    case 'A.4.6': return { about: 'A.4.6 examines tare operation using the configured tare device and operation.', procedure: ['Use the configured tare operation and record the actual tare observations.', 'Follow the applicable load and unloading sequence shown by the workspace.', 'Use the existing tare and shared weighing calculation services.'], automatic: ['The configured tare type, mode and device determine the applicable branch.'], evaluation: 'Evaluate the persisted tare observations with the existing calculation and MPE services.', reference: 'OIML R 76-1:2006 Annex A A.4.6' };
    case 'A.4.7': {
      const method = text(configuration.method);
      const supports = Number(configuration.supportPointCount);
      if (method.includes('A.4.7.1') || supports > 0 && supports <= 4) return { about: 'A.4.7.1 applies to a load receptor with not more than four points of support.', procedure: ['Use the applicable quarter-segment positions shown by the workspace.', 'Apply the same test load at each required position and record each physical observation.'], automatic: ['The position plan comes from the applicability engine; the application does not infer unrecorded geometry.'], evaluation: 'Each position uses the existing weighing/error/MPE calculation path after accounting for the applicable zero deviation.', reference: 'OIML R 76-1:2006 Annex A A.4.7.1' };
      if (method.includes('A.4.7.2') || supports > 4) return { about: 'A.4.7.2 applies to a load receptor with more than four points of support.', procedure: ['Use the logical support-position plan generated from the configured support count.', 'Apply the same test load at each distinct support area and record the actual observations.'], automatic: ['Each marker represents the applicable support area; physical coordinates are not invented when unavailable.'], evaluation: 'Evaluate each configured support position through the shared weighing/error/MPE service.', reference: 'OIML R 76-1:2006 Annex A A.4.7.2' };
      return { about: 'The applicable eccentricity method is determined from the persisted receptor and operating configuration.', procedure: ['Use only the positions and loading areas provided by the applicable method.', 'Record the actual load location and observations.'], automatic: ['No universal four-corner plan is assumed.'], evaluation: 'Use the configured method and shared weighing/error/MPE service.', reference: 'OIML R 76-1:2006 Annex A A.4.7' };
    }
    case 'A.4.8': return { about: 'A.4.8 tests discrimination of the indication using the applicable configured procedure.', procedure: ['Apply the base load plus small additional weights.', 'Remove the additions until the indication decreases unambiguously by one actual scale interval.', 'Restore one removed 1/10 × d increment and gently apply 1.4 × d.', 'Record the observed lower and upper indications.'], automatic: ['The actual scale interval d and all expected values are derived from the instrument snapshot.'], evaluation: 'For the digital indication branch, evaluate the observed transitions against the configured d; do not substitute an A.4.4 MPE criterion.', reference: 'OIML R 76-1:2006 Annex A A.4.8.2' };
    case 'A.4.9': if (text(configuration.applicabilityStatus) === 'NOT_APPLICABLE' || indicationType(configuration).includes('self indicating')) return { about: 'Not applicable: A.4.9 is the sensitivity test for a non-self-indicating instrument.', procedure: ['No execution procedure is required for this instrument configuration.'], automatic: ['Applicability is determined from the persisted indication type.'], evaluation: 'This clause is intentionally recorded as not applicable and does not contribute an execution result.', reference: 'OIML R 76-1:2006 Annex A A.4.9' }; return { about: 'A.4.9 concerns minimum sensitivity of a non-self-indicating instrument.', procedure: ['Use the applicable non-self-indicating sensitivity procedure and record the physical indication displacement.'], automatic: ['Required values are derived from the configured instrument and applicable rule services.'], evaluation: 'Use the dedicated sensitivity rule for the configured non-self-indicating instrument.', reference: 'OIML R 76-1:2006 Annex A A.4.9' };
    case 'A.4.10': return { about: 'A.4.10 compares repeated results for the same load.', procedure: ['Repeat the same configured load under the applicable control-stage plan.', 'Wait for the unloaded instrument to come to rest between weighings.', 'Record each actual observation and allow the shared weighing service to calculate each result/error.'], automatic: ['The repetition count and load plan are derived from control stage, class and capacity.'], evaluation: 'Repeatability range is maximum result minus minimum result and is compared with the absolute MPE for that load.', reference: 'OIML R 76-1:2006 §3.6.1; Annex A A.4.10' };
    case 'A.4.11': return { about: 'A.4.11 examines variation of indication with time through creep and zero return.', procedure: ['For creep, record the stabilized initial indication and the required time observations while the load remains applied.', 'Evaluate the 30-minute early-termination conditions when the required observations exist; otherwise continue to the extended observation.', 'For zero return, keep the configured load applied for the required period, remove it, allow stabilization, and record the zero indication before and after.'], automatic: ['Timers are visual aids; persisted timestamps are authoritative.', 'Zero return keeps automatic zero-setting/zero-tracking off as required by the procedure.'], evaluation: 'Use the strict early-termination conditions, the applicable extended MPE criterion, and the configured zero-return interval rule.', reference: 'OIML R 76-1:2006 §3.9.4; Annex A A.4.11' };
    case 'A.4.12': return a412Guidance(configuration);
    case 'A.4.13': return { about: 'A.4.13 is shown for route traceability when the clause is present.', procedure: ['Review the applicability state and configured operating conditions.', 'No physical execution instruction is shown when the clause is not applicable or its execution module is unavailable.'], automatic: ['Applicability and execution support come from the backend test engine.'], evaluation: 'Do not infer a result for an unsupported or not-applicable branch.', reference: 'OIML R 76-1:2006 Annex A A.4.13' };
    case 'A.5.1': return { about: 'A.5.1 examines the configured influence of tilting.', procedure: ['Use the applicable configured tilt method and directions.', 'Record required and actual tilt, no-load observations, loaded observations and the applicable zero deviation.', 'Use the shared weighing/error/MPE service for loaded results.'], automatic: ['The level-indicator, tilt-sensor, mobile and manufacturer-limit configuration determines the branch.'], evaluation: 'Evaluate the recorded observations under the configured A.5.1 method; do not assume a universal tilt angle.', reference: 'OIML R 76-1:2006 Annex A A.5.1' };
    case 'A.5.2': return { about: 'A.5.2 examines the warm-up behavior of an electrically powered instrument.', procedure: ['Observe the required disconnected and connected conditions.', 'After stabilization and zero-setting, record the load and observations at the configured time points.', 'Record the zero error applicable at each time point.'], automatic: ['The persisted connection timestamp, not a browser counter, controls time-point availability.'], evaluation: 'Use the existing A.4.4.3 and MPE calculation path for the recorded observations.', reference: 'OIML R 76-1:2006 Annex A A.5.2' };
    case 'A.5.3': return { about: 'A.5.3 examines specified static temperatures and the temperature effect on no-load indication.', procedure: ['Use the configured temperature sequence and allow the required stabilized condition.', 'Record actual temperature, humidity and pressure where applicable, together with weighing and zero observations.', 'Record the heating/cooling rate and the applicable zero changes.'], automatic: ['The temperature sequence is derived from the stored operating limits; values are not fabricated.'], evaluation: 'Use the applicable class/temperature interval rules and preserve actual environmental observations.', reference: 'OIML R 76-1:2006 Annex A A.5.3.1–A.5.3.2' };
    case 'A.5.4': {
      const power = text(configuration.powerSourceType).toLowerCase();
      const branch = power.includes('mains') ? 'AC mains' : power.includes('vehicle') ? '12 V / 24 V road-vehicle battery' : power.includes('recharge') || power.includes('external') ? 'external/plug-in AC or DC supply' : power.includes('battery') ? 'non-rechargeable battery supply' : 'the configured power-source branch';
      return { about: `A.5.4 evaluates voltage variations using ${branch}.`, procedure: ['Stabilize the instrument under constant environmental conditions.', 'Use the required test loads and apply the source-specific lower and upper voltage values.', 'Record actual voltage, indication, function behavior and applicable zero/error observations.'], automatic: ['Voltage limits are derived from the configured power-source branch, nominal voltage and specified range.'], evaluation: 'Functions and indications are assessed under the applicable source-specific R76 conditions; no single generic voltage formula is used.', reference: 'OIML R 76-1:2006 Annex A A.5.4' };
    }
    case 'A.6': return { about: 'A.6 is the endurance test performed after the other required tests.', procedure: ['Complete the linked pre-endurance weighing evidence.', 'Document the actual load and normal loading conditions for the physical applications.', 'Record exactly 100,000 loading applications with the persisted session counter.', 'Complete the linked post-endurance weighing and durability assessment.'], automatic: ['The counter, checkpoints, pauses and audit events are software records; physical loading remains a laboratory operation.'], evaluation: 'Durability error due to wear and tear is assessed against the applicable absolute MPE using the canonical pre/post weighing evidence.', reference: 'OIML R 76-1:2006 §3.9.4.3; Annex A A.6' };
    default: return null;
  }
}

export default function TestProcedureInfo({ testId, configuration = {} }: { testId: string; configuration?: GuidanceConfiguration }) {
  // Applicability is calculated by the backend. An evaluated N/A clause is a
  // coverage record, not an executable procedure, so never expose guidance or
  // controls through this reusable component for that state.
  if (text(configuration.applicabilityStatus).toUpperCase() === 'NOT_APPLICABLE') return null;
  const guidance = getTestProcedureGuidance(testId, configuration);
  if (!guidance) return null;
  return <details className="test-procedure-info">
    <summary><span className="test-procedure-summary-label"><Info size={15} /> Test procedure &amp; OIML guidance</span><ChevronDown size={16} className="test-procedure-chevron" /></summary>
    <div className="test-procedure-body">
      <section><span className="test-procedure-eyebrow">ABOUT</span><p>{mathText(guidance.about)}</p></section>
      <section><span className="test-procedure-eyebrow">PROCEDURE</span><ol>{guidance.procedure.map(item => <li key={item}>{mathText(item)}</li>)}</ol></section>
      <div className="test-procedure-grid"><section><span className="test-procedure-eyebrow">AUTOMATICALLY HANDLED</span><ul>{guidance.automatic.map(item => <li key={item}>{mathText(item)}</li>)}</ul></section><section><span className="test-procedure-eyebrow">EVALUATION</span><p>{mathText(guidance.evaluation)}</p></section></div>
      <section className="test-procedure-reference"><span className="test-procedure-eyebrow">OIML REFERENCE</span><p>{guidance.reference}</p><a href={OIML_SOURCE} target="_blank" rel="noreferrer">View official source <ExternalLink size={13} /></a></section>
    </div>
  </details>;
}
