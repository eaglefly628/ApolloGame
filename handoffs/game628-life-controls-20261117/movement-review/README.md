# Game628 street-depth control candidate

Reference street/walk/light scenes accept WASD or arrow keys. Up/W moves along negative ground Z toward the shops; Down/S moves toward the front of the street; left/right stays on X. FaceRotate turns the existing 3D model toward the accepted velocity and CharacterPresentation measures actual XZ distance. Space remains a greeting animation, not a dialogue system.

The player uses an existing circle Shape of radius .25m. Existing overlap-detect and collision-resolve consume data-only static proxies. Bounds encloses the whole shape, giving player-center limits X[-8.95,8.95] and Z[.8,3.8]. This is a ground-plane model rendered in3D, with no jumping, stairs, climbing or shop-interior pathfinding. It does not turn into a vertical flying controller.

The camera continues to follow a tiny render anchor with Pivot3D focus height2.3m. No tall auxiliary mesh is reintroduced. Legacy single-axis streets and isolated character gallery remain unchanged in purpose.

Known inherited behavior: engine keyboard diagonals run sqrt(2) times cardinal speed; the walking animation follows that actual speed. Rigged-animation crossfades retain the already documented transient foot penetration limit; no runtime IK is claimed.

Independent review: actual keyboard input and all8 proxies passed scripted sweeps; maximum observed contact penetration .414mm (under1mm budget), not exact zero-overlap. Camera-anchor gets the same effective centre Bounds to avoid the existing hierarchy-before-Bounds2cm target overshoot. Real engine screenshots in ../evidence/depth-and-faces-20261120/. Final tests/build/runtime hashes are recorded in delivery verification.
