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
    <div>
      <h1>Libreria</h1>
      <h2>di Giacomo Lorenzon</h2>

      {/* ---------- Token ---------- */}
      <section>
        Password: 
        <input
          style={{marginLeft: "1em"}}
          type="password"
          placeholder="GitHub token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
      </section>

      {/* ---------- Add book ---------- */}
      <section>
        <h3>Aggiungi libro</h3>

        <input
          placeholder="ISBN"
          value={isbn}
          onChange={(e) => setIsbn(e.target.value)}
        />
        <button
          style={{marginLeft: "1em"}}
          onClick={autofillFromISBN}>
            Autocompleta
        </button>

        <div className="Buttons">
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
            placeholder="Copertina URL"
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

        <button onClick={addBook}>Aggiungi</button>
        <p className="small">{message}</p>
      </section>

      {/* ---------- Commit ---------- */}
      <section>
        <button
          style={{marginRight: "1em"}}
          disabled={!dirty} onClick={commitChanges}>
          Salva modifiche
        </button>
        {dirty && <span className="small"> ● modifiche non salvate.</span>}
      </section>

      <hr />

      {/* ---------- Library ---------- */}
      <section>
        <h2>Consulta</h2>

        {sortedBooks.map((b) => {
          const id = b.isbn ?? b.addedAt
          const isEditing = editingId === id

          return (
            <div
              key={id}
              className={`book ${isEditing ? "is-editing" : ""}`}
            >
              {!isEditing ? (
                /* =========================
                  VIEW MODE
                ========================= */
                <div className="book-row">
                  <div className="book-cover">
                    {b.coverUrl ? (
                      <img
                        src={b.coverUrl}
                        alt={`Copertina di ${b.title}`}
                      />
                    ) : (
                      <span className="book-cover-fallback"></span>
                    )}
                  </div>

                  <div className="book-meta">
                    <div className="book-title">
                      <strong>{b.title}</strong>
                    </div>
                    <div className="details">
                      {/* Line 1: AUTORE – publisher, year */}
                      <div>
                        <span style={{textTransform: "uppercase"}}>{b.authors.join(", ")}</span>
                        {(b.publisher || b.year) && " – "}
                        {b.publisher}
                        {b.publisher && b.year && ", "}
                        {b.year}
                      </div>

                      {/* Line 2: categoria, lingua · stato */}
                      <div className="small">
                        {b.category}
                        {b.category && b.language && ", "}
                        {b.language}
                        {(b.category || b.language) && " · "}
                        <em>{b.status}</em>
                      </div>
                    </div>
                  </div>

                  <button
                    className="edit-button"
                    onClick={() => startEdit(b)}
                    aria-label="Modifica libro"
                    title="Modifica"
                  >
                    <img
                      src="https://www.svgrepo.com/show/146083/pencil-edit-button.svg"
                      alt=""
                      className="edit-icon"
                    />
                  </button>
                </div>
              ) : (
                /* =========================
                  EDIT MODE
                ========================= */
                <div className="book-row">
                  <div className="book-cover">
                    {editDraft!.coverUrl ? (
                      <img
                        src={editDraft!.coverUrl}
                        alt={`Copertina di ${editDraft!.title}`}
                      />
                    ) : (
                      <span className="book-cover-fallback"></span>
                    )}
                  </div>

                  <div className="book-meta book-meta-edit">
                    <input
                      type="text"
                      value={editDraft!.title}
                      placeholder="Titolo"
                      onChange={(e) =>
                        setEditDraft({ ...editDraft!, title: e.target.value })
                      }
                    />

                    <input
                      type="text"
                      value={editDraft!.authors.join(", ")}
                      placeholder="Autori (separati da virgola)"
                      onChange={(e) =>
                        setEditDraft({
                          ...editDraft!,
                          authors: parseAuthors(e.target.value),
                        })
                      }
                    />

                    <input
                      type="text"
                      value={editDraft!.publisher ?? ""}
                      placeholder="Editore"
                      onChange={(e) =>
                        setEditDraft({
                          ...editDraft!,
                          publisher: e.target.value || undefined,
                        })
                      }
                    />

                    <input
                      type="text"
                      value={editDraft!.year ?? ""}
                      placeholder="Anno"
                      onChange={(e) =>
                        setEditDraft({
                          ...editDraft!,
                          year: e.target.value
                            ? parseInt(e.target.value, 10)
                            : undefined,
                        })
                      }
                    />

                    <input
                      type="text"
                      value={editDraft!.category ?? ""}
                      placeholder="Categoria"
                      onChange={(e) =>
                        setEditDraft({
                          ...editDraft!,
                          category: e.target.value || undefined,
                        })
                      }
                    />

                    <input
                      type="text"
                      value={editDraft!.language ?? ""}
                      placeholder="Lingua"
                      onChange={(e) =>
                        setEditDraft({
                          ...editDraft!,
                          language: e.target.value || undefined,
                        })
                      }
                    />

                    <select
                      value={editDraft!.status}
                      onChange={(e) =>
                        setEditDraft({
                          ...editDraft!,
                          status: e.target.value as ReadingStatus,
                        })
                      }
                    >
                      <option value="Letto">Letto</option>
                      <option value="Non letto">Non letto</option>
                      <option value="In lettura">In lettura</option>
                      <option value="Da acquistare">Da acquistare</option>
                    </select>

                    <div>
                      <button
                        style={{marginRight: "0.5em"}}
                        onClick={saveEdit}>Salva</button>
                      <button onClick={cancelEdit}>Annulla</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </section>
    </div>
  )
}
