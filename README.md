# YNOT-Smart-Album

YNOT Album Studio is a Windows desktop album designer built with Electron, React, TypeScript and Konva, using the YNOT bronze and cream palette.

## Development

Install Node.js and npm, then run:

```sh
npm ci
npm run dev:electron
```

For a browser preview at http://127.0.0.1:5173/:

```sh
npm run dev -- --host 127.0.0.1
```

Native file dialogs and desktop integrations require Electron.

## Build

```sh
npm run typecheck
npm run build
npm run dist
```

The Windows installer and portable application are generated in `release/`. Generated builds and dependencies are excluded from Git.

## Album workflows

Create albums with standard or custom dimensions, import photos, arrange spreads manually or with Auto Build, browse matching templates, edit covers and images, save projects, and export albums.

Workflow verification and known limitations are recorded in [ALBUM_WORKFLOW_QA.md](ALBUM_WORKFLOW_QA.md). Complete SmartAlbums parity has not been verified. IDML export remains pending; hosted galleries and client proofing are deferred.
