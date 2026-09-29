# TabViewer

A browser-based reader and player for Guitar Pro tablature, built on
[alphaTab](https://www.alphatab.net/), React and Vite. 

Made for reading tabs in the cleanest way possible in a browser with no distractions,
and for practising them: mute a track to play it yourself, slow it down, and loop
the whole piece or just the bars you select.

Tabs can be imported as files, and organized in *songbooks*, exported as `.sbk` files (just zip files with json and tab files in it).

Try it at <https://tabviewer.dalagerlabs.com>, or deploy your own copy (see
[Deploying](#deploying)).

## Starting the app

```sh
npm install
npm run dev
```

Then open http://localhost:5173/. Node.js 20 or newer is required.

`npm run dev` (and `npm run build`) first run two preparation scripts:

- **`npm run songbooks`** copies every `.sbk` in `songbooks/` into
  `public/songbooks/`, where the app serves them.
- **`npm run soundfont`** downloads the MuseScore_General soundfont (~40 MB,
  one time) into `public/soundfont/`. Playback uses it instead of alphaTab's
  bundled feature-phone bank. If the download fails, it falls back to the
  bundled bank so playback still works offline. Skipped when
  `VITE_SOUNDFONT_URL` is set (see [Deploying](#deploying)).

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

The format is specified by a JSON Schema at
[`public/schema/songbook-1.schema.json`](public/schema/songbook-1.schema.json),
served at <https://tabviewer.dalagerlabs.com/schema/songbook-1.schema.json>.
Add `"$schema"` with that URL to a manifest to have editors validate it (exported
books include it). Custom properties go in keys starting with `x-`; any other
unknown key is an error. `songbook` is the format version: a manifest without
it is read as version 1, and the app refuses any version it does not know.

`songbook-1.schema.json` is frozen: it only gets changes that older readers can
ignore. A format that older readers would misread gets a new schema file and a
new `songbook` number. `npm test` checks every bundled `.sbk` and the exporter's
output against the schema, and CI runs it on every push.

A first visit opens the bundled *Bach Guitar Songbook*. After that the app
opens whatever book was loaded last, or nothing if it was unloaded. Press `o`
or click *Songbook* in the toolbar to paste a URL, open a `.sbk` file, or pick
the bundled book again. One songbook is loaded at a time; the loaded one and
every one loaded before are remembered in `localStorage`, and can be switched
between, unloaded, forgotten or cleared from the same dialog.

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

## The bundled songbook

The Bach collection lives in the repo as a single file,
`songbooks/bach-for-guitar.sbk`: 3 Guitar Pro files (`.gp3` / `.gp4` /
`.gp5`) and their `songbook.json`. `npm run songbooks` publishes it, and
`SUGGESTED_SONGBOOKS` in `src/lib/songbook.ts` offers it (and opens it on a
first visit). Any `.sbk` dropped into `songbooks/` is published the same way.

To change the book, open it in the app, adjust it and export a new `.sbk`, or
edit it by hand:

```sh
mkdir bach && cd bach && unzip ../songbooks/bach-for-guitar.sbk
# edit songbook.json, add or replace files under tabs/
rm ../songbooks/bach-for-guitar.sbk   # zip would otherwise keep removed files
zip -r -X ../songbooks/bach-for-guitar.sbk songbook.json tabs
```

Keep each song's `id` when editing: it is the stem of links like `/p/air`,
and favourites are stored by it, together with the book's URL. Run `npm test`
afterwards: it checks the edited `songbook.json` against the schema and for
repeated ids.

### About the transcriptions

The Guitar Pro files in the bundled book are community transcriptions gathered
from public tab sites. J. S. Bach's compositions are in the public domain, but
a transcription or arrangement can belong to whoever made it. The files are
included for personal study and are **not** covered by this project's MIT
license (see [LICENSE](LICENSE)). If you made one of them and want it credited
or removed, please open an issue.

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
| `r` | Loop the selection, or the whole piece |
| `t` | Show all tracks / first track only |
| `+` / `-` / `0` | Zoom in / out / reset |
| `f`, `b`, `l` | Full screen, toggle sidebar, cycle layout |

Click the star next to a piece in the sidebar to favourite it. Starred pieces
are repeated in a *Starred* section at the top of the sidebar. A star belongs
to its songbook: the same piece in a copy of the book is starred separately.
Favourites and the last-opened piece are stored in the browser's `localStorage`.

### Practising

- **Play along:** open the track list (the layers button in the toolbar) and
  click the speaker next to a track to mute it. The track stays on screen but
  goes silent, so you can play that part yourself; the others keep playing.
- **Loop:** press `r`, or click the loop button, to start over at the end.
- **Loop a passage:** drag across the score to select bars. Playback then
  covers only the selection (looping it, with loop on), and the toolbar shows
  which bars. A plain click in the score, `Esc`, or the bars button clears it.

Mutes and the selection belong to the open piece; loop, speed and the nylon
guitar setting carry over to the next one.

To try it, import `songbooks/MyJazzLick.gp5` (press `i`, or drop the file on
the app): three bars with the lick on a *Guitar* track and the chords on a
*Rhythm* track. Mute *Guitar* and play the lick over the chords. The file is
also what the end-to-end tests practise on; the app itself only publishes the
`.sbk` files in `songbooks/`.

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

## Deploying

TabViewer is a static site: `npm run build` writes everything to `dist/`, and
any static host can serve it. Two things matter on every host:

- **Deep links.** Paths like `/p/<piece>` are handled by the app, so the host
  must answer unknown paths with `index.html`. The app also expects to live at
  the root of its domain, not under a sub-path.
- **The soundfont.** Playback uses a 40 MB soundfont
  (`dist/soundfont/default.sf3`). On a host with a per-file size limit
  (Cloudflare allows 25 MiB), set `VITE_SOUNDFONT_URL` when building: either
  to a copy hosted elsewhere (it is fetched cross-origin, so its server must
  allow `GET` from your site via CORS), or to `/soundfont/sonivox.sf3`,
  alphaTab's small built-in bank (1 MB, noticeably thinner sound).

To ship your own songbooks, put `.sbk` files in `songbooks/` and list them in
`SUGGESTED_SONGBOOKS` in `src/lib/songbook.ts`; the first entry is the one a
first visit opens.

### Cloudflare Workers

`wrangler.jsonc` deploys `dist/` as a static-assets Worker, served at
`tab-viewer.<your-account>.workers.dev`:

```sh
VITE_SOUNDFONT_URL=/soundfont/sonivox.sf3 npm run build
npx wrangler deploy
```

To deploy from GitHub on every push to `main`, fork the repo and, under
*Settings → Secrets and variables → Actions*, add:

- Secret `CLOUDFLARE_API_TOKEN` (made from the *Edit Cloudflare Workers*
  template) and secret `CLOUDFLARE_ACCOUNT_ID`.
- Variable `CLOUDFLARE_DEPLOY` set to `true`.
- Optionally, variable `SOUNDFONT_URL` for a hosted full soundfont (without
  it the workflow builds with the small bundled bank), and variable
  `DEPLOY_DOMAIN` to serve the Worker on a custom domain in the same Cloudflare
  account instead of workers.dev.

Without `CLOUDFLARE_DEPLOY`, the workflow only lints, tests and builds, which
also runs on pull requests.

### Any other static server

Serve `dist/` with a fallback to `index.html`, for example:

```sh
npx serve -s dist
```

or, with nginx, `try_files $uri /index.html;` in the site's `location /`.

## Other scripts

```sh
npm run build     # production build into dist/
npm run preview   # serve the production build locally
npm run lint      # oxlint, including a complexity limit
npm test          # vitest: unit tests, and the songbook schema checks
npm run test:e2e  # Playwright: builds the app and drives it in Chromium
```
