# Contributing

Thanks for wanting to help. Pull requests are welcome.

## How changes are accepted

- The `main` branch is protected. Every change goes through a pull request that the maintainer reviews.
- The automated tests and the build must pass.

## Before you open a pull request

1. Open an issue first for anything bigger than a small fix, so we agree on the direction.
2. Fork the repository, create a branch, make your change.
3. Run `npm test` and `npm run build` (Node.js 20 or newer; `npm install` downloads the tracking models once).
4. Add or update tests for the behaviour you change. The logic in `analysis.ts`, `coach.ts`, `store.ts` and `video.ts`
   has no browser dependencies, which keeps it easy to test.
5. Keep it simple: few dependencies, no server, no external requests at run time.

## Style

- English for code, comments and interface text. No emojis.
- Small functions, clear names, comments that explain why.
- Follow `DESIGN.md`: monochrome and flat, colour only for data and status, one motion system, nothing that shifts the layout.
- Privacy first: videos and results must never leave the device.

## Reporting a bug

Open an issue with the browser, the video format and frame rate, the steps, what you expected and what happened.
Do not attach videos that show other people.
