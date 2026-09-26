export { cn } from "cn"

/** Readable text for anything a promise or catch block can throw. */
export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/** Fetches a file as bytes; works for http and blob URLs alike. */
export async function fetchBytes(url: string): Promise<Uint8Array<ArrayBuffer>> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
  return new Uint8Array(await response.arrayBuffer())
}

/** Pieces whose title contains the query, ignoring case; all of them for a blank query. */
export function filterTabs<T extends { title: string }>(tabs: T[], query: string): T[] {
  const q = query.trim().toLowerCase()
  return q ? tabs.filter((t) => t.title.toLowerCase().includes(q)) : tabs
}
