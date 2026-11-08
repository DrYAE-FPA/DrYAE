# DrYAE user guide

*[Version française](GUIDE.md)*

## 1. Install
1. Download **DrYAE-Setup-x.y.z.exe** from [Releases](https://github.com/DrYAE-FPA/dryae/releases/latest).
2. Run it and pick your language from the list (English by default).
3. Accept the license and follow the steps. The installer adds a Desktop shortcut and a Start menu entry.

Windows may show "Windows protected your PC" because the app isn't signed by a paid publisher. Click **More info → Run anyway**.

**Portable version:** unzip it and run `DrYAE.exe`. Nothing needs to be installed, but one-click updates aren't available.

## 2. The download manager
The main window has:
- **on the left**, filters: All, Downloading, Finished, Paused, Scheduled and Failed, plus types (Torrents, Online videos…) and categories (Videos, Music, Documents…);
- **at the top**, **Add**, **Resume all**, **Pause all** and search (Ctrl+F);
- **in the middle**, the list. Each row shows the title, size, speed and time left. Right-click a row to open, pause, resume, rename, refresh the link, copy the link or delete it.

### Add a download
- **Add → Link:** paste one or more addresses, one per line. You can choose the folder, the file name, the number of connections and a speed limit.
- **Drag and drop:** drop links or `.torrent` files onto the window.
- **Clipboard:** when you copy a link, DrYAE offers to download it. You can turn this off in Settings.
- **Batch:** an address containing `[1-50]` is expanded to 1, 2, 3… up to 50.

### Duplicates
If you add a file that is already there (same link or same title), DrYAE asks: **Replace**, **Keep both (number it)** or **Cancel**. Tick "Always do this" to stop being asked (change it in Settings → Downloads).

### Clearing the list
The **trash** button at the top removes finished downloads from the list (the files stay on disk). It asks first; tick "Don't ask again" to skip the question (turn it back on in Settings → General).

### If a link expired
Right-click → **Refresh link** and paste a new link to the same file. The download resumes where it stopped.

## 3. Videos (MP4 / MP3)
1. Open the **DrYAE browser** with the button on the left or Ctrl+B, then go to the video page.
2. Click the **download icon** at the top right. The small number is the count of videos found.
3. The **Choose a format** panel shows:
   - **Video · MP4**, with the quality (1080p, 720p…) and the size of each file;
   - **MP3 audio** at 320, 192 or 128 kb/s, or M4A without re-encoding;
   - the files detected during playback.
4. Click **Download**. It keeps running in the background while you browse.

**More options** lets you change the name, folder or speed, add the download paused, or schedule it.

If no video is found, start playing it, then try again. If a YouTube video stops downloading, go to **Settings → Downloads → Update yt-dlp**.

DRM-protected videos (Netflix, Disney+…) cannot be downloaded.

## 4. Torrents
- Use **Add → Torrent**, click a `magnet:` / `.torrent` link in the DrYAE browser (the file picker opens on the page, you stay there), or drop a `.torrent` file.
- The torrent engine (aria2) is native and very light: it only runs while torrents are downloading.
- DrYAE reads the file list. Tick the files you want.
- **Sequential download** lets you watch a video while it downloads.
- Seeding after the download and the share ratio are set in Settings → Torrents.

## 5. The built-in browser
- **Tabs:** Ctrl+T for a new tab, Ctrl+Shift+N for a private tab, Ctrl+W to close. Drag tabs to reorder them. A tab only loads when you open it.
- **⋮ menu (like Firefox):** new tab, history, bookmarks, Downloads (the download manager), passwords, extensions, print, save as, translate page, find, zoom, **Browser settings** (search engine, privacy, ad blocker…, kept separate from the download manager's settings), more tools, help.
- **Detected file(s):** the download button lists everything the page plays, with the size (estimated "~" for streams), the number of pieces, the resolution and the duration. **Clear all** empties the list, **Reset** shows it again, **Sort** changes the order, and "Select the files" lets you download several at once.
- **Ad blocker:** click the shield to turn it off for a site.
- **Passwords:** after you sign in, DrYAE offers to save the password. Passwords are encrypted by Windows on your PC.
- **Autofill:** fill in your profile (name, email, address…). DrYAE then offers "Fill in with my profile" in forms.
- **Chrome extensions:** open the Chrome Web Store from the Extensions panel, then click "Add to Chrome".
- If a "Are you human?" check doesn't pass, use **⋮ → Open this page in Chrome** with the DrYAE extension (see section 7).

## 6. Scheduler and limits
- **Scheduler:** set a start time, an end time and the days. DrYAE can also shut down the PC at the end.
- **Speed limit:** use the meter at the bottom left, or Settings → Speed & network. There is also a daily quota in MB.
- **Auto shutdown:** DrYAE can turn off the PC when all downloads are finished. You get 60 seconds to cancel.

## 7. Chrome extension (optional)
It sends Google Chrome downloads, videos and magnet links to DrYAE.
1. Go to Settings → **Chrome extension → Open the extension folder**.
2. In Chrome, open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and choose the **Extension Chrome DrYAE** folder.
4. Pin the DrYAE icon. DrYAE must be open to receive downloads.

## 8. Useful settings
- **General:** language, download folder, start with Windows, keep DrYAE in the system tray.
- **Downloads:** connections per file (up to 32), simultaneous downloads, what to do if the file already exists, default MP4/MP3 quality.
- **Appearance:** light, dark or black (AMOLED) theme, and accent color.
- **About:** version, **Check for updates**, **Give feedback**, licenses.

## 9. Updates and feedback
- When a new version is out, an **Update** banner appears. Click it, then click **Restart and install**.
- **Give feedback** opens the [Issues](https://github.com/DrYAE-FPA/dryae/issues) page, where you can report a problem or suggest an idea.

## 10. Keyboard shortcuts
Press **F1** in the download manager or in the browser to see the full list.

**Download manager:** Ctrl+A (select all) · Shift+click / Ctrl+click · ↑/↓ and Shift+↑/↓ · Enter (open) · Space (pause/resume) · Del (remove) · Shift+Del (remove and delete files) · F2 (rename) · Ctrl+I (information) · Ctrl+C (copy link) · Ctrl+E (folder) · Ctrl+N (add link) · Ctrl+T (torrent) · Ctrl+O (.torrent file) · Ctrl+V (paste a link) · Ctrl+B (browser) · Esc.

**Browser (like Firefox):** Ctrl+T · Ctrl+Shift+P (private tab) · Ctrl+W · Ctrl+Shift+T (reopen closed tab) · Ctrl+Tab · Ctrl+1…9 · Ctrl+L / F6 · Ctrl+F / F3 · F5 / Ctrl+R · Alt+←/→ · Ctrl+D · Ctrl+H · Ctrl+J (download manager) · Ctrl+Shift+Y (detected files) · Ctrl+P · Ctrl+S · Ctrl+U · Ctrl+M (mute) · Ctrl+ +/−/0 · F11 · F12 · Ctrl+Shift+Del · Ctrl+Shift+Q.

## Responsible use
Only download content you have the right to copy: your own files, free content, or content you are allowed to download. Follow the terms of service of the sites you visit.
