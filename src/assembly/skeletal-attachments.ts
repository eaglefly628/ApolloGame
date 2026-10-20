import { validateAttach3D, type Attach3D } from '@engine/protocol/components/attach3d.js';

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
function reject(message: string): never {
  console.warn(`[skeletal-attachments] reject: ${message}`);
  throw new Error(`skeletal-attachments: ${message}`);
}

/** Reject known attachment cycles before loading; missing parents may arrive dynamically. */
export function validateSkeletalAttachments(entities: Record<string, unknown>): void {
  const attachments = new Map<string, Attach3D>();
  for (const [id, raw] of Object.entries(entities)) {
    if (!object(raw) || !Object.hasOwn(raw, 'Attach3D')) continue;
    let attachment: Attach3D;
    try { attachment = validateAttach3D(raw.Attach3D); }
    catch (error) { reject(`${id}: ${error instanceof Error ? error.message : String(error)}`); }
    if (attachment.parentId === id) reject(`${id}: Attach3D cannot attach to self`);
    attachments.set(id, attachment);
  }
  const resolved = new Set<string>();
  for (const start of attachments.keys()) {
    const path = new Set<string>();
    let id = start;
    while (attachments.has(id) && !resolved.has(id)) {
      if (path.has(id)) reject(`Attach3D cycle involving ${id}`);
      path.add(id);
      id = attachments.get(id)!.parentId;
    }
    for (const visited of path) resolved.add(visited);
  }
}
