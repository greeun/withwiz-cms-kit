"use client";

import "./toggle-switch.css";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  className?: string;
}

export default function ToggleSwitch({
  checked,
  onChange,
  label,
  className = "",
}: ToggleSwitchProps) {
  return (
    <label className={`admin-toggle ${className}`}>
      <span className={`admin-toggle-track ${checked ? "on" : ""}`}>
        <span className="admin-toggle-thumb" />
      </span>
      {label && <span className="admin-toggle-label">{label}</span>}
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="admin-toggle-input"
      />
    </label>
  );
}
