import { formatDistance } from '../utils/metrics.js';

const CLOSE_FT = 20;

// Rotation reflects how sharp the actual bend is, not just its side —
// a slight turn tilts the same arrow less than a sharp one, the way the
// angle of a real turn icon changes with the maneuver.
const ROTATE_BY_MAGNITUDE = { slight: 45, null: 90, sharp: 135 };

function magnitudeLabel(magnitude) {
  if (magnitude === 'slight') return 'slight ';
  if (magnitude === 'sharp') return 'sharp ';
  return '';
}

function TurnArrow({ direction, magnitude }) {
  const base = ROTATE_BY_MAGNITUDE[magnitude ?? 'null'];
  const rotate = direction === 'left' ? -base : base;
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <g transform={`rotate(${rotate} 12 12)`}>
        <path d="M12 3 L12 19 M12 3 L6 10 M12 3 L18 10" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

function ArriveFlag() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 3v18M6 4h12l-3.5 4L18 12H6" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function InstructionBanner({ instruction, destinationName }) {
  if (!instruction) return null;

  const isArrive = instruction.type === 'arrive';
  const remainingFt = instruction.remaining;
  const isClose = remainingFt < CLOSE_FT;

  let primary;
  let secondary = null;
  if (isArrive) {
    primary = isClose ? 'You have arrived' : `Arrive at ${destinationName}`;
    if (!isClose) secondary = formatDistance(remainingFt);
  } else {
    const label = `${magnitudeLabel(instruction.magnitude)}${instruction.direction}`;
    primary = isClose ? `Turn ${label} now` : `Turn ${label}`;
    if (!isClose) secondary = `In ${formatDistance(remainingFt)}`;
  }

  return (
    <section className="instruction-banner" aria-live="polite" data-no-pan>
      <div className="instruction-arrow">
        {isArrive ? <ArriveFlag /> : <TurnArrow direction={instruction.direction} magnitude={instruction.magnitude} />}
      </div>
      <div className="instruction-text">
        <div className="instruction-primary">{primary}</div>
        {secondary && <div className="instruction-secondary">{secondary}</div>}
      </div>
    </section>
  );
}
