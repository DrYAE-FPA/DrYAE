# Building DrYAE for Windows

Requirements (Linux build machine): Node.js 20+, `wine` + `wine32` (needed by NSIS to build the uninstaller).

1. `npm install`
2. Put the Windows tools in `bin/win/` (they are not stored in git): `ffmpeg.exe` (gyan.dev build, GPLv3) with its `ffmpeg.LICENSE`, `yt-dlp.exe`, `qjs.exe` (QuickJS-ng), `7za.exe` and `aria2c.exe` (aria2 1.37.0 Windows build from github.com/aria2/aria2/releases, with its `COPYING` saved as `aria2.COPYING`).
3. `./tools/build-win.sh`

Output:
- `dist/DrYAE/` is the portable version.
- `dist/installer/` holds `DrYAE-Setup-x.y.z.exe`, `latest.yml` and `.blockmap`, all three to upload to the GitHub release.

Translations: the source strings are French. After changing UI text, run `node tools/extract-strings.js` to see the new strings, add their translations to `locales/_extra.tsv`, then run `node tools/build-locales.js`.
