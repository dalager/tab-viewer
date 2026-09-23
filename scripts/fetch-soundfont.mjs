// Downloads the playback soundfont into public/soundfont/default.sf3.
//
// alphaTab bundles SONiVOX EAS, a ~1.3 MB bank ported from feature-phone
// firmware with 11-32 kHz samples. It is why playback sounds like a 2006 Nokia.
// MuseScore_General is a full-quality GM bank; alphaTab reads the Vorbis
// compressed .sf3 form natively, so it costs ~40 MB instead of ~200 MB.
//
// Falls back to the bundled SONiVOX font when the download is unavailable, so
// a machine with no network still gets working playback.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(here, '..')

const OUT_DIR = path.join(appRoot, 'public', 'soundfont')
const TARGET = path.join(OUT_DIR, 'default.sf3')

// MuseScore_General.sf3 — MIT licensed, by S. Christian Collins.
const EXPECTED_BYTES = 39_900_972
const MIRRORS = [
  'https://ftp.osuosl.org/pub/musescore/soundfont/MuseScore_General/MuseScore_General.sf3',
  'https://huggingface.co/MuScriptor/assets/resolve/main/MuseScore_General.sf3',
]

const FALLBACK = path.join(
  appRoot,
  'node_modules',
  '@coderline',
  'alphatab',
  'dist',
  'soundfont',
  'sonivox.sf3',
)

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

function fallbackToBundled(reason) {
  console.warn(`fetch-soundfont: ${reason}`)
  if (!fs.existsSync(FALLBACK)) {
    console.warn('fetch-soundfont: bundled soundfont missing too; playback will not work')
    return
  }
  fs.copyFileSync(FALLBACK, TARGET)
  console.warn(`fetch-soundfont: fell back to the bundled SONiVOX bank (${mb(fs.statSync(TARGET).size)})`)
}

async function download(url) {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)

  const total = Number(response.headers.get('content-length')) || 0
  const chunks = []
  let received = 0
  let lastLogged = 0

  for await (const chunk of response.body) {
    chunks.push(chunk)
    received += chunk.length
    // One line per 10 MB, so CI logs stay readable.
    if (received - lastLogged > 10 * 1024 * 1024) {
      lastLogged = received
      console.log(`fetch-soundfont:   ${mb(received)}${total ? ` / ${mb(total)}` : ''}`)
    }
  }

  return Buffer.concat(chunks)
}

// Production points the player at a hosted copy (see src/score/settings.ts),
// so nothing needs to land in public/ — and must not, since Cloudflare Pages
// rejects files over 25 MiB.
if (process.env.VITE_SOUNDFONT_URL) {
  console.log(`fetch-soundfont: skipped, using ${process.env.VITE_SOUNDFONT_URL}`)
  process.exit(0)
}

fs.mkdirSync(OUT_DIR, { recursive: true })

if (fs.existsSync(TARGET) && fs.statSync(TARGET).size === EXPECTED_BYTES) {
  console.log(`fetch-soundfont: already present (${mb(EXPECTED_BYTES)})`)
  process.exit(0)
}

console.log(`fetch-soundfont: downloading MuseScore_General.sf3 (${mb(EXPECTED_BYTES)}), one time only…`)

let saved = false
for (const url of MIRRORS) {
  try {
    const data = await download(url)
    if (data.length !== EXPECTED_BYTES) {
      console.warn(
        `fetch-soundfont: ${new URL(url).host} returned ${mb(data.length)}, expected ${mb(EXPECTED_BYTES)} — skipping`,
      )
      continue
    }
    fs.writeFileSync(TARGET, data)
    console.log(`fetch-soundfont: saved public/soundfont/default.sf3 (${mb(data.length)})`)
    saved = true
    break
  } catch (e) {
    console.warn(`fetch-soundfont: ${new URL(url).host} failed — ${e.message}`)
  }
}

// Never fail the build over this: a worse-sounding player still works.
if (!saved) fallbackToBundled('could not download the high-quality soundfont')
