import { describe, expect, it } from 'vitest';
import { ATLAS_BRANCH_COUNT, ATLAS_GROUPS, ATLAS_GUIDES, ATLAS_OBJECT_COUNT } from './atlas.js';
import { HOBBIES } from './data.js';

describe('game113 interest atlas', () => {
  it('keeps six browse groups and a substantial expandable candidate library', () => {
    expect(ATLAS_GROUPS).toHaveLength(6);
    expect(ATLAS_BRANCH_COUNT).toBeGreaterThanOrEqual(60);
    expect(ATLAS_OBJECT_COUNT).toBeGreaterThanOrEqual(300);
  });

  it('uses stable unique IDs and nonempty branches', () => {
    const groupIds = ATLAS_GROUPS.map((group) => group.id);
    const branches = ATLAS_GROUPS.flatMap((group) => group.branches);
    expect(new Set(groupIds).size).toBe(groupIds.length);
    expect(new Set(branches.map((branch) => branch.id)).size).toBe(branches.length);
    expect(branches.every((branch) => branch.name && branch.objects.length >= 3)).toBe(true);
  });

  it('links only to existing opened hobby rooms and makes every guide discoverable', () => {
    const branches = ATLAS_GROUPS.flatMap((group) => group.branches);
    const hobbyIds = new Set(HOBBIES.map((hobby) => hobby.id));
    expect(branches.filter((branch) => branch.openHobby).every((branch) => hobbyIds.has(branch.openHobby!))).toBe(true);
    expect(ATLAS_GUIDES.every((guide) => branches.some((branch) => branch.id === guide.id))).toBe(true);
  });
});
