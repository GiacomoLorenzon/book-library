export const GITHUB_OWNER = "GiacomoLorenzon"
export const GITHUB_REPO = "book-library"
export const GITHUB_BRANCH = "main"
export const BOOKS_PATH = "src/data/books.json"


import type { Book } from "../types"

export type RepoRef = { owner: string; repo: string; branch?: string }

type GetFileResult = { content: string; sha: string }

function b64encodeUtf8(s: string): string {
  // btoa non gestisce bene UTF-8 puro; normalizziamo
  return btoa(unescape(encodeURIComponent(s)))
}

function b64decodeUtf8(b64: string): string {
  return decodeURIComponent(escape(atob(b64)))
}

export async function getBooksFile(
  token: string,
  ref: RepoRef,
  path = "src/data/books.json"
): Promise<GetFileResult> {
  const branch = ref.branch ?? "main"
  const url = `https://api.github.com/repos/${ref.owner}/${ref.repo}/contents/${path}?ref=${branch}`
  const r = await fetch(url, {
    headers: { Authorization: `token ${token}` },
  })
  if (!r.ok) throw new Error("Impossibile leggere books.json dal repo.")
  const raw = await r.json()
  return {
    content: b64decodeUtf8((raw.content as string).replace(/\n/g, "")),
    sha: raw.sha as string,
  }
}

export async function putBooksFile(
  token: string,
  ref: RepoRef,
  updated: Book[],
  sha: string,
  path = "src/data/books.json"
): Promise<void> {
  const branch = ref.branch ?? "main"
  const url = `https://api.github.com/repos/${ref.owner}/${ref.repo}/contents/${path}`
  const body = {
    message: "Update books.json (via website)",
    content: b64encodeUtf8(JSON.stringify(updated, null, 2)),
    sha,
    branch,
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
    const t = await r.text()
    throw new Error(`Commit fallito: ${t}`)
  }
}
