# TherzieModsWiki

Wiki for **Armory**, **Warfare**, **Monstrum** and **Wizardry**.

- `index.html` + `assets/` = the website (plain HTML/JS, no build step).
- `data/` + `icons/` = what the dumper writes. The site reads these.
- `screenshots/locations/` = your location screenshots.

## Turning on GitHub Pages (once)

1. Upload everything in this folder to the root of the `TherzieModsWiki` repo (keep `.nojekyll`).
2. Repo **Settings → Pages** → Source: **Deploy from a branch** → Branch: **main**, folder **/ (root)** → Save.
3. After a minute the wiki is at `https://<your-username>.github.io/TherzieModsWiki/`.

## Editing text by hand

- Mod blurbs on the home page: `MOD_INFO` at the top of `assets/app.js`.
- Colors per mod: `--mod-Armory` etc. at the top of `assets/style.css`.

## Updating the wiki data

1. Run `wikidump` in-game with the TherzieWikiDumper plugin (kept in its own repo/folder).
2. Upload the `data` and `icons` folders from `BepInEx/WikiDump/` here, replacing the old ones.
3. Location pictures are your own screenshots: `screenshots/locations/<location id>.png` (e.g. `AltarSvalt_TW.png`).
