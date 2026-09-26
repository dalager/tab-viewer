export { cn } from "cn"

/** Readable text for anything a promise or catch block can throw. */
export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
