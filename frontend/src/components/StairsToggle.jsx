export default function StairsToggle({ checked, onChange }) {
  return (
    <button
      type="button"
      className={`stairs-chip${checked ? ' is-active' : ''}`}
      role="switch"
      aria-checked={checked}
      data-no-pan
      onClick={() => onChange(!checked)}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 16v-3h3v-3h3V7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        {checked && <path d="M5 19 19 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
      </svg>
      Avoid stairs
    </button>
  );
}
