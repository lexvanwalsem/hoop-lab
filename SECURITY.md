# Security

## Reporting a vulnerability

Please do not open a public issue for a security problem. Use GitHub's private vulnerability reporting
(the "Security" tab of this repository, then "Report a vulnerability").

Include what you found, how to reproduce it and what the impact could be.

## What the app does and does not do

- Videos are decoded and analyzed in your browser. They are never uploaded.
- The tracking models and the WebAssembly runtime are served from the app itself (`public/`), not from a CDN.
- Results are stored in your browser's `localStorage`. There is no account, no server and no analytics.
- A backup file contains your sessions, exercise log, height and weight. Handle it as personal data.
