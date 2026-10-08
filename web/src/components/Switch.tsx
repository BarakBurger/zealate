export const Switch = ({ checked, onChange, label, sub, disabled }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string; disabled?: boolean;
}) => (
  <label className="switch">
    <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
    <span className="track" aria-hidden="true" />
    <span><strong>{label}</strong>{sub && <span className="sub">{sub}</span>}</span>
  </label>
);
