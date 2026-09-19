export type ReadingStatus =
  | "Letto"
  | "Non letto"
  | "In lettura"
  | "Da acquistare"

export type Book = {
  isbn?: string
  title: string
  authors: string[]
  publisher?: string
  year?: number
  language?: string
  category?: string
  coverUrl?: string
  placeholderColor?: string
  comment: string
  status: ReadingStatus
  addedAt: string
}
