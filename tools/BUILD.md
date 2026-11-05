# Building DrYAE for Windows

Requirements (Linux build machine): Node.js 20+, `wine` + `wine32` (needed by NSIS to build the uninstaller).

1. `npm install`
2. Put the Windows tools in `bin/win/` (they are not stored in git): `ffmpeg.exe` (gyan.dev build, GPLv3) with its `ffmpeg.LICENSE`, `yt-dlp.exe`, `qjs.exe` (QuickJS-ng) and `7za.exe`.
3. `NDC_WIN=/path/to/node_datachannel.node ./tools/build-win.sh` (the Windows build of node-datachannel, napi-v8)

Output:
- `dist/DrYAE/` is the portable version.
- `dist/installer/` holds `DrYAE-Setup-x.y.z.exe`, `latest.yml` and `.blockmap`, all three to upload to the GitHub release.

Translations: the source strings are French. After changing UI text, run `node tools/extract-strings.js` to see the new strings, add their translations to `locales/_extra.tsv`, then run `node tools/build-locales.js`.
