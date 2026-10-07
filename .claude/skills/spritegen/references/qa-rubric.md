# Spritegen QA Rubric

## Geometry

- Source image exists and can be opened.
- Grid and cell size match the request.
- Sliced cells are the requested dimensions.
- Assets do not cross cell boundaries.
- Empty cells are intentional.
- Package manifest lists generated files.

## Visual Quality

- Asset is readable at intended size.
- Silhouette is strong.
- Style matches the approved game reference (pixel for pixel games; custom painterly for Game112).
- All cells in a sheet feel like the same set.
- No text, labels, frame numbers, visible guides, or UI unless requested.

## Transparency

- Transparent background is preferred.
- Chroma-key cleanup should not remove asset pixels.
- No obvious chroma halos or background edge slivers remain.
- No opaque white/black rectangles remain behind assets unless intentionally requested.

## Animation

- Frames are ordered.
- Frames differ meaningfully.
- Loop does not pop badly.
- Motion reads at the target preview FPS.

## Repair Policy

Regenerate the smallest broken scope. Do not locally redraw missing art unless the user explicitly asks for manual editing.
