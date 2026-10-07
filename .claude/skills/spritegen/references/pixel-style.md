# Pixel-Art Style Guide

## Default Look

Use clean 2D pixel-art-adjacent game assets:

- strong readable silhouette
- consistent pixel scale
- hard edges and minimal antialiasing
- limited palette
- flat cel-like shading
- simple highlights and shadows
- no photographic or painterly texture
- no background scene unless explicitly requested

## Sheet Consistency

Every cell in one sheet should share:

- camera angle
- outline weight
- light direction
- palette family
- pixel density
- scale relationship
- shadow treatment

## Avoid

- glossy app icons
- 3D renders
- realistic fur, metal, fabric, or wood
- soft gradients and bloom
- tiny unreadable detail
- text, labels, numbers, frame marks, or UI panels
- cast shadows detached from the asset
- decorative backgrounds
- motion blur, smears, or speed lines unless the user explicitly wants VFX

## Animation Guidance

For animation frames, use pose and silhouette changes instead of smear effects. Loops should return cleanly to the first frame.

For VFX sheets, keep effects hard-edged, opaque enough to read, and contained inside each frame cell.
