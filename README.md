# SendOnce Mails

SendOnce Mails is a cross-platform desktop app scaffold built with Node.js, TypeScript, and Electron.

The packaged app includes the Node.js runtime and all required libraries, so end users install a normal desktop executable and do not need Node.js installed.

## Development

```bash
npm install
npm start
```

## Build Installers

```bash
npm run dist
```

Platform-specific commands are also available:

```bash
npm run dist:mac
npm run dist:win
npm run dist:linux
```

The generated installers are written to `release/`.

## Cross-Platform Note

Electron Builder can create installers for macOS, Windows, and Linux. For best results, build each platform on that platform or use CI runners for each operating system, especially when signing and notarization are needed.
