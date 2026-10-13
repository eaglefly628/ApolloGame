// One-time, idempotent scene-data authoring step for the wider battle preview.
// The engine still owns navigation, local avoidance, and collision resolution.
import { readFileSync, writeFileSync } from 'node:fs';

const url = new URL('./navigation.json', import.meta.url);
const data = JSON.parse(readFileSync(url, 'utf8'));
const grid = data.entities['navigation-map'].NavigationGrid;

// This encounter is an open-field crowd test. Keep the authored road/grass
// costs and live occupancy weights, but move all static dressing to the rim.
grid.blocked.fill(0);
for (const id of Object.keys(data.entities)) if (id.startsWith('obstacle-')) delete data.entities[id];

// Seven authored lanes share the center but avoid stacking every unit on one
// exact line. Each opposing pair keeps the same lane and genuinely meets.
const offsets = { upper: [-8, -4, 0, 4, 8], lower: [-8, -4, 0, 4, 8],
  left: [-4, 0, 4], right: [-4, 0, 4] };
const groupIndex = { upper: 0, lower: 0, left: 0, right: 0 };
for (const route of data.routes) {
  const lane = offsets[route.group][groupIndex[route.group]++];
  if (route.group === 'upper' || route.group === 'lower') {
    route.spawn[0] = lane;
    for (const point of route.waypoints) { point[0] = lane; point[1] = Math.sign(point[1]) * 22; }
  } else {
    route.spawn[1] = lane;
    for (const point of route.waypoints) { point[0] = Math.sign(point[0]) * 20; point[1] = lane; }
  }
}

writeFileSync(url, `${JSON.stringify(data)}\n`);
