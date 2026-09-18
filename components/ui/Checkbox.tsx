'use client';
export function Checkbox({ checked, onChange, label }:
  { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
             className="accent-[#0A0A0A]" />
      {label}
    </label>
  );
}
