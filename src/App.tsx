import { lazy, Suspense, useMemo, useState, type SyntheticEvent } from "react"
import type { Book, ReadingStatus } from "./types"
import booksSeed from "./data/books.json"
import { fetchBookFromISBN } from "./services/isbn"
import { getBooksFile, putBooksFile } from "./services/github"

const ISBNScanner = lazy(() =>
  import("./components/ISBNScanner").then((module) => ({
    default: module.ISBNScanner,
  }))
)

const PLACEHOLDER_COVER = `${import.meta.env.BASE_URL}placeholder-cover.svg`

/* =========================
   Utilities
========================= */

function nowISO(): string {
  return new Date().toISOString()
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
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

function coverWithFallback(url?: string): string {
  return url?.trim() || PLACEHOLDER_COVER
}

function handleCoverError(e: SyntheticEvent<HTMLImageElement>) {
  // Se la copertina remota non carica, passa al segnaposto e mostra il fallback testuale.
  if (!e.currentTarget.closest(".book-cover")?.classList.contains("is-fallback")) {
    e.currentTarget.closest(".book-cover")?.classList.add("is-fallback")
  }

  if (e.currentTarget.src.endsWith(PLACEHOLDER_COVER)) {
    e.currentTarget.style.display = "none"
    return
  }

  e.currentTarget.src = PLACEHOLDER_COVER
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

  /* ---------- Filters & sorting ---------- */

  const [filterText, setFilterText] = useState("")
  const [filterStatus, setFilterStatus] = useState<ReadingStatus | "all">("all")
  const [sortBy, setSortBy] = useState<"year" | "title" | "addedAt">("year")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")

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

/* ---------- Camera ---------- */

  const [showScanner, setShowScanner] = useState(false)
  const [showAddBook, setShowAddBook] = useState(false)
  const [isAddBookClosing, setIsAddBookClosing] = useState(false)

  function openAddBook() {
    setIsAddBookClosing(false)
    setShowAddBook(true)
  }

  function closeAddBook() {
    setShowScanner(false)
    setIsAddBookClosing(true)
  }
  /* =========================
     Derived
  ========================= */

  const visibleBooks = useMemo(() => {
    const text = filterText.trim().toLowerCase()

    const filtered = workingBooks.filter((b) => {
      const matchesStatus =
        filterStatus === "all" || b.status === filterStatus

      const haystack = [
        b.title,
        b.authors.join(", "),
        b.publisher,
        b.category,
        b.language,
        b.status,
        b.year ? String(b.year) : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      const matchesText = !text || haystack.includes(text)

      return matchesStatus && matchesText
    })

    const sorted = [...filtered].sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1

      if (sortBy === "title") {
        return direction * a.title.localeCompare(b.title)
      }

      if (sortBy === "addedAt") {
        return direction * (a.addedAt.localeCompare(b.addedAt))
      }

      const ya = a.year ?? -Infinity
      const yb = b.year ?? -Infinity
      if (ya === yb) return direction * a.title.localeCompare(b.title)
      return direction * (ya - yb)
    })

    return sorted
  }, [filterStatus, filterText, sortBy, sortDirection, workingBooks])

  /* =========================
     ISBN autofill
  ========================= */

  async function autofillFromISBN(isbnValue = isbn) {
    if (!isbnValue.trim()) {
      setMessage("Inserisci un ISBN.")
      return
    }

    setMessage("Recupero metadati da ISBN…")

    try {
      const b = await fetchBookFromISBN(isbnValue)

      setTitle(b.title)
      setAuthors(b.authors.join(", "))
      setPublisher(b.publisher ?? "")
      setYear(b.year ? String(b.year) : "")
      setLanguage(b.language ?? "")
      setCoverUrl(b.coverUrl ?? "")
      setStatus(b.status)

      setMessage("Metadati caricati.")
    } catch (error: unknown) {
      setMessage(errorMessage(error, "Errore ISBN."))
    }
  }

  /* =========================
     Barcode scan
  ========================= */



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
    closeAddBook()

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
     Delete
  ========================= */

  function deleteBook(book: Book) {
    if (!window.confirm(`Eliminare “${book.title}”?`)) return

    const id = book.isbn ?? book.addedAt

    setWorkingBooks((prev) =>
      prev.filter((b) => !sameBook(b, book))
    )
    setDirty(true)

    if (editingId === id) {
      cancelEdit()
    }

    setMessage("Libro rimosso (non ancora salvato).")
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
    } catch (error: unknown) {
      setMessage(errorMessage(error, "Errore durante il commit."))
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
      <section className="token-field">
        <label htmlFor="github-token">Password</label>
        <input
          id="github-token"
          type="password"
          placeholder="GitHub token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
      </section>

      {/* ---------- Add book ---------- */}
      {showAddBook && (
      <div
        className={`add-book-layer ${isAddBookClosing ? "is-closing" : ""}`}
        onMouseDown={closeAddBook}
        onAnimationEnd={() => {
          if (isAddBookClosing) {
            setShowAddBook(false)
            setIsAddBookClosing(false)
          }
        }}
      >
      <section
        className="add-book-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-book-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h3 id="add-book-title">Aggiungi libro</h3>

        <label className="sr-only" htmlFor="isbn">ISBN</label>
        <input
          id="isbn"
          inputMode="numeric"
          placeholder="ISBN"
          value={isbn}
          onChange={(e) => setIsbn(e.target.value)}
        />
        <button
          style={{marginLeft: "1em"}}
          onClick={() => void autofillFromISBN()}>
            Autocompleta
        </button>
        <button
          className="icon-button scan-button"
          onClick={() => setShowScanner(true)}
          aria-label="Scannerizza ISBN"
          title="Scannerizza ISBN"
        >
          <img
            src={`${import.meta.env.BASE_URL}icons/barcode.svg`}
            alt=""
            className="edit-icon"
          />
        </button>
        {showScanner && (
          <Suspense fallback={<p>Caricamento scanner…</p>}>
            <ISBNScanner
              onDetected={(code) => {
                setIsbn(code)
                setShowScanner(false)
                void autofillFromISBN(code)
              }}
              onClose={() => setShowScanner(false)}
            />
          </Suspense>
        )}

        <div className="Buttons">
          <label className="sr-only" htmlFor="title">Titolo</label>
          <input
            id="title"
            placeholder="Titolo"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <label className="sr-only" htmlFor="authors">Autori</label>
          <input
            id="authors"
            placeholder="Autori (separati da virgola)"
            value={authors}
            onChange={(e) => setAuthors(e.target.value)}
          />
          <label className="sr-only" htmlFor="publisher">Editore</label>
          <input
            id="publisher"
            placeholder="Editore"
            value={publisher}
            onChange={(e) => setPublisher(e.target.value)}
          />
          <label className="sr-only" htmlFor="year">Anno</label>
          <input
            id="year"
            inputMode="numeric"
            placeholder="Anno"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
          <label className="sr-only" htmlFor="language">Lingua</label>
          <input
            id="language"
            placeholder="Lingua"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          />
          <label className="sr-only" htmlFor="category">Categoria</label>
          <input
            id="category"
            placeholder="Categoria"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <label className="sr-only" htmlFor="cover-url">Copertina URL</label>
          <input
            id="cover-url"
            type="url"
            placeholder="Copertina URL"
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
          />

          <label className="sr-only" htmlFor="status">Stato di lettura</label>
          <select
            id="status"
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
          style={{marginTop: "2em"}}
          onClick={addBook}>
            Aggiungi
        </button>
        <p className="small" role="status" aria-live="polite">{message}</p>
      </section>
      </div>
      )}

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

        <div className="controls">
          <label className="sr-only" htmlFor="book-filter">Cerca nella libreria</label>
          <input
            id="book-filter"
            placeholder="Filtra per titolo, autore, editore…"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
        </div>
        <div className="controls filter-controls">
          <label className="sr-only" htmlFor="status-filter">Filtra per stato</label>
          <select
            id="status-filter"
            value={filterStatus}
            onChange={(e) =>
              setFilterStatus(e.target.value as ReadingStatus | "all")
            }
          >
            <option value="all">Tutti gli stati</option>
            <option value="Letto">Letto</option>
            <option value="Non letto">Non letto</option>
            <option value="In lettura">In lettura</option>
            <option value="Da acquistare">Da acquistare</option>
          </select>

          <label className="sr-only" htmlFor="sort-by">Criterio di ordinamento</label>
          <select
            id="sort-by"
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value as "year" | "title" | "addedAt")
            }
          >
            <option value="year">Ordina per anno</option>
            <option value="title">Ordina per titolo</option>
            <option value="addedAt">Ordina per data di inserimento</option>
          </select>

          <label className="sr-only" htmlFor="sort-direction">Direzione di ordinamento</label>
          <select
            id="sort-direction"
            value={sortDirection}
            onChange={(e) =>
              setSortDirection(e.target.value as "asc" | "desc")
            }
          >
            <option value="desc">Discendente</option>
            <option value="asc">Ascendente</option>
          </select>
        </div>

        {visibleBooks.map((b) => {
          const id = b.isbn ?? b.addedAt
          const isEditing = editingId === id
          const coverSrc = coverWithFallback(b.coverUrl)
          const showPlaceholder = !b.coverUrl?.trim()

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
                  <div
                    className={`book-cover ${showPlaceholder ? "is-fallback" : ""}`}
                  >
                    <img
                      src={coverSrc}
                      alt={`Copertina di ${b.title}`}
                      onError={handleCoverError}
                    />
                    <div className="book-cover-fallback">
                      <span>{b.title}</span>
                    </div>
                  </div>

                  <div className="book-meta">
                    <div className="book-title">
                      <strong>{b.title}</strong>
                    </div>
                    <div className="details">
                      {/* Line 1: AUTORE – publisher, year */}
                      <div>
                        <span style={{textTransform: ""}}>{b.authors.join(", ")}</span>
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
                  <div className="book-actions">
                  <button
                    className="icon-button"
                    onClick={() => startEdit(b)}
                    aria-label="Modifica libro"
                    title="Modifica"
                  >
                    <img
                      src={`${import.meta.env.BASE_URL}icons/edit.svg`}
                      alt=""
                      className="edit-icon"
                    />
                  </button>
                  <button
                    className="icon-button"
                    onClick={() => deleteBook(b)}
                    aria-label="Elimina libro"
                    title="Elimina"
                  >
                    <img
                      src={`${import.meta.env.BASE_URL}icons/delete.svg`}
                      alt=""
                      className="edit-icon"
                    />
                  </button>
                  </div>
                </div>
              ) : (
                /* =========================
                  EDIT MODE
                ========================= */
                <div className="book-row">
                  <div
                    className={`book-cover ${!editDraft!.coverUrl?.trim() ? "is-fallback" : ""}`}
                  >
                    <img
                      src={coverWithFallback(editDraft!.coverUrl)}
                      alt={`Copertina di ${editDraft!.title}`}
                      onError={handleCoverError}
                    />
                    <div
                      className="book-cover-fallback">
                      <span>{editDraft!.title}</span>
                    </div>
                  </div>

                  <div className="book-meta book-meta-edit">
                    <input
                      type="text"
                      aria-label="Titolo"
                      value={editDraft!.title}
                      placeholder="Titolo"
                      onChange={(e) =>
                        setEditDraft({ ...editDraft!, title: e.target.value })
                      }
                    />

                    <input
                      type="text"
                      aria-label="Autori"
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
                      aria-label="Editore"
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
                      aria-label="Anno"
                      inputMode="numeric"
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
                      aria-label="Categoria"
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
                      aria-label="Lingua"
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
                      aria-label="Stato di lettura"
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

      <button
        className="add-book-fab"
        type="button"
        aria-label={showAddBook ? "Chiudi aggiunta libro" : "Aggiungi un libro"}
        aria-expanded={showAddBook}
        onClick={() => {
          if (showAddBook && !isAddBookClosing) closeAddBook()
          else openAddBook()
        }}
      >
        <span aria-hidden="true">+</span>
      </button>
    </div>
  )
}
