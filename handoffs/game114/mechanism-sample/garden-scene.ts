import type { WorldBlueprint } from '@zerocraft/engine/assembly/demo.assembly.js';
import { oxTemplateIds, sampleBlueprint } from './scene';

// Two solid wings leave an 11-unit western garden gate. Their full-cell
// footprints cover 20.3125% of the authored 64×64 navigation square.
const buildings = [
  { id: 'cottage-wing', minX: -32, maxX: -16, minZ: -32, maxZ: -5 },
  { id: 'garden-annex', minX: -32, maxX: -16, minZ: 6, maxZ: 31 },
] as const;

const entities: WorldBlueprint['entities'] = structuredClone(sampleBlueprint.entities);
for (const id of Object.keys(entities)) {
  if ((id.startsWith('block-') && id !== 'block-0') ||
      /^(house|tree|rock|pickup)-/.test(id)) delete entities[id];
}
for (const ids of Object.values(oxTemplateIds)) for (const id of ids) {
  entities[id]!.Model3D!.tint = 0x71879a;
  delete entities[id]!.Trail3D;
}

const grid = entities['navigation-map']!.NavigationGrid!;
grid.blocked = Array.from({ length: grid.cols * grid.rows }, (_, index) => {
  const x = grid.originX + (index % grid.cols + .5) * grid.cellSize;
  const z = grid.originY + (Math.floor(index / grid.cols) + .5) * grid.cellSize;
  return buildings.some(b => x >= b.minX && x < b.maxX && z >= b.minZ && z < b.maxZ) ? 1 : 0;
});

for (const b of buildings) {
  const x = (b.minX + b.maxX) / 2, z = (b.minZ + b.maxZ) / 2;
  entities[b.id] = {
    Transform: { x, y: z, rotation: 0, scaleX: 1, scaleY: 1 },
    Shape: { kind: 'box', width: b.maxX - b.minX, height: b.maxZ - b.minZ, category: 2, mask: 1 },
    Visibility: { visible: false },
  };
  entities[`${b.id}-debug`] = { Line3D: {
    points: [[b.minX, .09, b.minZ], [b.maxX, .09, b.minZ],
      [b.maxX, .09, b.maxZ], [b.minX, .09, b.maxZ], [b.minX, .09, b.minZ]],
    color: 0xffefaa, width: .08, opacity: .8,
  } };
}

entities['block-0']!.Mesh3D = { shape: 'box', width: 64, height: .5, depth: 64 };
entities['block-0']!.Material3D = {
  preset: 'matte', color: 0xffffff, shading: 'flat', map: 'mechanism/garden-map',
};
entities.camera!.Camera3D = {
  yaw: 0, pitch: Math.PI * 5 / 12, distance: 96, projection: 'ortho', orthoSize: 35,
  pivotX: 0, pivotY: 0, pivotZ: 0, near: .1, far: 240,
};
entities.sun!.Light3D = { kind: 'directional', color: 0xfff8ec, intensity: 1.25, castShadow: true };
entities.fill!.Light3D = { kind: 'ambient', color: 0xf2eee3, intensity: .85 };

export const gardenCoverage = {
  blockedCells: grid.blocked.reduce((sum, value) => sum + value, 0),
  totalCells: grid.cols * grid.rows,
};
export const gardenBlueprint: WorldBlueprint = { capabilities: sampleBlueprint.capabilities, entities };
