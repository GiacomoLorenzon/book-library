import { useMemo, useState } from "react"
import type { Book, ReadingStatus } from "./types"
import booksSeed from "./data/books.json"
import { fetchBookFromISBN } from "./services/isbn"
import { getBooksFile, putBooksFile } from "./services/github"

/* =========================
   Utilities
========================= */

function nowISO(): string {
  return new Date().toISOString()
}

function parseAuthors(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
}

function sameBook(a: Book, b: Book): boolean {
  if (a.isbn && b.isbn) return a.isbn === b.isbn
  return a.addedAt === b.addedAt
}

/* =========================
   App
========================= */

export default function App() {
  /* ---------- Working copy ---------- */

  const [workingBooks, setWorkingBooks] = useState<Book[]>(
    booksSeed as Book[]
  )
  const [dirty, setDirty] = useState(false)

  /* ---------- GitHub ---------- */

  const [token, setToken] = useState("")
  const [message, setMessage] = useState("")

  /* ---------- Editing state ---------- */

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Book | null>(null)

  /* ---------- Add-book form ---------- */

  const [isbn, setIsbn] = useState("")
  const [title, setTitle] = useState("")
  const [authors, setAuthors] = useState("")
  const [publisher, setPublisher] = useState("")
  const [year, setYear] = useState("")
  const [language, setLanguage] = useState("")
  const [category, setCategory] = useState("")
  const [coverUrl, setCoverUrl] = useState("")
  const [status, setStatus] = useState<ReadingStatus>("Non letto")

  /* =========================
     Derived
  ========================= */

  const sortedBooks = useMemo(() => {
    return [...workingBooks].sort((a, b) => {
      const ya = a.year ?? -1
      const yb = b.year ?? -1
      if (ya !== yb) return yb - ya
      return a.title.localeCompare(b.title)
    })
  }, [workingBooks])

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
      setStatus(b.status)

      setMessage("Metadati caricati.")
    } catch (err: any) {
      setMessage(err?.message ?? "Errore ISBN.")
    }
  }

  /* =========================
     Add new book
  ========================= */

  function addBook() {
    if (!title.trim()) {
      setMessage("Il titolo è obbligatorio.")
      return
    }

    const book: Book = {
      isbn: isbn.trim() || undefined,
      title: title.trim(),
      authors: parseAuthors(authors),
      publisher: publisher.trim() || undefined,
      year: year ? parseInt(year, 10) : undefined,
      language: language.trim() || undefined,
      category: category.trim() || undefined,
      coverUrl: coverUrl.trim() || undefined,
      status,
      addedAt: nowISO(),
    }

    setWorkingBooks((prev) => [...prev, book])
    setDirty(true)

    setIsbn("")
    setTitle("")
    setAuthors("")
    setPublisher("")
    setYear("")
    setLanguage("")
    setCategory("")
    setCoverUrl("")
    setStatus("Non letto")

    setMessage("Libro aggiunto (non ancora salvato).")
  }

  /* =========================
     Editing logic
  ========================= */

  function startEdit(book: Book) {
    setEditingId(book.isbn ?? book.addedAt)
    setEditDraft({ ...book })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDraft(null)
  }

  function saveEdit() {
    if (!editDraft) return

    setWorkingBooks((prev) =>
      prev.map((b) => (sameBook(b, editDraft) ? editDraft : b))
    )
    setDirty(true)
    cancelEdit()
  }

  /* =========================
     Commit
  ========================= */

  async function commitChanges() {
    if (!token.trim()) {
      alert("Inserisci il GitHub token.")
      return
    }

    setMessage("Commit in corso…")

    try {
      const file = await getBooksFile(token)
      await putBooksFile(token, workingBooks, file.sha)
      setDirty(false)
      setMessage("Modifiche salvate.")
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
      <section>
        <input
          type="password"
          placeholder="GitHub token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          style={{ width: "100%" }}
        />
      </section>

      {/* ---------- Add book ---------- */}
      <section style={{ marginTop: 20 }}>
        <h3>Aggiungi libro</h3>
        <input placeholder="ISBN" value={isbn} onChange={(e) => setIsbn(e.target.value)} />
        <button onClick={autofillFromISBN}>Autocompleta</button>

        <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
          <input placeholder="Titolo" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input placeholder="Autori" value={authors} onChange={(e) => setAuthors(e.target.value)} />
          <input placeholder="Editore" value={publisher} onChange={(e) => setPublisher(e.target.value)} />
          <input placeholder="Anno" value={year} onChange={(e) => setYear(e.target.value)} />
          <input placeholder="Lingua" value={language} onChange={(e) => setLanguage(e.target.value)} />
          <input placeholder="Categoria" value={category} onChange={(e) => setCategory(e.target.value)} />
          <input placeholder="Copertina URL" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} />

          <select value={status} onChange={(e) => setStatus(e.target.value as ReadingStatus)}>
            <option value="letto">Letto</option>
            <option value="Non letto">Non letto</option>
            <option value="in lettura">In lettura</option>
            <option value="da acquistare">Da acquistare</option>
          </select>
        </div>

        <button onClick={addBook} style={{ marginTop: 10 }}>
          Aggiungi
        </button>
      </section>

      {/* ---------- Commit ---------- */}
      <section style={{ marginTop: 20 }}>
        <button disabled={!dirty} onClick={commitChanges}>
          Commit changes
        </button>
        {dirty && <span> ● modifiche non salvate</span>}
        <p>{message}</p>
      </section>

      {/* ---------- Library ---------- */}
      <section style={{ marginTop: 30 }}>
        <h2>Libreria</h2>

        {sortedBooks.map((b) => {
          const id = b.isbn ?? b.addedAt
          const isEditing = editingId === id

          return (
            <div key={id} style={{ border: "1px solid #ddd", padding: 12, marginBottom: 8 }}>
              {!isEditing ? (
                <>
                  <strong>{b.title}</strong> — {b.authors.join(", ")}  
                  <div>{b.publisher} · {b.year} · {b.language}</div>
                  <div>{b.category} · <em>{b.status}</em></div>
                  <button onClick={() => startEdit(b)}>Modifica</button>
                </>
              ) : (
                <>
                  <input value={editDraft!.title} onChange={(e) => setEditDraft({ ...editDraft!, title: e.target.value })} />
                  <input value={editDraft!.authors.join(", ")} onChange={(e) => setEditDraft({ ...editDraft!, authors: parseAuthors(e.target.value) })} />
                  <input value={editDraft!.publisher ?? ""} onChange={(e) => setEditDraft({ ...editDraft!, publisher: e.target.value })} />
                  <input value={editDraft!.year ?? ""} onChange={(e) => setEditDraft({ ...editDraft!, year: parseInt(e.target.value, 10) })} />
                  <input value={editDraft!.language ?? ""} onChange={(e) => setEditDraft({ ...editDraft!, language: e.target.value })} />
                  <input value={editDraft!.category ?? ""} onChange={(e) => setEditDraft({ ...editDraft!, category: e.target.value })} />

                  <select
                    value={editDraft!.status}
                    onChange={(e) => setEditDraft({ ...editDraft!, status: e.target.value as ReadingStatus })}
                  >
                    <option value="letto">Letto</option>
                    <option value="Non letto">Non letto</option>
                    <option value="in lettura">In lettura</option>
                    <option value="da acquistare">Da acquistare</option>
                  </select>

                  <button onClick={saveEdit}>Salva</button>
                  <button onClick={cancelEdit}>Annulla</button>
                </>
              )}
            </div>
          )
        })}
      </section>
    </div>
  )
}
