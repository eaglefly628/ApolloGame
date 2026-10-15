import type { WorldBlueprint } from '@zerocraft/engine/assembly/demo.assembly.js';
import { gardenBlueprint } from './garden-scene';
import { oxTemplateIds } from './scene';
import roadCentrelines from './road-centrelines.json';

type Point = { x: number; y: number };

// The map art is a 1254px square projected onto the 64x64 world ground.
// Author route anchors in image pixels so they follow its visible cream roads.
const mapPoint = ([px, py]: readonly [number, number]): Point => ({
  x: px / 1254 * 64 - 32, y: py / 1254 * 64 - 32,
});
const flippedX = (tileX: number) => tileX !== 0;
const flippedY = (tileY: number) => tileY !== 0;
function tilePoint(pixel: readonly [number, number], tileX: number, tileY: number): Point {
  const point = mapPoint(pixel);
  return { x: point.x * (flippedX(tileX) ? -1 : 1) + tileX * 64,
    y: point.y * (flippedY(tileY) ? -1 : 1) + tileY * 64 };
}
// Each road exits the painting at a matching edge. Translating the same
// anchors into neighboring cells produces continuous west/east and north/south
// patrol corridors across all nine tiles, instead of nine isolated loops.
const horizontalPixels = roadCentrelines.horizontal.map(([x, y]) => [x!, y!] as const);
const verticalPixels = roadCentrelines.vertical.map(([x, y]) => [x!, y!] as const);
function corridor(id: string, color: number, pixels: readonly (readonly [number, number])[],
  tiles: readonly (readonly [number, number])[], axis: 'x' | 'y') {
  const forward = tiles.flatMap(([tileX, tileY]) => {
    const mirroredAlongTravel = axis === 'x' ? flippedX(tileX) : flippedY(tileY);
    return (mirroredAlongTravel ? [...pixels].reverse() : pixels)
      .map(pixel => tilePoint(pixel as readonly [number, number], tileX, tileY));
  });
  return { id, color, points: [...forward, ...forward.slice(1, -1).reverse()] };
}
export const playRoutes = [
  ...[-1, 0, 1].map(row => corridor(`horizontal-${row}`, 0x9a633b,
    horizontalPixels, [-1, 0, 1].map(col => [col, row] as const), 'x')),
  ...[-1, 0, 1].map(col => corridor(`vertical-${col}`, 0x537280,
    verticalPixels, [-1, 0, 1].map(row => [col, row] as const), 'y')),
];

export function playPatrolEntity(route: typeof playRoutes[number], point: Point, nextIndex: number): WorldBlueprint['entities'][string] {
  return {
    Transform: { x: point.x, y: point.y, rotation: 0, scaleX: 1, scaleY: 1 },
    Model3D: { modelKey: 'mechanism/turtle', scale: .3, tint: route.color },
    AnimState3D: { clip: 'mechanical-loop', loop: true, speedAtVelocity: .055 },
    FaceRotate: { source: 'velocity' },
    PathFollow: { waypoints: route.points.map(({ x, y }) => ({ x, y })),
      speed: .055, index: nextIndex,
      loop: true, arriveRadius: .22, lookAhead: 2.5 },
    CrowdAvoidance: { radius: .8, maxSpeed: .055, timeHorizon: 30,
      neighborDistance: 9, maxNeighbors: 12, yieldAfterTicks: 70,
      minRadiusScale: 1, radiusStep: .025, priorityMode: 'mass-stall',
      desiredInertia: .82, zeroEscape: true, anticipatoryOffset: .8 },
    Shape: { kind: 'circle', radius: .8, category: 1, mask: 3 },
    Mass: { value: 1 },
  };
}

const entities: WorldBlueprint['entities'] = structuredClone(gardenBlueprint.entities);
const tileSize = 64;
const ground = entities['block-0']!;
delete entities['cottage-wing-debug'];
delete entities['garden-annex-debug'];
delete entities['cottage-wing'];
delete entities['garden-annex'];
// The pictured roof extends far beyond the former west-edge collider. Use two
// boxes for its silhouette, plus the fenced lower garden, in every tile.
// Their union occupies ~20% of each square while leaving the painted roads open.
export const playObstacles = [
  { id: 'castle-roof', minX: -26, maxX: 4, minY: -30, maxY: -15 },
  { id: 'castle-west-wing', minX: -30, maxX: -13, minY: -15, maxY: -9 },
  { id: 'garden-annex', minX: -32, maxX: -16, minY: 10, maxY: 27 },
] as const;
for (const obstacle of playObstacles) entities[obstacle.id] = {
  Transform: { x: (obstacle.minX + obstacle.maxX) / 2, y: (obstacle.minY + obstacle.maxY) / 2,
    rotation: 0, scaleX: 1, scaleY: 1 },
  Shape: { kind: 'box', width: obstacle.maxX - obstacle.minX,
    height: obstacle.maxY - obstacle.minY, category: 2, mask: 1 },
  Visibility: { visible: false },
};
ground.Transform3D = { ...ground.Transform3D!, y: -.03, rotX: -Math.PI / 2 };
ground.Mesh3D = { shape: 'plane', width: 64, height: 64 };
ground.Material3D = { ...ground.Material3D!, map: 'mechanism/garden-map-feather', transparent: true };
entities['garden-grass-underlay'] = {
  Transform3D: { x: 0, y: -.31, z: 0 },
  Mesh3D: { shape: 'box', width: 192, height: .5, depth: 192 },
  Material3D: { preset: 'matte', color: 0xa0a75e, shading: 'flat', map: 'mechanism/grass',
    tiling: { repeat: 12 } },
};
const baseGrid = entities['navigation-map']!.NavigationGrid!;
const baseCols = baseGrid.cols, baseRows = baseGrid.rows;
const baseBlocked = Array.from({ length: baseCols * baseRows }, (_, index) => {
  const x = baseGrid.originX + (index % baseCols + .5) * baseGrid.cellSize;
  const y = baseGrid.originY + (Math.floor(index / baseCols) + .5) * baseGrid.cellSize;
  return playObstacles.some(obstacle => x >= obstacle.minX && x < obstacle.maxX &&
    y >= obstacle.minY && y < obstacle.maxY) ? 1 : 0;
});
const baseCost = [...baseGrid.cost];
// Nine independently rendered map squares form one continuous navigation world.
// Each square carries its pictured cottage collision into the matching grid cells.
for (let tileY = -1; tileY <= 1; tileY++) for (let tileX = -1; tileX <= 1; tileX++) {
  if (tileX === 0 && tileY === 0) continue;
  entities[`garden-tile-${tileX}-${tileY}`] = {
    Transform3D: { ...ground.Transform3D!, x: tileX * tileSize, z: tileY * tileSize,
      scaleX: flippedX(tileX) ? -1 : 1, scaleY: flippedY(tileY) ? -1 : 1 },
    Mesh3D: structuredClone(ground.Mesh3D!),
    Material3D: structuredClone(ground.Material3D!),
  };
  for (const baseId of playObstacles.map(obstacle => obstacle.id)) {
    const original = entities[baseId]!;
    entities[`${baseId}-${tileX}-${tileY}`] = {
      Transform: { ...original.Transform!, x: original.Transform!.x * (flippedX(tileX) ? -1 : 1) + tileX * tileSize,
        y: original.Transform!.y * (flippedY(tileY) ? -1 : 1) + tileY * tileSize },
      Shape: structuredClone(original.Shape!),
      Visibility: { visible: false },
    };
  }
}
baseGrid.cols = baseCols * 3;
baseGrid.rows = baseRows * 3;
baseGrid.originX -= tileSize;
baseGrid.originY -= tileSize;
baseGrid.blocked = Array.from({ length: baseGrid.cols * baseGrid.rows }, (_, index) => {
  const col = index % baseGrid.cols, row = Math.floor(index / baseGrid.cols);
  const tileX = Math.floor(col / baseCols) - 1, tileY = Math.floor(row / baseRows) - 1;
  const localCol = col % baseCols, localRow = row % baseRows;
  const sourceCol = flippedX(tileX) ? baseCols - 1 - localCol : localCol;
  const sourceRow = flippedY(tileY) ? baseRows - 1 - localRow : localRow;
  return baseBlocked[sourceRow * baseCols + sourceCol]!;
});
baseGrid.cost = Array.from({ length: baseGrid.cols * baseGrid.rows }, (_, index) => {
  const col = index % baseGrid.cols, row = Math.floor(index / baseGrid.cols);
  const tileX = Math.floor(col / baseCols) - 1, tileY = Math.floor(row / baseRows) - 1;
  const localCol = col % baseCols, localRow = row % baseRows;
  const sourceCol = flippedX(tileX) ? baseCols - 1 - localCol : localCol;
  const sourceRow = flippedY(tileY) ? baseRows - 1 - localRow : localRow;
  return baseCost[sourceRow * baseCols + sourceCol]!;
});
for (const [id, data] of Object.entries(entities)) if (data.NavigationProfile) delete entities[id];
for (const [id, x, y, width, height] of [
  ['north', 0, -96, 192, 2], ['south', 0, 96, 192, 2],
  ['west', -96, 0, 2, 192], ['east', 96, 0, 2, 192],
] as const) entities[`map-boundary-${id}`] = {
  Transform: { x, y, rotation: 0, scaleX: 1, scaleY: 1 },
  Shape: { kind: 'box', width, height, category: 2, mask: 1 },
  Visibility: { visible: false },
};
for (const ids of Object.values(oxTemplateIds)) for (const id of ids) {
  delete entities[id];
  for (const suffix of ['desired', 'raw', 'actual', 'avoid'])
    delete entities[`crowd-vector-${id}:${suffix}`];
}

export const playPatrolIds: string[] = [];
for (const route of playRoutes) {
  const points = [...route.points, route.points[0]!];
  entities[`main-path-${route.id}`] = { Line3D: {
    points: points.map(({ x, y }) => [x, .16, y]),
    color: route.color, width: .10, opacity: .72,
  } };
  for (let slot = 0; slot < 9; slot++) {
    const index = Math.floor(slot * route.points.length / 18);
    const from = route.points[index]!;
    const to = route.points[(index + 1) % route.points.length]!;
    const dx = to.x - from.x, dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    const ux = dx / length, uy = dy / length;
    const midX = (from.x + to.x) / 2, midY = (from.y + to.y) / 2;
    const tipX = midX + ux * .65, tipY = midY + uy * .65;
    entities[`main-path-${route.id}-arrow-${index}`] = { Line3D: {
      points: [
        [midX - ux * .35 - uy * .45, .19, midY - uy * .35 + ux * .45],
        [tipX, .19, tipY],
        [midX - ux * .35 + uy * .45, .19, midY - uy * .35 - ux * .45],
      ],
      color: route.color, width: .13, opacity: .9,
    } };
  }
  for (const [index, point] of route.points.entries()) {
    if (index >= route.points.length / 2 || index % 12 !== 0) continue;
    entities[`main-path-${route.id}-post-${index}`] = { Line3D: {
      points: [[point.x, .2, point.y - .3], [point.x + .3, .2, point.y],
        [point.x, .2, point.y + .3], [point.x - .3, .2, point.y],
        [point.x, .2, point.y - .3]],
      color: route.color, width: .09, opacity: .8,
    } };
  }
  for (let slot = 0; slot < 6; slot++) {
    const index = Math.floor(slot * route.points.length / 6);
    const id = `patrol-${route.id}-${slot}`;
    entities[id] = playPatrolEntity(route, route.points[index]!, (index + 1) % route.points.length);
    playPatrolIds.push(id);
  }
}
// Cream road fragments span the softened image edges at each tile join.
for (let row = -1; row <= 1; row++) for (let col = -1; col < 1; col++) {
  const leftPixels = flippedX(col) ? [...horizontalPixels].reverse() : horizontalPixels;
  const rightPixels = flippedX(col + 1) ? [...horizontalPixels].reverse() : horizontalPixels;
  const from = leftPixels.slice(-4).map(pixel => tilePoint(pixel, col, row));
  const to = rightPixels.slice(0, 4).map(pixel => tilePoint(pixel, col + 1, row));
  entities[`road-bridge-horizontal-${col}-${row}`] = { Line3D: {
    points: [...from, ...to].map(point => [point.x, -.012, point.y]),
    color: 0xd9c9a2, width: 2.5, opacity: .8,
  } };
}
for (let col = -1; col <= 1; col++) for (let row = -1; row < 1; row++) {
  const upperPixels = flippedY(row) ? [...verticalPixels].reverse() : verticalPixels;
  const lowerPixels = flippedY(row + 1) ? [...verticalPixels].reverse() : verticalPixels;
  const from = upperPixels.slice(-4).map(pixel => tilePoint(pixel, col, row));
  const to = lowerPixels.slice(0, 4).map(pixel => tilePoint(pixel, col, row + 1));
  entities[`road-bridge-vertical-${col}-${row}`] = { Line3D: {
    points: [...from, ...to].map(point => [point.x, -.012, point.y]),
    color: 0xd9c9a2, width: 2.5, opacity: .8,
  } };
}

const cartId = Object.keys(entities).find(id => id.startsWith('turtle-'))!;
const cart = entities[cartId]!;
entities.camera!.Camera3D = { ...entities.camera!.Camera3D!, mode: 'follow', target: cartId,
  pitch: Math.PI / 3, distance: 76, orthoSize: 17.5, follow: { lag: .12, lookAhead: 0 } };
cart.Transform = { x: -3, y: 1, rotation: 0, scaleX: 1, scaleY: 1 };
delete cart.PathFollow;
delete cart.Trail3D;
cart.Velocity = { vx: 0, vy: 0 };
cart.Controllable = { playerId: 'p1', speed: .075 };
cart.CrowdAvoidance!.maxSpeed = .075;
cart.CrowdAvoidance!.neighborDistance = 12;
cart.CrowdAvoidance!.anticipatoryOffset = .8;
delete cart.CrowdAvoidance!.flowGuide;
delete entities['cart-route'];
delete entities['vertical-route'];
delete entities['horizontal-route'];

export const playCartId = cartId;
export const playBlueprint: WorldBlueprint = { capabilities: gardenBlueprint.capabilities, entities };
