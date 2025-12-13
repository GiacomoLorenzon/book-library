import type { Book } from "../types"

function normaliseIsbn(isbn: string): string {
  return isbn.replace(/[^0-9Xx]/g, "").toUpperCase()
}

export async function fetchBookFromISBN(isbnInput: string): Promise<Book> {
  const isbn = normaliseIsbn(isbnInput)

  // 1) Open Library
  const ol = await fetch(`https://openlibrary.org/isbn/${isbn}.json`)
  if (ol.ok) {
    const raw = await ol.json()

    // authors: OpenLibrary spesso dà solo chiavi; proviamo a risolverle, ma senza complicare troppo
    let authors: string[] = []
    if (Array.isArray(raw.authors) && raw.authors.length > 0) {
      const names = await Promise.all(
        raw.authors.map(async (a: any) => {
          if (!a?.key) return null
          const r = await fetch(`https://openlibrary.org${a.key}.json`)
          if (!r.ok) return null
          const ar = await r.json()
          return ar?.name ?? null
        })
      )
      authors = names.filter(Boolean) as string[]
    }

    const year = (() => {
      const s = String(raw.publish_date ?? "")
      const m = s.match(/(\d{4})/)
      return m ? parseInt(m[1], 10) : undefined
    })()

    return {
      isbn,
      title: raw.title ?? "(untitled)",
      authors,
      publisher: Array.isArray(raw.publishers) ? raw.publishers[0] : undefined,
      year,
      pages: raw.number_of_pages,
      language: Array.isArray(raw.languages) ? raw.languages?.[0]?.key : undefined,
      coverUrl: `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`,
      addedAt: new Date().toISOString(),
    }
  }

  // 2) Fallback Google Books (senza API key: spesso funziona lo stesso, ma non garantito)
  const gb = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`
  )
  if (gb.ok) {
    const raw = await gb.json()
    const item = raw.items?.[0]?.volumeInfo
    if (item) {
      const year = item.publishedDate ? parseInt(String(item.publishedDate).slice(0, 4), 10) : undefined
      return {
        isbn,
        title: item.title ?? "(untitled)",
        authors: item.authors ?? [],
        publisher: item.publisher,
        year: Number.isFinite(year) ? year : undefined,
        pages: item.pageCount,
        language: item.language,
        coverUrl: item.imageLinks?.thumbnail,
        addedAt: new Date().toISOString(),
      }
    }
  }

  throw new Error("ISBN non trovato su Open Library / Google Books.")
}
