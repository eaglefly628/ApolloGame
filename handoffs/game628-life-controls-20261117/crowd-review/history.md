# Historical crowd reuse lookup

The matching local reference is `handoffs/game114/crowd-avoidance-reference-demo/README.md` (there is no `games/game114` directory in the current tree). Its demo is16 cattle and1 cart crossing/returning, with32-agent pressure mode. That package is a read-only historical source snapshot, not a module to replace current engine files with.

Current engine registry already exposes `t2-navigation-grid`, `t2-pathfind`, `t2-crowd-avoidance`, `d1-overlap-detect`, `t2-collision-resolve`, `t1-motion-apply`, `t2-face-rotate`, and `t2-bounds-clamp`. The new scene can compose data through these existing capabilities. No new movement/avoidance runtime is needed.

For the street prototype: NavigationGrid authors raw obstacle cells and integer cost; NavigationProfile(radius=.25) derives radius-cleared graph geometry; NavAgent.patrol uses actual A* source-cell cost×10/14 and returns between fixed points; CrowdAvoidance uses ORCA to select local speeds before integration and hard collision. CharacterPresentation consumes accepted XZ displacement. A displayed cost grid alone is not proof of routing; actual NavPath trajectories must change in a weighted-vs-uniform counterexample.

Do not make the player Mass0 to prevent crowd displacement: collision-resolve would also stop resolving the player against static props. Keep old wall collision and test standing player plus active player approaches as a composition.

The historical16/32-agent metrics belong to its own large map; they cannot be transferred as guarantees for a3m-deep street. New residents, waypoint cycles, stall periods, contacts and deterministic replay need scene-specific measurement. Existing ORCA can be infeasible in overfull spaces and hard collision is discrete, so no universal zero-overlap claim is made.
