import { useEffect, useMemo, useState } from 'react';
import { BUILDINGS } from './data/board.js';
import { findRoute } from './utils/routing.js';
import BoardMap from './components/BoardMap.jsx';
import ControlPanel from './components/ControlPanel.jsx';
import RouteSummary from './components/RouteSummary.jsx';
import './App.css';

export default function App() {
  const [startId, setStartId] = useState(null);
  const [endId, setEndId] = useState(null);
  const [avoidStairs, setAvoidStairs] = useState(false);
  const [navigating, setNavigating] = useState(false);

  const start = BUILDINGS.find((b) => b.id === startId) ?? null;
  const end = BUILDINGS.find((b) => b.id === endId) ?? null;
  const sameBuilding = Boolean(startId && endId && startId === endId);

  const route = useMemo(() => {
    if (!startId || !endId || sameBuilding) return null;
    return findRoute(startId, endId, !avoidStairs);
  }, [startId, endId, avoidStairs, sameBuilding]);

  // A route change (new stops, stairs toggled) mid-navigation would pull
  // the camera out from under a route that no longer exists — leave nav
  // mode instead of following a route that just vanished underneath it.
  useEffect(() => {
    if (!route) setNavigating(false);
  }, [route]);

  const noRouteWarning = Boolean(startId && endId && !sameBuilding && !route);

  return (
    <div className="app-shell">
      <BoardMap route={route} startId={startId} endId={endId} navigating={navigating} destinationName={end?.name} />
      <RouteSummary
        route={route}
        destinationName={end?.name}
        navigating={navigating}
        onStart={() => setNavigating(true)}
        onEnd={() => setNavigating(false)}
      />
      {!navigating && (
        <ControlPanel
          buildings={BUILDINGS}
          start={start}
          end={end}
          onStartChange={(b) => setStartId(b?.id ?? null)}
          onEndChange={(b) => setEndId(b?.id ?? null)}
          avoidStairs={avoidStairs}
          onAvoidStairsChange={setAvoidStairs}
          sameBuildingWarning={sameBuilding}
          noRouteWarning={noRouteWarning}
        />
      )}
    </div>
  );
}
