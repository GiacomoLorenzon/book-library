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
const FALLBACK_COVER_COLORS = [
  "#e7b8ad", "#e6c88f", "#d8d39b", "#b8cfb2",
  "#acd0cb", "#b7c9df", "#c7bddb", "#d9b9ca",
]

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

function fallbackCoverColor(book: Pick<Book, "isbn" | "title" | "addedAt" | "placeholderColor">): string {
  if (book.placeholderColor) return book.placeholderColor

  const seed = book.isbn || book.addedAt || book.title
  let hash = 0

  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash << 5) - hash + seed.charCodeAt(index)) | 0
  }

  return FALLBACK_COVER_COLORS[Math.abs(hash) % FALLBACK_COVER_COLORS.length]
}

function CoverColorPicker({
  value,
  onChange,
  id,
}: {
  value: string
  onChange: (value: string) => void
  id: string
}) {
  return (
    <div className="cover-color-field">
      <label className="color-picker" htmlFor={id} title="Scegli colore">
        <span
          className={`color-picker-preview ${value ? "has-color" : ""}`}
          style={value ? { backgroundColor: value } : undefined}
        />
        <input
          id={id}
          type="color"
          aria-label="Colore segnaposto della copertina"
          value={value || "#d8d39b"}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      <button
        type="button"
        className="random-color-button"
        aria-label="Usa colore casuale"
        title="Usa colore casuale"
        disabled={!value}
        onClick={() => onChange("")}
      >
        <span aria-hidden="true">↻</span>
      </button>
    </div>
  )
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
    (booksSeed as Book[]).map((book) => ({ ...book, comment: book.comment ?? "" }))
  )
  const [dirty, setDirty] = useState(false)

  /* ---------- GitHub ---------- */

  const [token, setToken] = useState("")
  const [message, setMessage] = useState("")

  /* ---------- Editing state ---------- */

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Book | null>(null)
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [detailEditDraft, setDetailEditDraft] = useState<Book | null>(null)

  /* ---------- Filters & sorting ---------- */

  const [filterText, setFilterText] = useState("")
  const [filterStatus, setFilterStatus] = useState<ReadingStatus | "all">("all")
  const [sortBy, setSortBy] = useState<"year" | "title" | "addedAt">("year")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [viewMode, setViewMode] = useState<"list" | "grid">("list")

/* ---------- Add-book form ---------- */

  const [isbn, setIsbn] = useState("")
  const [title, setTitle] = useState("")
  const [authors, setAuthors] = useState("")
  const [publisher, setPublisher] = useState("")
  const [year, setYear] = useState("")
  const [language, setLanguage] = useState("")
  const [category, setCategory] = useState("")
  const [coverUrl, setCoverUrl] = useState("")
  const [placeholderColor, setPlaceholderColor] = useState("")
  const [comment, setComment] = useState("")
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
        b.comment,
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
      placeholderColor: placeholderColor || undefined,
      comment: comment.trim(),
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
    setPlaceholderColor("")
    setComment("")
    setStatus("Non letto")
    closeAddBook()

    setMessage("Libro aggiunto (non ancora salvato).")
  }

  /* =========================
     Editing logic
  ========================= */

  function startEdit(book: Book) {
    setDetailEditDraft({ ...book })
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

  function saveDetailEdit() {
    if (!selectedBook || !detailEditDraft || !detailEditDraft.title.trim()) return

    const updatedBook = {
      ...detailEditDraft,
      title: detailEditDraft.title.trim(),
    }
    setWorkingBooks((prev) =>
      prev.map((book) => (sameBook(book, selectedBook) ? updatedBook : book))
    )
    setSelectedBook(updatedBook)
    setDetailEditDraft(null)
    setDirty(true)
    setMessage("Libro modificato (non ancora salvato).")
  }

  function closeBookDetail() {
    setSelectedBook(null)
    setDetailEditDraft(null)
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

    if (selectedBook && sameBook(selectedBook, book)) {
      setSelectedBook(null)
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
          <label className="sr-only" htmlFor="comment">Commento</label>
          <textarea
            id="comment"
            placeholder="Commento"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />

          <CoverColorPicker
            id="new-book-placeholder-color"
            value={placeholderColor}
            onChange={setPlaceholderColor}
          />
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

        <div className="view-switch" aria-label="Modalità di visualizzazione">
          <button
            type="button"
            className={`view-toggle ${viewMode === "grid" ? "shows-grid" : ""}`}
            role="switch"
            aria-checked={viewMode === "grid"}
            aria-label={`Visualizzazione ${viewMode === "list" ? "a elenco" : "a copertine"}. Premi per cambiare.`}
            onClick={() => {
              const nextMode = viewMode === "list" ? "grid" : "list"
              if (nextMode === "grid") cancelEdit()
              setViewMode(nextMode)
            }}
          >
            <span>Elenco</span>
            <span>Copertine</span>
          </button>
        </div>

        <div className={`books-container ${viewMode === "grid" ? "grid-view" : "list-view"}`}>
        {visibleBooks.map((b) => {
          const id = b.isbn ?? b.addedAt
          const isEditing = editingId === id
          const coverSrc = coverWithFallback(b.coverUrl)
          const showPlaceholder = !b.coverUrl?.trim()

          if (viewMode === "grid") {
            return (
              <button
                type="button"
                key={id}
                className="cover-card"
                aria-label={`Apri la scheda di ${b.title}`}
                title={b.title}
                onClick={() => setSelectedBook(b)}
              >
                <span className={`book-cover grid-cover ${showPlaceholder ? "is-fallback" : ""}`}>
                  <img
                    src={coverSrc}
                    alt={`Copertina di ${b.title}`}
                    onError={handleCoverError}
                  />
                  <span
                    className="book-cover-fallback"
                    style={{ backgroundColor: fallbackCoverColor(b) }}
                  >
                    <span>{b.title}</span>
                  </span>
                </span>
              </button>
            )
          }

          return (
            <div
              key={id}
              className={`book ${isEditing ? "is-editing" : ""}`}
            >
              {!isEditing ? (
                /* =========================
                  VIEW MODE
                ========================= */
                <div
                  className="book-row book-row-clickable"
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedBook(b)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      setSelectedBook(b)
                    }
                  }}
                >
                  <div
                    className={`book-cover ${showPlaceholder ? "is-fallback" : ""}`}
                  >
                    <img
                      src={coverSrc}
                      alt={`Copertina di ${b.title}`}
                      onError={handleCoverError}
                    />
                    <div
                      className="book-cover-fallback"
                      style={{ backgroundColor: fallbackCoverColor(b) }}
                    >
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
                      className="book-cover-fallback"
                      style={{ backgroundColor: fallbackCoverColor(editDraft!) }}
                    >
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

                    <textarea
                      aria-label="Commento"
                      value={editDraft!.comment ?? ""}
                      placeholder="Commento"
                      onChange={(e) =>
                        setEditDraft({
                          ...editDraft!,
                          comment: e.target.value,
                        })
                      }
                    />

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
        </div>
      </section>

      {selectedBook && (
        <div className="book-detail-layer" onMouseDown={closeBookDetail}>
          <article
            className="book-detail"
            role="dialog"
            aria-modal="true"
            aria-labelledby="book-detail-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="detail-close"
              aria-label="Chiudi scheda"
              onClick={closeBookDetail}
            >
              ×
            </button>
            <div className={`book-cover detail-cover ${!selectedBook.coverUrl?.trim() ? "is-fallback" : ""}`}>
              <img
                src={coverWithFallback(selectedBook.coverUrl)}
                alt={`Copertina di ${selectedBook.title}`}
                onError={handleCoverError}
              />
              <div
                className="book-cover-fallback"
                style={{ backgroundColor: fallbackCoverColor(selectedBook) }}
              >
                <span>{selectedBook.title}</span>
              </div>
            </div>
            <div className="detail-content">
              {detailEditDraft ? (
                <div className="detail-edit-form">
                  <h3 id="book-detail-title">Modifica libro</h3>
                  <input className="wide-field" aria-label="Titolo" placeholder="Titolo" value={detailEditDraft.title} onChange={(event) => setDetailEditDraft({ ...detailEditDraft, title: event.target.value })} />
                  <input className="wide-field" aria-label="Autori" placeholder="Autori (separati da virgola)" value={detailEditDraft.authors.join(", ")} onChange={(event) => setDetailEditDraft({ ...detailEditDraft, authors: parseAuthors(event.target.value) })} />
                  <input aria-label="Editore" placeholder="Editore" value={detailEditDraft.publisher ?? ""} onChange={(event) => setDetailEditDraft({ ...detailEditDraft, publisher: event.target.value || undefined })} />
                  <input aria-label="Anno" inputMode="numeric" placeholder="Anno" value={detailEditDraft.year ?? ""} onChange={(event) => setDetailEditDraft({ ...detailEditDraft, year: event.target.value ? parseInt(event.target.value, 10) : undefined })} />
                  <input aria-label="Categoria" placeholder="Categoria" value={detailEditDraft.category ?? ""} onChange={(event) => setDetailEditDraft({ ...detailEditDraft, category: event.target.value || undefined })} />
                  <input aria-label="Lingua" placeholder="Lingua" value={detailEditDraft.language ?? ""} onChange={(event) => setDetailEditDraft({ ...detailEditDraft, language: event.target.value || undefined })} />
                  <input aria-label="ISBN" placeholder="ISBN" value={detailEditDraft.isbn ?? ""} onChange={(event) => setDetailEditDraft({ ...detailEditDraft, isbn: event.target.value || undefined })} />
                  <input aria-label="URL copertina" type="url" placeholder="URL copertina" value={detailEditDraft.coverUrl ?? ""} onChange={(event) => setDetailEditDraft({ ...detailEditDraft, coverUrl: event.target.value || undefined })} />
                  <select aria-label="Stato di lettura" value={detailEditDraft.status} onChange={(event) => setDetailEditDraft({ ...detailEditDraft, status: event.target.value as ReadingStatus })}>
                    <option value="Letto">Letto</option>
                    <option value="Non letto">Non letto</option>
                    <option value="In lettura">In lettura</option>
                    <option value="Da acquistare">Da acquistare</option>
                  </select>
                  <CoverColorPicker
                    id="edit-book-placeholder-color"
                    value={detailEditDraft.placeholderColor ?? ""}
                    onChange={(color) => setDetailEditDraft({ ...detailEditDraft, placeholderColor: color || undefined })}
                  />
                  <textarea className="wide-field" aria-label="Commento" placeholder="Commento" value={detailEditDraft.comment} onChange={(event) => setDetailEditDraft({ ...detailEditDraft, comment: event.target.value })} />
                  <div className="detail-actions">
                    <button type="button" onClick={saveDetailEdit} disabled={!detailEditDraft.title.trim()}>Salva</button>
                    <button type="button" className="secondary-button" onClick={() => setDetailEditDraft(null)}>Annulla</button>
                  </div>
                </div>
              ) : (
                <>
                  <h3 id="book-detail-title">{selectedBook.title}</h3>
                  <p>{selectedBook.authors.join(", ") || "Autore non indicato"}</p>
                  <dl>
                    {selectedBook.publisher && <><dt>Editore</dt><dd>{selectedBook.publisher}</dd></>}
                    {selectedBook.year && <><dt>Anno</dt><dd>{selectedBook.year}</dd></>}
                    {selectedBook.category && <><dt>Categoria</dt><dd>{selectedBook.category}</dd></>}
                    {selectedBook.language && <><dt>Lingua</dt><dd>{selectedBook.language}</dd></>}
                    <dt>Stato</dt><dd>{selectedBook.status}</dd>
                    {selectedBook.isbn && <><dt>ISBN</dt><dd>{selectedBook.isbn}</dd></>}
                  </dl>
                  <div className="detail-comment">
                    <strong>Commento</strong>
                    <p>{selectedBook.comment || "Nessun commento."}</p>
                  </div>
                  <div className="detail-actions">
                    <button type="button" onClick={() => startEdit(selectedBook)}>Modifica</button>
                    <button type="button" className="danger-button" onClick={() => deleteBook(selectedBook)}>Elimina</button>
                  </div>
                </>
              )}
            </div>
          </article>
        </div>
      )}

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
