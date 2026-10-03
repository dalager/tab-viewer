// The saved list of collections: what is read back from localStorage, and
// adding and removing entries.

import { describe, expect, it } from 'vitest'
import { parseSaved, withAdded, without } from '@/lib/savedCollections'

const EASY = { url: 'https://store.example/easy/', name: 'Easy' }
const HARD = { url: 'https://store.example/hard/', name: 'Hard' }

describe('parseSaved', () => {
  it('reads back what was stored', () => {
    expect(parseSaved(JSON.stringify([EASY, HARD]))).toEqual([EASY, HARD])
  })

  it.each([null, '', '{not json', '{"url":"x"}', '7'])('reads %j as no collections', (raw) => {
    expect(parseSaved(raw)).toEqual([])
  })

  it('drops entries that are not collections', () => {
    const raw = JSON.stringify([EASY, null, 'x', { url: 'https://x.example/' }, { url: 1, name: 'n' }])
    expect(parseSaved(raw)).toEqual([EASY])
  })
})

describe('withAdded', () => {
  it('adds a new collection at the end', () => {
    expect(withAdded([EASY], HARD)).toEqual([EASY, HARD])
  })

  it('keeps one entry for a collection added again, taking its new name', () => {
    const renamed = { ...EASY, name: 'Easier' }
    expect(withAdded([EASY, HARD], renamed)).toEqual([renamed, HARD])
  })
})

describe('without', () => {
  it('removes the collection at that address', () => {
    expect(without([EASY, HARD], EASY.url)).toEqual([HARD])
  })
})
