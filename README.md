# tab-viewer

A browser-based reader and player for a collection of Guitar Pro tablature,
built on [alphaTab](https://www.alphatab.net/), React and Vite. Made for
reading Bach at the guitar: page through a score with the keyboard, play it
back at reduced speed on a nylon-string sound, and star the pieces you are
working on.

## Starting the app

```sh
npm install
npm run dev
```

Then open http://localhost:5173/. Node.js 20 or newer is required.

`npm run dev` (and `npm run build`) first run two preparation scripts:

- **`npm run manifest`** copies every file from `collection/tabs/` into
  `public/tabs/` under an ASCII slug name and writes `src/data/tabs.json`,
  which is the list the app renders. Reruns are instant; only changed files
  are copied.
- **`npm run soundfont`** downloads the MuseScore_General soundfont (~40 MB,
  one time) into `public/soundfont/`. Playback uses it instead of alphaTab's
  bundled feature-phone bank. If the download fails, it falls back to the
  bundled bank so playback still works offline. Skipped when
  `VITE_SOUNDFONT_URL` is set (see Deployment).

`public/tabs/`, `public/soundfont/` and `src/data/tabs.json` are generated
and git-ignored.

## The collection

The tabs live in the repo:

```
collection/
├── index.csv                one row per piece
├── sources.csv              download URLs, git-ignored
├── tabs/                    the .gp3 / .gp4 / .gp5 files
└── multi-instrument-tabs/   pieces with more than one track, same layout
    ├── index.csv
    ├── sources.csv
    └── tabs/
```

Only `collection/tabs/` is served by the app. `multi-instrument-tabs/` holds
the files written for several tracks (guitar duets, organ scores, piano
left/right hand, ensembles) that were set aside because they are not solo
guitar pieces. It is not built or deployed; move a row and its file back into
the top-level `index.csv` and `tabs/` to include one.

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
| `/` or `Ctrl+K` | Search the collection |
| `Space`, `s` | Play / pause, stop |
| `,` / `.` | Slower / faster |
| `g` | Play everything on nylon guitar |
| `t` | Show all tracks / first track only |
| `f`, `b`, `l` | Full screen, toggle sidebar, cycle layout |

Click the star next to a piece in the sidebar to favourite it. Favourites and
the last-opened piece are stored in the browser's `localStorage`.

### Importing your own tabs

Press `i`, click *Import* in the toolbar, or drop `.gp3` / `.gp4` / `.gp5` /
`.gpx` / `.gp` files anywhere in the window to add pieces that are not part of
the deployed collection. They are stored in the browser's IndexedDB, so they
survive reloads but never leave your machine, and are listed under *Imported*
at the top of the sidebar with a button to remove them again. The title and
artist come from the file's own metadata, falling back to the file name.

## Deployment

`.github/workflows/deploy.yml` builds on every push to `main` and deploys
`dist/` to Cloudflare Pages with Wrangler.

The soundfont is not deployed with the site: Cloudflare Pages rejects files
over 25 MiB and `MuseScore_General.sf3` is 40 MB. Instead the build points the
player at a hosted copy via `VITE_SOUNDFONT_URL`. One-time setup:

1. Create an R2 bucket, upload `MuseScore_General.sf3` (the file
   `npm run soundfont` saves as `public/soundfont/default.sf3`), and enable
   public access on the bucket (or attach a custom domain).
2. Add a CORS rule to the bucket allowing `GET` from the Pages site's origin.
   The player fetches the font cross-origin, so without this it fails to
   load.
3. In the GitHub repo, under *Settings → Secrets and variables → Actions*:
   - Variable `SOUNDFONT_URL`: the public URL of the `.sf3` file.
   - Secret `CLOUDFLARE_API_TOKEN`: a token with the *Cloudflare Pages: Edit*
     permission.
   - Secret `CLOUDFLARE_ACCOUNT_ID`.
4. Create a Pages project named `tab-viewer` (Wrangler creates it on first
   deploy if it does not exist).

## Other scripts

```sh
npm run build     # production build into dist/
npm run preview   # serve the production build locally
npm run lint      # oxlint
```
