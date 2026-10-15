/** Preflight native project data; prevents corrupt assets from silently disappearing. */
export function validateNativeProject(project) {
  const fail = message => { throw new Error(`Native character: ${message}`); };
  if (!project || !Array.isArray(project.nodes) || !Array.isArray(project.textures) || !Array.isArray(project.animations)) fail('invalid project structure');
  if (!project.canvas || !Number.isFinite(project.canvas.width) || !Number.isFinite(project.canvas.height) || project.canvas.width <= 0 || project.canvas.height <= 0 || project.canvas.width > 16384 || project.canvas.height > 16384) fail('invalid canvas size');
  if (project.nodes.length > 4096) fail('too many nodes');
  const ids = new Set();
  for (const node of project.nodes) {
    if (typeof node.id !== 'string' || !node.id || ids.has(node.id)) fail('missing or duplicate node ID');
    ids.add(node.id);
    if (!['part', 'group', 'warpDeformer'].includes(node.type)) fail(`unsupported node type ${node.type}`);
  }
  const nodes = new Map(project.nodes.map(node => [node.id, node]));
  for (const node of project.nodes) {
    const seen = new Set([node.id]);
    let parent = node.parent;
    while (parent) {
      if (!nodes.has(parent)) fail(`missing parent ${parent}`);
      if (seen.has(parent)) fail('cyclic hierarchy');
      seen.add(parent);
      parent = nodes.get(parent).parent;
    }
    for (const value of Object.values(node.transform ?? {})) if (!Number.isFinite(value)) fail('non-finite transform');
    if (node.mesh) {
      const { vertices, triangles, uvs } = node.mesh;
      if (!Array.isArray(vertices) || vertices.length < 3 || vertices.length > 65535 || !Array.isArray(triangles) || !uvs || uvs.length !== vertices.length * 2) fail('invalid mesh');
      if (vertices.some(v => !Number.isFinite(v.x) || !Number.isFinite(v.y)) || Array.from(uvs).some(v => !Number.isFinite(v))) fail('non-finite mesh');
      if (triangles.some(t => !Array.isArray(t) || t.length !== 3 || t.some(i => !Number.isInteger(i) || i < 0 || i >= vertices.length))) fail('invalid triangle index');
    }
  }
  const textures = new Set();
  for (const texture of project.textures) {
    if (!ids.has(texture.id) || textures.has(texture.id) || typeof texture.source !== 'string' || !texture.source) fail('invalid texture');
    textures.add(texture.id);
  }
  for (const node of project.nodes) if (node.type === 'part' && !textures.has(node.id)) fail(`missing texture ${node.id}`);
  const animations = new Set();
  const validProperty = p => ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity', 'visible', 'mesh_verts'].includes(p) || (typeof p === 'string' && p.startsWith('blendShape:'));
  for (const animation of project.animations) {
    if (!animation.id || animations.has(animation.id) || !Number.isFinite(animation.duration) || animation.duration <= 0 || !Array.isArray(animation.tracks)) fail('invalid animation');
    animations.add(animation.id);
    for (const track of animation.tracks) {
      if (!ids.has(track.nodeId) || !validProperty(track.property) || !Array.isArray(track.keyframes)) fail('invalid animation track');
      let previous = -1;
      for (const key of track.keyframes) {
        if (!Number.isFinite(key.time) || key.time < 0 || key.time <= previous || key.time > animation.duration) fail('invalid keyframe time');
        previous = key.time;
        if (track.property === 'mesh_verts') {
          const node = nodes.get(track.nodeId);
          const count = node.type === 'warpDeformer' ? ((node.col ?? 2) + 1) * ((node.row ?? 2) + 1) : node.mesh?.vertices.length;
          if (!Array.isArray(key.value) || key.value.length !== count || key.value.some(v => !Number.isFinite(v.x) || !Number.isFinite(v.y))) fail('invalid mesh keyframe');
        } else if (track.property === 'visible') {
          if (typeof key.value !== 'boolean') fail('invalid visibility keyframe');
        } else if (!Number.isFinite(key.value)) fail('non-finite keyframe');
      }
    }
  }
  for (const parameter of project.parameters ?? []) {
    if (!parameter.id || !Number.isFinite(parameter.min) || !Number.isFinite(parameter.max) || parameter.min > parameter.max) fail('invalid parameter');
  }
  return project;
}
