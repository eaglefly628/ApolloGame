# Street depth walking prototype

Accepted: user requests XZ ground movement toward storefronts. Existing runtime already maps Transform(x,y) to 3D ground(x,z), KeyboardInputSource accepts dy, FaceRotate and CharacterPresentation support two-axis displacement. No new movement system or shared-renderer change is needed.

Data composition: ArrowUp/KeyW -> dy=-1, ArrowDown/KeyS -> dy=1; Bounds permits a shallow street band; circle Shape(radius=.25) plus existing d1-overlap-detect and t2-collision-resolve prevents walking through measured static low props; t1-motion-apply, t1-hierarchy-resolve and t2-face-rotate remain authoritative. Mesh collision proxies are data only, absent render components. Existing camera-anchor + Pivot3D remains at2.3m, preserving white-line fix.

No terrain climbing, vertical height movement, shop interiors or conversation gameplay is implied. Existing Space greeting remains. Current engine keyboard diagonals use independent axis values, so diagonal speed remains sqrt(2) times cardinal speed; animation follows actual distance. No new normalization logic is added to the host or shared input engine.

Original single-axis legacy scenes are retained as historical control prototypes. New reference street/walk/light scenes receive the depth controls. Geometry and independent review must verify support lane and obstacle clearance.
