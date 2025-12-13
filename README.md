# Personal Book Library

A personal, static web application to catalogue books, hosted on **GitHub Pages**, with **persistent editing via GitHub commits** and **automatic metadata retrieval from ISBN**.

This project is deliberately **backend-free**: GitHub itself is used as the storage layer.

---

## Overview

This repository contains a React + Vite application that allows you to:

* browse your personal book library online;
* add new books via:

  * ISBN auto-completion (Open Library / Google Books),
  * or full manual insertion;
* batch multiple book insertions;
* persist changes by committing directly to the GitHub repository;
* deploy the site statically via GitHub Pages.

There is **no database** and **no server**.
All persistent data lives in version-controlled JSON files.

---

## Key Design Principles

* **Static first**: the site is a pure static build (GitHub Pages compatible).
* **Git as database**: persistence is achieved via GitHub API commits.
* **Explicit editorial workflow**: adding a book is a conscious, versioned operation.
* **Personal use**: security and multi-user support are intentionally out of scope.

---

## Data Model

Books are stored in:

```
src/data/books.json
```

Each entry has the following structure:

```ts
type Book = {
  isbn?: string
  title: string
  authors: string[]
  publisher?: string
  year?: number
  language?: string
  category?: string
  coverUrl?: string
  status: "letto" | "non letto" | "in lettura" | "da acquistare"
  addedAt: string
}
```

---

## How Persistence Works

GitHub Pages is read-only.
Persistence is achieved as follows:

1. The site fetches `books.json` from the repository.
2. New books are accumulated locally (staging).
3. When committing:

   * `books.json` is updated,
   * a **single commit** is created on `main`,
   * GitHub Pages rebuilds the site.

In short:

> **The website edits the repository.
> GitHub rebuilds the website.**

---

## GitHub Token (Required)

To write to the repository, the site needs a **GitHub Personal Access Token (classic)**.

### Token requirements

* Type: **classic**
* Scope: `repo`
* Expiration: optional (can be none)

### How to create it

Direct link (recommended):

```
https://github.com/settings/tokens
```

Steps:

1. Generate new token → **classic**
2. Enable scope:

   * `repo`
3. Copy the token **once**
4. Paste it into the site when prompted

The token is:

* never committed,
* never stored,
* kept only in browser memory.

---

## Local Development

### Prerequisites

* Node.js ≥ 18
* npm

### Install

```bash
npm install
```

### Run locally

```bash
npm run start
```

The app will be available at:

```
http://localhost:5173
```

---

## Deployment (GitHub Pages)

### One-time setup

Ensure `vite.config.ts` contains:

```ts
base: "/book-library/",
```

(where `book-library` is the repository name).

### Build and deploy

```bash
npm run build
npm run deploy
```

This will:

* generate `dist/`,
* create/update the `gh-pages` branch,
* publish the site.

### Enable Pages on GitHub

Repository → **Settings → Pages**

* Source: *Deploy from a branch*
* Branch: `gh-pages`
* Folder: `/ (root)`

---

## Usage (Online)

1. Open the deployed site.
2. Paste your GitHub token.
3. Add books:

   * via ISBN auto-fill **or**
   * manually.
4. Add multiple books to the staging list.
5. Click **Commit all books**.
6. Wait for the GitHub Pages rebuild.
7. Refresh — the books are now permanent.

---

## What This Project Is *Not*

* Not multi-user
* Not real-time
* Not secure by design

---

## License

Personal use.
No warranty.
No obligations.
