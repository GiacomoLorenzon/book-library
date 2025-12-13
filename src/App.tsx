import { useMemo, useState } from "react"
import type { Book } from "./types"
import booksSeed from "./data/books.json"
import { fetchBookFromISBN } from "./services/isbn"
import { getBooksFile, putBooksFile } from "./services/github"

type Mode = "local" | "github"

export default function App() {
  const [mode, setMode] = useState<Mode>("local")

  // Local list (usata anche come fallback)
  const [books, setBooks] = useState<Book[]>(booksSeed as Book[])

  // Add form
  const [isbn, setIsbn] = useState("")
  const [draft, setDraft] = useState<Book | null>(null)
  const [status, setStatus] = useState<string>("")

  // GitHub “admin”
  const [token, setToken] = useState("")
  const [owner, setOwner] = useState("<YOUR_GH_USERNAME>")
  const [repo, setRepo] = useState("<YOUR_REPO_NAME>")
  const [branch, setBranch] = useState("main")

  const sortedBooks = useMemo(() => {
    return [...books].sort((a, b) => (b.year ?? -1) - (a.year ?? -1) || a.title.localeCompare(b.title))
  }, [books])

  async function onAutofill() {
    setStatus("Fetching metadata…")
    setDraft(null)
    try {
      const b = await fetchBookFromISBN(isbn)
      setDraft(b)
      setStatus("Metadata loaded. Review and save.")
    } catch (e: any) {
      setStatus(e?.message ?? "Error.")
    }
  }

  function upsertLocal(b: Book) {
    setBooks((prev) => {
      const m = new Map(prev.map((x) => [x.isbn, x]))
      m.set(b.isbn, b)
      return Array.from(m.values())
    })
  }

  async function onSave() {
    if (!draft) return
    setStatus("Saving…")

    if (mode === "local") {
      upsertLocal(draft)
      setDraft(null)
      setIsbn("")
      setStatus("Saved locally (session). For persistence use GitHub mode.")
      return
    }

    try {
      const ref = { owner, repo, branch }
      const file = await getBooksFile(token, ref)
      const current = JSON.parse(file.content) as Book[]
      const m = new Map(current.map((x) => [x.isbn, x]))
      m.set(draft.isbn, draft)
      const updated = Array.from(m.values())

      await putBooksFile(token, ref, updated, file.sha)

      // Aggiorna UI subito
      setBooks(updated)
      setDraft(null)
      setIsbn("")
      setStatus("Committed to GitHub. Deploy will reflect it after rebuild.")
    } catch (e: any) {
      setStatus(e?.message ?? "Commit error.")
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", fontFamily: "system-ui" }}>
      <h1>Personal Library</h1>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
        <label>
          <input
            type="radio"
            checked={mode === "local"}
            onChange={() => setMode("local")}
          />
          Local mode
        </label>
        <label>
          <input
            type="radio"
            checked={mode === "github"}
            onChange={() => setMode("github")}
          />
          GitHub mode (persistent)
        </label>
      </div>

      {mode === "github" && (
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, marginBottom: 18 }}>
          <h3>GitHub settings</h3>
          <p style={{ marginTop: 0 }}>
            Token is used only in memory. (Yes, I know you said you do not care. This is just decency.)
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input placeholder="owner" value={owner} onChange={(e) => setOwner(e.target.value)} />
            <input placeholder="repo" value={repo} onChange={(e) => setRepo(e.target.value)} />
            <input placeholder="branch" value={branch} onChange={(e) => setBranch(e.target.value)} />
            <input placeholder="token" value={token} onChange={(e) => setToken(e.target.value)} />
          </div>
        </div>
      )}

      <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <h3>Add a book</h3>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            style={{ flex: 1 }}
            placeholder="ISBN (10/13)"
            value={isbn}
            onChange={(e) => setIsbn(e.target.value)}
          />
          <button onClick={onAutofill}>Autofill</button>
        </div>

        {draft && (
          <div style={{ marginTop: 12, padding: 12, border: "1px dashed #bbb", borderRadius: 8 }}>
            <h4>Draft</h4>
            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8 }}>
              <strong>ISBN</strong><span>{draft.isbn}</span>
              <strong>Title</strong>
              <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              <strong>Authors</strong>
              <input
                value={draft.authors.join(", ")}
                onChange={(e) => setDraft({ ...draft, authors: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
              />
              <strong>Year</strong>
              <input
                value={draft.year ?? ""}
                onChange={(e) => setDraft({ ...draft, year: e.target.value ? parseInt(e.target.value, 10) : undefined })}
              />
              <strong>Publisher</strong>
              <input
                value={draft.publisher ?? ""}
                onChange={(e) => setDraft({ ...draft, publisher: e.target.value || undefined })}
              />
            </div>
            <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
              <button onClick={onSave}>Save</button>
              <button onClick={() => setDraft(null)}>Discard</button>
            </div>
          </div>
        )}

        <p style={{ marginTop: 10, fontStyle: "italic" }}>{status}</p>
      </div>

      <h2 style={{ marginTop: 26 }}>Books ({sortedBooks.length})</h2>
      <div style={{ display: "grid", gap: 10 }}>
        {sortedBooks.map((b) => (
          <div key={b.isbn} style={{ padding: 12, border: "1px solid #eee", borderRadius: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 700 }}>{b.title}</div>
                <div>{b.authors.join(", ") || "Unknown author"}</div>
                <div style={{ opacity: 0.8 }}>
                  {b.publisher ?? "Unknown publisher"} · {b.year ?? "n.d."} · ISBN {b.isbn}
                </div>
              </div>
              {b.coverUrl && (
                <img src={b.coverUrl} alt="" style={{ height: 90, objectFit: "contain" }} />
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 30, opacity: 0.8 }}>
        <small>
          Note: In GitHub mode, the book is persisted by committing <code>src/data/books.json</code>.
          The deployed site updates after the next Pages build.
        </small>
      </div>
    </div>
  )
}
