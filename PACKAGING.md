# Building a distributable installer

```bash
npm install
npm run dist        # Windows installer + portable exe (release/)
npm run dist:all     # also builds mac (.dmg) and linux (.AppImage) targets
```

This produces two Windows artifacts in `release/`:

- **`Album Studio-Setup-<version>.exe`** — a standard installer (NSIS). Per-user install,
  no admin rights required; lets the user pick the install directory and creates
  Start Menu + Desktop shortcuts. This is what you hand to end users for a normal install.
- **`Album Studio-Portable-<version>.exe`** — a single self-contained exe, no installation
  step. Useful for running straight off a shared network drive/NAS or a USB stick without
  installing on every machine.

To only regenerate the app icon (`build/icon.ico` / `build/icon.png`) after editing
`build/icon.svg`, run `npm run icon`.

## Code signing

The installer above is **unsigned**. Windows SmartScreen will show an "Unknown publisher"
warning on first run (the user clicks "More info" → "Run anyway" to proceed) — this is
normal for unsigned software and doesn't affect functionality. For a production rollout to
a client, get an Authenticode code-signing certificate and pass it to electron-builder via
the `CSC_LINK` / `CSC_KEY_PASSWORD` environment variables (see the
[electron-builder code signing docs](https://www.electron.build/code-signing)) to remove
that warning.
