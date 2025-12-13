import { useMemo, useState } from "react"
import type { Book, ReadingStatus } from "./types"
import booksSeed from "./data/books.json"
import { fetchBookFromISBN } from "./services/isbn"
import { getBooksFile, putBooksFile } from "./services/github"

/* =========================
   Utility
========================= */

function nowISO(): string {
  return new Date().toISOString()
}

function normaliseAuthors(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x.length > 0)
}

/* =========================
   App
========================= */

export default function App() {
  /* ---------- Persistent data ---------- */

  const [books, setBooks] = useState<Book[]>(booksSeed as Book[])

  /* ---------- GitHub ---------- */

  const [token, setToken] = useState<string>("")

  /* ---------- Staging ---------- */

  const [staging, setStaging] = useState<Book[]>([])

  /* ---------- Form fields ---------- */

  const [isbn, setIsbn] = useState<string>("")
  const [title, setTitle] = useState<string>("")
  const [authors, setAuthors] = useState<string>("")
  const [publisher, setPublisher] = useState<string>("")
  const [year, setYear] = useState<string>("")
  const [language, setLanguage] = useState<string>("")
  const [category, setCategory] = useState<string>("")
  const [coverUrl, setCoverUrl] = useState<string>("")
  const [status, setStatus] = useState<ReadingStatus>("Non letto")

  const [message, setMessage] = useState<string>("")

  /* =========================
     Derived
  ========================= */

  const sortedBooks = useMemo(() => {
    return [...books].sort((a, b) => {
      const ya = a.year ?? -1
      const yb = b.year ?? -1
      if (ya !== yb) return yb - ya
      return a.title.localeCompare(b.title)
    })
  }, [books])

  /* =========================
     ISBN autofill
  ========================= */

  async function autofillFromISBN() {
    if (!isbn.trim()) {
      setMessage("Inserisci un ISBN.")
      return
    }

    setMessage("Recupero metadati da ISBN…")

    try {
      const b = await fetchBookFromISBN(isbn)

      setTitle(b.title)
      setAuthors(b.authors.join(", "))
      setPublisher(b.publisher ?? "")
      setYear(b.year ? String(b.year) : "")
      setLanguage(b.language ?? "")
      setCoverUrl(b.coverUrl ?? "")

      setMessage("Metadati caricati. Verifica e aggiungi.")
    } catch (err: any) {
      setMessage(err?.message ?? "Errore durante il recupero ISBN.")
    }
  }

  /* =========================
     Add to staging
  ========================= */

  function addToStaging() {
    if (!title.trim()) {
      setMessage("Il titolo è obbligatorio.")
      return
    }

    const book: Book = {
      isbn: isbn.trim() || undefined,
      title: title.trim(),
      authors: normaliseAuthors(authors),
      publisher: publisher.trim() || undefined,
      year: year ? parseInt(year, 10) : undefined,
      language: language.trim() || undefined,
      category: category.trim() || undefined,
      coverUrl: coverUrl.trim() || undefined,
      status,
      addedAt: nowISO(),
    }

    setStaging((prev) => [...prev, book])

    /* reset form (ma NON il token) */
    setIsbn("")
    setTitle("")
    setAuthors("")
    setPublisher("")
    setYear("")
    setLanguage("")
    setCategory("")
    setCoverUrl("")
    setStatus("Non letto")

    setMessage("Libro aggiunto alla lista temporanea.")
  }

  /* =========================
     Commit all
  ========================= */

  async function commitAll() {
    if (!token.trim()) {
      alert("Inserisci il GitHub token.")
      return
    }

    if (staging.length === 0) {
      alert("Nessun libro da salvare.")
      return
    }

    setMessage("Commit in corso…")

    try {
      const file = await getBooksFile(token)
      const current = JSON.parse(file.content) as Book[]

      const merged = [...current]

      for (const b of staging) {
        const exists =
          b.isbn &&
          merged.some((x) => x.isbn && x.isbn === b.isbn)

        if (!exists) merged.push(b)
      }

      await putBooksFile(token, merged, file.sha)

      setBooks(merged)
      setStaging([])
      setMessage("Commit completato. Ricarica tra qualche secondo.")
    } catch (err: any) {
      setMessage(err?.message ?? "Errore durante il commit.")
    }
  }

  /* =========================
     Render
  ========================= */

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", fontFamily: "system-ui" }}>
      <h1>Personal Library</h1>

      {/* ---------- Token ---------- */}
      <section style={{ marginBottom: 24 }}>
        <h3>GitHub token</h3>
        <input
          type="password"
          placeholder="Personal access token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          style={{ width: "100%" }}
        />
      </section>

      {/* ---------- Add book ---------- */}
      <section style={{ padding: 16, border: "1px solid #ddd", borderRadius: 8 }}>
        <h3>Aggiungi libro</h3>

        <div style={{ display: "flex", gap: 8 }}>
          <input
            placeholder="ISBN (opzionale)"
            value={isbn}
            onChange={(e) => setIsbn(e.target.value)}
            style={{ flex: 1 }}
          />
          <button onClick={autofillFromISBN}>
            Autocompleta da ISBN
          </button>
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          <input
            placeholder="Titolo"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            placeholder="Autori (separati da virgola)"
            value={authors}
            onChange={(e) => setAuthors(e.target.value)}
          />
          <input
            placeholder="Editore"
            value={publisher}
            onChange={(e) => setPublisher(e.target.value)}
          />
          <input
            placeholder="Anno"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
          <input
            placeholder="Lingua"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          />
          <input
            placeholder="Categoria"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <input
            placeholder="URL copertina"
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
          />

          <select
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as ReadingStatus)
            }
          >
            <option value="Letto">Letto</option>
            <option value="Non letto">Non letto</option>
            <option value="In lettura">In lettura</option>
            <option value="Da acquistare">Da acquistare</option>
          </select>
        </div>

        <button
          style={{ marginTop: 12 }}
          onClick={addToStaging}
        >
          Aggiungi alla lista
        </button>

        <p style={{ fontStyle: "italic" }}>{message}</p>
      </section>

      {/* ---------- Staging ---------- */}
      <section style={{ marginTop: 24 }}>
        <h3>Libri da salvare ({staging.length})</h3>

        {staging.map((b, i) => (
          <div key={i} style={{ padding: 8, borderBottom: "1px solid #eee" }}>
            <strong>{b.title}</strong>{" "}
            {b.authors.length > 0 && `— ${b.authors.join(", ")}`}
          </div>
        ))}

        <button
          style={{ marginTop: 12 }}
          onClick={commitAll}
        >
          Commit all books
        </button>
      </section>

      {/* ---------- Library ---------- */}
      <section style={{ marginTop: 32 }}>
        <h2>Libreria ({sortedBooks.length})</h2>

        {sortedBooks.map((b, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 12,
              padding: 12,
              border: "1px solid #eee",
              borderRadius: 8,
              marginBottom: 8,
            }}
          >
            {b.coverUrl && (
              <img
                src={b.coverUrl}
                alt=""
                style={{ height: 100, objectFit: "contain" }}
              />
            )}
            <div>
              <div style={{ fontWeight: 700 }}>{b.title}</div>
              <div>{b.authors.join(", ")}</div>
              <div style={{ opacity: 0.8 }}>
                {b.publisher} · {b.year} · {b.language}
              </div>
              <div>
                <em>{b.status}</em>
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
