import SearchField from './SearchField.jsx';
import StairsToggle from './StairsToggle.jsx';

export default function ControlPanel({
  buildings,
  start,
  end,
  onStartChange,
  onEndChange,
  avoidStairs,
  onAvoidStairsChange,
  sameBuildingWarning,
  noRouteWarning,
}) {
  return (
    <section className="control-panel" aria-label="Route controls" data-no-pan>
      <header className="control-panel-header">
        <span className="brand-wordmark">OpenPath</span>
        <span className="brand-subtitle">ARN pilot</span>
      </header>

      <div className="control-panel-fields">
        <SearchField
          label="Starting point"
          dotClass="search-dot-start"
          buildings={buildings}
          value={start}
          onChange={onStartChange}
          excludeId={end?.id}
          placeholder="Choose starting point"
        />
        <SearchField
          label="Destination"
          dotClass="search-dot-end"
          buildings={buildings}
          value={end}
          onChange={onEndChange}
          excludeId={start?.id}
          placeholder="Choose destination"
        />
      </div>

      <StairsToggle checked={avoidStairs} onChange={onAvoidStairsChange} />

      {sameBuildingWarning && (
        <p className="control-panel-warning" role="alert">
          Start and end are the same building — pick two different stops.
        </p>
      )}
      {noRouteWarning && (
        <p className="control-panel-warning" role="alert">
          No accessible path found between these buildings.
        </p>
      )}
    </section>
  );
}
