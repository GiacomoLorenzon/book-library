export type ReadingStatus =
  | "letto"
  | "non letto"
  | "in lettura"
  | "da acquistare"

export type Book = {
  isbn?: string
  title: string
  authors: string[]
  publisher?: string
  year?: number
  language?: string
  category?: string
  coverUrl?: string
  status: ReadingStatus
  addedAt: string
}
