# Native character runtime

Code-only deployment of the existing native workbench player. It reuses the
unchanged Stretchy Studio renderer/stores/loader and Apollo's existing
`apollo-native-character-v1` bridge. It is not Cubism and does not load `.moc3`.

`vendor/stretchystudio/` contains 210 unchanged files from the pinned upstream
archive in `source.json`; `upstream-files.json` retains the original workbench
manifest (534 files). `npm test` checks only the 210 distributed runtime files.
See-through inference, generated images, authoring examples, screenshots and
candidate cat bundles are deliberately not distributed here.

From the repository root:

    npm ci --prefix tools/native-character-runtime
    npm test --prefix tools/native-character-runtime
    npm run build --prefix tools/native-character-runtime

The last command writes ignored, reproducible output to
`public/native-character/`, with Vite base `/native-character/`. Build it before
the normal app build; serve both from the same origin. The UI host supplies
`/native-character/index.html`; it must never point at a developer's workbench
port. No source public/art directory is copied. A missing runtime/model keeps
the static poster visible.

Native source files remain byte-identical. Two anchored build-time transforms
export the existing audio hook and enable transparent native rendering; a
changed/missing/duplicate anchor makes the build fail.

The player-only entry excludes the editor application. Authoring-only ONNX is
replaced at build resolution by an explicit rejecting stub, so no inference WASM
or model is shipped. The native canvas observes host resizing and refits its
camera without reloading textures/restarting playback. `npm test` covers the
resize observer, hidden zero-size protection and disconnect.

The main app and the generated player output must be deployed together. The
platform whitelist packer is not changed by this task; integrations using that
packer must explicitly include this player directory before claiming support.

License: upstream MIT notice is preserved in `vendor/stretchystudio/LICENSE`;
the build copies it to the deployed runtime as `LICENSE-STRETCHYSTUDIO.txt`.
Project-specific generated art has separate provenance and is not covered by
the runtime license. No API key or external service is needed for playback.
