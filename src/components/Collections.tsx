import { Library, X } from 'lucide-react'
import { useState } from 'react'
import { SectionLabel } from '@/components/SectionLabel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCollectionListings } from '@/hooks/useCollectionListings'
import type { UseCollections } from '@/hooks/useCollections'
import type { CollectionBook } from '@/lib/collection'
import type { CollectionListing } from '@/lib/collectionClient'
import { cn } from '@/lib/utils'

interface BookRowProps {
  /** URL of the open book, which is highlighted where a collection lists it. */
  activeUrl: string | undefined
  /** Whether a songbook is being loaded, so another cannot be picked. */
  loading: boolean
  onOpen: (url: string) => void
}

/** "4 pieces", or nothing when the collection does not say. */
function pieceCount(songs: number | undefined): string | null {
  if (songs === undefined) return null
  return songs === 1 ? '1 piece' : `${songs} pieces`
}

function BookRow({ book, activeUrl, loading, onOpen }: BookRowProps & { book: CollectionBook }) {
  const active = book.url === activeUrl
  const detail = [book.description, pieceCount(book.songs)].filter(Boolean).join(' · ')
  return (
    <li>
      <button
        type="button"
        disabled={loading}
        onClick={() => onOpen(book.url)}
        className={cn(
          'w-full rounded-md px-2.5 py-1.5 text-left transition-colors disabled:opacity-50',
          active ? 'bg-neutral-900 text-white' : 'text-neutral-700 hover:bg-neutral-200',
        )}
        title={book.url}
      >
        <span className="block truncate text-sm">{book.name}</span>
        {detail && (
          <span
            className={cn('block truncate text-xs', active ? 'text-neutral-300' : 'text-neutral-500')}
          >
            {detail}
          </span>
        )}
      </button>
    </li>
  )
}

interface ListingBodyProps extends BookRowProps {
  listing: CollectionListing
  onRetry: () => void
}

/** What a collection holds: its books, or where fetching them stands. */
function ListingBody({ listing, onRetry, ...row }: ListingBodyProps) {
  if (listing.status === 'loading') {
    return <p className="px-2.5 py-1.5 text-xs text-neutral-500">Loading…</p>
  }
  if (listing.status === 'error') {
    return (
      <div className="px-2.5 py-1.5">
        <p className="text-xs whitespace-pre-line text-red-700">{listing.error}</p>
        <button type="button" onClick={onRetry} className="mt-1 text-xs underline hover:text-neutral-900">
          Retry
        </button>
      </div>
    )
  }
  const { books } = listing.collection
  if (books.length === 0) {
    return <p className="px-2.5 py-1.5 text-xs text-neutral-500">No books in this collection yet.</p>
  }
  return (
    <ul className="space-y-1">
      {books.map((book) => (
        <BookRow key={book.url} book={book} {...row} />
      ))}
    </ul>
  )
}

interface ListingProps extends ListingBodyProps {
  onRemove: () => void
}

/** One collection: its name as it is now, a way to remove it, and its books. */
function Listing({ listing, onRemove, ...body }: ListingProps) {
  const name = listing.status === 'ready' ? listing.collection.name : listing.name
  return (
    <li aria-label={name}>
      <div className="flex items-center gap-1">
        <Library className="size-4 shrink-0 text-neutral-500" />
        <h4 className="w-0 flex-1 truncate text-sm font-medium text-neutral-900" title={listing.url}>
          {name}
        </h4>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 rounded-md p-1.5 text-neutral-400 transition-colors hover:text-red-600"
          aria-label={`Remove ${name}`}
          title="Remove this collection"
        >
          <X className="size-4" />
        </button>
      </div>
      <ListingBody listing={listing} {...body} />
    </li>
  )
}

type AddFormProps = Pick<UseCollections, 'adding' | 'error' | 'add'>

function AddCollectionForm({ adding, error, add }: AddFormProps) {
  const [url, setUrl] = useState('')
  const target = url.trim()

  const submit = async () => {
    if (await add(target)) setUrl('')
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (target) void submit()
      }}
    >
      <div className="flex gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/songbooks/"
          aria-label="Collection URL"
          className="h-9 bg-white"
        />
        <Button type="submit" variant="outline" disabled={adding || !target}>
          {adding ? 'Adding…' : 'Add'}
        </Button>
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        A collection is an address that lists songbooks. It is kept in this browser, and shows
        what it lists each time you open this.
      </p>
      {error && <p className="mt-2 text-xs whitespace-pre-line text-red-700">{error}</p>}
    </form>
  )
}

interface CollectionsProps extends BookRowProps {
  collections: UseCollections
}

/** The collections added in this browser with the books each lists, and a field to add one. */
export function Collections({ collections, ...row }: CollectionsProps) {
  const { saved, remove } = collections
  const { listings, retry } = useCollectionListings(saved)

  return (
    <section>
      <SectionLabel>Collections</SectionLabel>
      {listings.length > 0 && (
        <ul className="mb-3 space-y-3">
          {listings.map((listing) => (
            <Listing
              key={listing.url}
              listing={listing}
              onRemove={() => remove(listing.url)}
              onRetry={() => retry(listing.url)}
              {...row}
            />
          ))}
        </ul>
      )}
      <AddCollectionForm adding={collections.adding} error={collections.error} add={collections.add} />
    </section>
  )
}
