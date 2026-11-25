# V4 idle cats + domestic variation: interfaces declared before generation

Scope: new v4 only; retain v3 and all previous source/GLB files. No host/renderer/scenes/engine or gameplay code.

Cats retain original three source shapes. Paws remain fixed under an unanimated root, matching platform tops .615 /1.785 and ground entity root -.002. Breathing scales body slightly about its lower belly anchor; head turns around overlapping neck; eye blink scales the eye at its center; ear flick pivots at ear base; tail rotates gently about its embedded root. No whole-root bob/translation, no locomotion. Source neck/ear/tail overlaps must stay hidden through sampled motion. All animals are separate GLBs; static v4 must contain no original cat group geometry.

Domestic slots: room floorY3.22, roof deckY6.715, balcony deckY4.0. Furniture feet/pot bases sit at support planes; tabletop objects use top height+their true half-height. Balcony pots remain inside railing with .08m clearance. Roof pots sit behind front railing and .25m inside side edges. Plan scale [.85,1.15], yaw small and oriented to furnishing use, not arbitrary random roll. Hanging vines get a stem from soil to the over-rail edge before the hanging section. Existing architectural openings/railings/ground shops remain unchanged.

Static merging must remove zero-area faces; final cat clip must be inspected at continuous sample times for stationary paws, nonzero visible motion and closed loop. Numerical tests and local visual review are producer checks, not user artistic acceptance.
