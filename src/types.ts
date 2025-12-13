export type Book = {
  isbn: string
  title: string
  authors: string[]
  publisher?: string
  year?: number
  pages?: number
  language?: string
  coverUrl?: string
  addedAt: string
}
