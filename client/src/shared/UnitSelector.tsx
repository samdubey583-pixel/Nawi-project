type UnitSelectorProps = {
  value: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  units?: string[];
};

const defaultUnits = ['mg', 'g', 'kg', 't'];

export default function UnitSelector({ value, onChange, disabled = false, units = defaultUnits }: UnitSelectorProps) {
  return <label className="unit-selector">
    <span>Observation unit</span>
    <select value={value} onChange={event => onChange?.(event.target.value)} disabled={disabled} aria-label="Observation unit">
      {units.map(unit => <option key={unit} value={unit}>{unit}</option>)}
    </select>
  </label>;
}
