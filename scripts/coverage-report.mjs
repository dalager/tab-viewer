// Merges unit and end-to-end coverage into one report.
//
// Both runs use Istanbul, over the same files (COVERAGE_INCLUDE in
// vite.config.ts). Vitest reports lines of the TypeScript sources; the
// browser reports lines of the compiled code, with its source map, so those
// are mapped back first (see endlessStatementHits for the few that do not map
// whole). Then the counts add up file by file:
//   coverage/unit/coverage-final.json   npm run coverage:unit (vitest)
//   coverage/e2e/*.json                 npm run coverage:e2e (one per test)
// It prints each suite's totals and the combined per-file table, and writes
// HTML, lcov and a JSON summary of the combined figures to coverage/report/.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping'
import libCoverage from 'istanbul-lib-coverage'
import libReport from 'istanbul-lib-report'
import libSourceMaps from 'istanbul-lib-source-maps'
import reports from 'istanbul-reports'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const UNIT = path.join(root, 'coverage/unit/coverage-final.json')
const E2E_DIR = path.join(root, 'coverage/e2e')
const OUT_DIR = path.join(root, 'coverage/report')

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function unitMap() {
  if (!fs.existsSync(UNIT)) {
    console.error(`\n  coverage-report: no ${path.relative(root, UNIT)}; run npm run coverage:unit\n`)
    process.exit(1)
  }
  return libCoverage.createCoverageMap(readJson(UNIT))
}

/** Every end-to-end test's counts added up, in positions of the compiled code. */
function rawBrowserMap() {
  const files = fs.existsSync(E2E_DIR) ? fs.readdirSync(E2E_DIR).filter((f) => f.endsWith('.json')) : []
  if (files.length === 0) {
    console.error(`\n  coverage-report: nothing in ${path.relative(root, E2E_DIR)}/; run npm run coverage:e2e\n`)
    process.exit(1)
  }
  const map = libCoverage.createCoverageMap({})
  for (const file of files) map.merge(readJson(path.join(E2E_DIR, file)))
  return map
}

/**
 * Every measured file with no hits. The unit run lists them all, loaded or
 * not; the browser only reports files the app loaded, so without this a file
 * no test reaches would drop out of the end-to-end figure instead of counting
 * as 0%.
 */
function allFilesUncovered(unit) {
  const blank = libCoverage.createCoverageMap(JSON.parse(JSON.stringify(unit.toJSON())))
  for (const file of blank.files()) blank.fileCoverageFor(file).resetHits()
  return blank
}

/** A new map of the maps' counts added up; merging in place would change the inputs. */
function mergedMap(...maps) {
  const map = libCoverage.createCoverageMap({})
  for (const m of maps) map.merge(JSON.parse(JSON.stringify(m.toJSON())))
  return map
}

const locationKey = ({ start, end }) => `${start.line}:${start.column}-${end.line}:${end.column}`
const startKey = ({ line, column }) => `${line}:${column}`

/**
 * Hits of the compiled statements whose end has no source position, by file
 * and the source position of their start. These are multi-line JSX
 * `return (...)` blocks: the source-map step drops them for want of an end,
 * though where they start is known.
 */
function endlessStatementHits(raw) {
  const byFile = new Map()
  for (const file of raw.files()) {
    const { statementMap, s, inputSourceMap } = raw.fileCoverageFor(file).data
    if (!inputSourceMap) continue
    const trace = new TraceMap(inputSourceMap)
    const starts = new Map()
    for (const [id, loc] of Object.entries(statementMap)) {
      if (originalPositionFor(trace, loc.end).line !== null) continue
      const start = originalPositionFor(trace, loc.start)
      if (start.line === null) continue
      const key = startKey(start)
      starts.set(key, (starts.get(key) ?? 0) + s[id])
    }
    byFile.set(file, starts)
  }
  return byFile
}

/**
 * Credits the end-to-end hits of statements the source-map step dropped
 * (see endlessStatementHits) to the statement starting at the same place,
 * and counts those it could not place. Changes `e2e` in place.
 */
function creditEndlessStatements(e2e, browser, hits) {
  let unplaced = 0
  for (const file of e2e.files()) {
    const mapped = new Set(
      browser.files().includes(file) ? Object.values(browser.fileCoverageFor(file).statementMap).map(locationKey) : [],
    )
    const starts = hits.get(file)
    if (!starts) continue
    const { statementMap, s } = e2e.fileCoverageFor(file).data
    for (const [id, loc] of Object.entries(statementMap)) {
      if (mapped.has(locationKey(loc))) continue
      const found = starts.get(startKey(loc.start))
      if (found === undefined) unplaced++
      else s[id] += found
    }
  }
  return unplaced
}

const pct = (metric) => `${metric.pct.toFixed(1)}%`.padStart(9)

function printTotals(rows) {
  console.log(`\n${''.padEnd(12)}${'Lines'.padStart(9)}${'Branches'.padStart(9)}${'Functions'.padStart(11)}`)
  for (const [name, map] of rows) {
    const s = map.getCoverageSummary()
    console.log(`${name.padEnd(12)}${pct(s.lines)}${pct(s.branches)}${pct(s.functions).padStart(11)}`)
  }
  console.log()
}

const unit = unitMap()
const blank = allFilesUncovered(unit)
const raw = rawBrowserMap()
// Through JSON like the unit file, so an end-of-line column is null in both.
const browser = mergedMap(await libSourceMaps.createSourceMapStore().transformCoverage(raw))
const e2e = mergedMap(blank, browser)
const unplaced = creditEndlessStatements(e2e, browser, endlessStatementHits(raw))
const combined = mergedMap(unit, e2e)

const context = libReport.createContext({ dir: OUT_DIR, coverageMap: combined, defaultSummarizer: 'nested' })
reports.create('text', { skipFull: false }).execute(context)
for (const reporter of ['html', 'lcovonly', 'json-summary']) reports.create(reporter).execute(context)

printTotals([
  ['Unit', unit],
  ['End-to-end', e2e],
  ['Combined', combined],
])
if (unplaced > 0) {
  console.log(`${unplaced} statements from the browser run could not be mapped to a source position; they count as uncovered.`)
}
console.log(`HTML report: ${path.relative(root, path.join(OUT_DIR, 'index.html'))}\n`)
