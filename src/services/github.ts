import type { Book } from "../types"

const OWNER = "GiacomoLorenzon"
const REPO = "book-library"
const BRANCH = "main"
const PATH = "src/data/books.json"

function encodeBase64Utf8(s: string): string {
  return btoa(unescape(encodeURIComponent(s)))
}

function decodeBase64Utf8(s: string): string {
  return decodeURIComponent(escape(atob(s)))
}

export async function getBooksFile(token: string): Promise<{
  content: string
  sha: string
}> {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}?ref=${BRANCH}`

  const r = await fetch(url, {
    headers: {
      Authorization: `token ${token}`,
    },
  })

  if (!r.ok) {
    throw new Error("Impossibile leggere books.json dal repository.")
  }

  const raw = await r.json()

  return {
    content: decodeBase64Utf8(raw.content.replace(/\n/g, "")),
    sha: raw.sha,
  }
}

export async function putBooksFile(
  token: string,
  books: Book[],
  sha: string
): Promise<void> {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`

  const body = {
    message: `Update books.json (${books.length} books)`,
    content: encodeBase64Utf8(JSON.stringify(books, null, 2)),
    sha,
    branch: BRANCH,
  }

  const r = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `token ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!r.ok) {
    const txt = await r.text()
    throw new Error(`Commit fallito: ${txt}`)
  }
}
