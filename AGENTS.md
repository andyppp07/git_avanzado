# AGENTS.md

Static p5.js + ml5.js browser project in early skeleton stage. No build system, package manager, tests, or lint config: `index.html` is the entrypoint and p5 2.3.3 / ml5 1.4.0 load from a CDN. Do not invent npm scripts or add tooling unless asked.

## Module contract (MVC, classic scripts)

- `sketch.js` is the composition root: it creates the canvas and calls `HandPose`, `GameLogic`, and `UI` in the p5 loop. Keep feature logic out of it.
- Each feature file exposes exactly one global object and owns one responsibility: `js/handpose.js` -> `HandPose` (webcam, ml5 detection, hand skeleton rendering), `js/gamelogic.js` -> `GameLogic` (game state, consumes hands), `js/iu.js` -> `UI` (HUD rendering, consumes hands + state).
- Do not call one feature module from inside another; integrate only in `sketch.js`.
- Scripts are classic globals sharing scope (no modules, no bundler); load order in `index.html` matters.

## Layout and load order

- `index.html` loads, in order: p5 CDN, ml5 CDN, `js/gamelogic.js`, `js/handpose.js`, `js/iu.js`, then `sketch.js` with `defer`.
- `sketch.js` starts `HandPose.init()` without awaiting it, so the draw loop shows progress while the model loads; p5 2.x has no `preload()`.
- `style.css` is the only stylesheet and starts with a global reset.

## Running

- No dev server is configured. Plain p5 work can open `index.html` directly; the camera in `js/handpose.js` requires `localhost` (`getUserMedia` is blocked on `file://`), e.g. `python -m http.server 8000`.
- `HandPose` requests the front camera at 640x480, mirrors the landmarks, and draws them with contain mapping (fit, no cropping) on the fullscreen canvas. The video frame is never drawn, except the small preview behind `?debug=1` (backend, camera and detection stats).

## Git workflow

- Gitflow is configured locally: `main` is the release branch, `develop` is integration, and features live on `feature/<name>` (currently `feature/handpose`). Branch from `develop`; do not commit directly to `main`.
- No remote is configured; do not assume a push/PR flow.

## Gotchas

- ml5/tfjs `handPose` returns `NaN` keypoints when fed the `HTMLVideoElement` directly (tracking mode). `HandPose` forces `runtimeConfig.staticImageMode = true` and runs its own loop over a canvas frame. Do not switch back to `detectStart(video, ...)`.
- `HandPose.init()` calls `ml5.setBackend("webgl")` before loading the model: on some Windows GPUs the WebGPU backend returns empty hand detections. The `powerPreference ... requestAdapter()` console warning is harmless.
- `.atl/skill-registry.md` is auto-generated; do not hand-edit it. Regenerate with `gentle-ai skill-registry refresh --force`.
