export default function ZoomControls({ onZoomIn, onZoomOut }) {
  return (
    <div className="zoom-controls" role="group" aria-label="Zoom">
      <button type="button" className="zoom-btn zoom-btn-in" onClick={onZoomIn} aria-label="Zoom in">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <line x1="8" y1="2" x2="8" y2="14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      </button>
      <button type="button" className="zoom-btn zoom-btn-out" onClick={onZoomOut} aria-label="Zoom out">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
