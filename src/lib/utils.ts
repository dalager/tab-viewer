export { cn } from "cn"

/** Readable text for anything a promise or catch block can throw. */
export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/** What follows the last `separator` in `text`, or all of it when there is none. */
export function afterLast(text: string, separator: string): string {
  return text.slice(text.lastIndexOf(separator) + 1)
}

/** Whether a response body is a web page: what a host sends for a missing file or a sign-in. */
export function looksLikeHtml(text: string): boolean {
  return text.trimStart().startsWith('<')
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
