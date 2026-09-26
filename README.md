# TabViewer

A browser-based reader and player for Guitar Pro tablature, built on
[alphaTab](https://www.alphatab.net/), React and Vite. Made for reading Bach at
the guitar: page through a score with the keyboard, play it back at reduced
speed on a nylon-string sound, and star the pieces you are working on. Pieces
come from *songbooks*, JSON manifests that can be hosted anywhere. It runs at
<https://tabviewer.dalagerlabs.com>.

## Starting the app

```sh
npm install
npm run dev
```

Then open http://localhost:5173/. Node.js 20 or newer is required.

`npm run dev` (and `npm run build`) first run two preparation scripts:

- **`npm run manifest`** builds the bundled *Bach Guitar Songbook*: it copies
  every file from `collection/tabs/` into `public/songbooks/bach/tabs/` under
  an ASCII slug name, writes `public/songbooks/bach/songbook.json`, and packs
  both into `public/songbooks/bach.sbk`. Reruns are instant; only changed
  files are copied.
- **`npm run soundfont`** downloads the MuseScore_General soundfont (~40 MB,
  one time) into `public/soundfont/`. Playback uses it instead of alphaTab's
  bundled feature-phone bank. If the download fails, it falls back to the
  bundled bank so playback still works offline. Skipped when
  `VITE_SOUNDFONT_URL` is set (see Deployment).

`public/songbooks/` and `public/soundfont/` are generated and git-ignored.

## Songbooks

The app ships without any pieces compiled in. A songbook is a JSON file at any
URL that lists Guitar Pro files:

```json
{
  "songbook": 1,
  "name": "Bach Guitar Songbook",
  "description": "optional",
  "songs": [
    { "url": "tabs/air.gp5", "title": "Air", "artist": "Bach", "id": "air" }
  ]
}
```

Only `url` is required per song. It resolves against the manifest's own URL,
so a folder holding `songbook.json` and its files is a complete songbook.
`title` falls back to the file name and `id` (used in links) to a slug of it.
A songbook on another host must be served with CORS headers that allow `GET`
from the viewer's origin.

### .sbk files

A `.sbk` is the same thing zipped: `songbook.json` at the root (or inside a
single top-level folder) and the files its song URLs point at. It loads in one
request and, once loaded, opens every piece without further downloads. Load
one by URL like a JSON songbook, or open or drop a `.sbk` file into the app:
it is stored in the browser's IndexedDB and listed with the other songbooks,
but its pieces cannot be shared by link. To make one:

```sh
cd my-book && zip -r ../my-book.sbk songbook.json tabs
```

A `.sbk` may unpack to at most 5000 files and 200 MB.

### Exporting a songbook

Press `e`, or click *Export…* above the sidebar list, to pack pieces into a new
`.sbk`. Pick from the loaded songbook and your imported pieces (your starred
ones are preselected; *All* and *None* act on what the filter shows), give it a
name and an optional description, then either *Download .sbk* to share it, or
*Save & open* to keep it in this browser and switch to it. Pieces are renamed
after their titles inside the file, so imports get readable ids.

A first visit starts empty. Press `o` or click *Songbook* in the toolbar to
paste a URL, open a `.sbk` file, or pick the bundled *Bach Guitar Songbook*
(served as `bach.sbk`). One songbook is loaded
at a time; the loaded one and every one loaded before are remembered in
`localStorage`, and can be switched between, unloaded, forgotten or cleared
from the same dialog. The bundled book is listed in `SUGGESTED_SONGBOOKS` in
`src/lib/songbook.ts`.

## The bundled collection

The tabs for the bundled songbook live in the repo:

```
collection/
├── index.csv                one row per piece
├── sources.csv              download URLs, git-ignored
└── tabs/                    the .gp3 / .gp4 / .gp5 files
```

`index.csv` has these columns:

```
artist,song,filename
Bach,4 Canons,Bach - 4 Canons.gp5
```

`filename` must match a file in `collection/tabs/`. The manifest build fails
loudly if the CSV references a missing file, or if a file on disk has no CSV
row, so the two cannot silently drift apart. Any collection in this shape
works; it does not have to be Bach.

`sources.csv` records where each file was downloaded from and is kept out of
git:

```
filename,song_id,url
Bach - 4 Canons.gp5,412315,https://…/DownloadSong?Type=1&SongId=412315
```

`scripts/download-tabs.sh` fetches every `url` in it into `collection/tabs/`,
skipping files already present. It needs `python3` and `curl`.

## Using it

Press `?` in the app for the full list of keyboard shortcuts. The essentials:

| Key | Action |
| --- | --- |
| `PageDown` / `PageUp`, `j` / `k` | Page or half-page through the score |
| `n` / `p` | Next / previous piece |
| `/` or `Ctrl+K` | Search the songbook |
| `o` | Load, switch or unload a songbook |
| `e` | Export pieces as a new songbook |
| `c` | Copy a link to the current bar |
| `Space`, `s` | Play / pause, stop |
| `,` / `.` / `\` | Slower / faster / reset to 100% |
| `m` | Toggle the metronome |
| `g` | Play everything on nylon guitar |
| `t` | Show all tracks / first track only |
| `+` / `-` / `0` | Zoom in / out / reset |
| `f`, `b`, `l` | Full screen, toggle sidebar, cycle layout |

Click the star next to a piece in the sidebar to favourite it. Starred pieces
are repeated in a *Starred* section at the top of the sidebar. Favourites and
the last-opened piece are stored in the browser's `localStorage`.

### Links to pieces and bars

The address bar always holds a permanent link to the open piece, at
`/p/<piece>?book=<songbook url>`. Opening it loads that songbook first, so
links work for visitors who have never loaded it. Without `book`, the piece is
looked up in whichever songbook is loaded. Adding `bar=<n>` opens the piece
scrolled to that bar, with the playback cursor parked on it; bar numbers are
the ones printed in the score.
*Copy link* in the toolbar (or `c`) copies a link to the bar under the
playback cursor, or else the first bar in view.

### Importing your own tabs

Press `i`, click *Import* in the toolbar, or drop `.gp3` / `.gp4` / `.gp5` /
`.gpx` / `.gp` files anywhere in the window to add pieces that are not part of
any songbook. They are stored in the browser's IndexedDB, so they
survive reloads but never leave your machine, and are listed under *Imported*
at the top of the sidebar with a button to remove them again. The title and
artist come from the file's own metadata, falling back to the file name.

## Deployment

`.github/workflows/deploy.yml` builds on every push to `main` and deploys
`dist/` as a static-assets Worker (`wrangler.jsonc`) with Wrangler. It is
served at <https://tabviewer.dalagerlabs.com> (a Workers Custom Domain; the
workers.dev URL is disabled). Unknown paths fall back to `index.html`, so
deep links like `/p/<piece>` resolve. To deploy by hand, build with
`VITE_SOUNDFONT_URL` set and run `npx wrangler deploy`.

The soundfont is not deployed with the site: Workers static assets reject
files over 25 MiB and `MuseScore_General.sf3` is 40 MB, so
`public/.assetsignore` excludes it. Instead the build points the player at a
hosted copy in the R2 bucket `tab-viewer-soundfont` via `VITE_SOUNDFONT_URL`.
One-time setup (already done for the bucket and Worker):

1. Create an R2 bucket, upload `MuseScore_General.sf3` (the file
   `npm run soundfont` saves as `public/soundfont/default.sf3`), and enable
   public access on the bucket (or attach a custom domain).
2. Add a CORS rule to the bucket allowing `GET` from the site's origin.
   The player fetches the font cross-origin, so without this it fails to
   load.
3. In the GitHub repo, under *Settings → Secrets and variables → Actions*:
   - Variable `SOUNDFONT_URL`: the public URL of the `.sf3` file.
   - Secret `CLOUDFLARE_API_TOKEN`: a token made from the *Edit Cloudflare
     Workers* template.
   - Secret `CLOUDFLARE_ACCOUNT_ID`.

Wrangler creates the `tab-viewer` Worker on first deploy.

## Other scripts

```sh
npm run build     # production build into dist/
npm run preview   # serve the production build locally
npm run lint      # oxlint
```
