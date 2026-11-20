# Third-party material

Hoop Lab runs entirely in your browser and bundles these open-source components. Their licenses apply to them, not to Hoop Lab's own code.

| Component | Used for | License |
|---|---|---|
| [MediaPipe Tasks Vision](https://github.com/google-ai-edge/mediapipe) | Body pose tracking and ball detection in the browser | Apache-2.0 |
| MediaPipe model `pose_landmarker_heavy` | The pose model, downloaded by `npm install` from Google's model storage | Apache-2.0 |
| MediaPipe model `efficientdet_lite2` | The ball detector (COCO class "sports ball"), downloaded by `npm install` | Apache-2.0 |
| [Chart.js](https://www.chartjs.org) | The trend and volume charts | MIT |
| [Geist](https://github.com/vercel/geist-font) via `@fontsource-variable/geist` | Body font | SIL OFL 1.1 |
| [Barlow Condensed](https://github.com/jpt/barlow) via `@fontsource/barlow-condensed` | Display font | SIL OFL 1.1 |
| [Vite](https://vitejs.dev) and [TypeScript](https://www.typescriptlang.org) | Build tools | MIT and Apache-2.0 |

The models are not stored in this repository. `npm install` downloads them to `public/models`, which is ignored by git.
