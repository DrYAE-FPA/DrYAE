# Code signing policy

Free code signing provided by [SignPath.io](https://about.signpath.io/), certificate by [SignPath Foundation](https://signpath.org/).

## Signed files
Only programs built from the source code of this repository are signed: `DrYAE.exe` and the installer `DrYAE-Setup-x.y.z.exe`. They are built by GitHub Actions (`.github/workflows/build-windows.yml`) straight from this repository.
The third-party tools bundled with DrYAE (FFmpeg, yt-dlp, aria2, QuickJS-ng, 7-Zip) are open source. They are downloaded from their official releases with checked SHA-256 fingerprints (`tools/win-tools.sha256`), and DrYAE does not sign them.

## Team roles
- Committers and reviewers: [DrYAE-FPA](https://github.com/DrYAE-FPA)
- Approvers: [DrYAE-FPA](https://github.com/DrYAE-FPA)

Every release signing request is approved manually. All team members use multi-factor authentication on GitHub and SignPath.

## Privacy policy
This program will not transfer any information to other networked systems unless specifically requested by the user or the person installing or operating it, except for the automatic checks described in [PRIVACY.md](PRIVACY.md) (update check on GitHub, ad-blocker list updates, torrent tracker list), which can each be turned off in the settings.
