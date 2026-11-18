# Avijit's world

A personal site and digital garden built with [Astro](https://astro.build), hosted on **GitHub Pages**.
Writing and explorations come from Obsidian (via the Digital Garden plugin and the `AvijitDhangar/blog` repo).
Home, About, Workshop and Contact live in this repo. Your existing Vercel blog is never touched.

## How it works

```
Obsidian ──publish──▶ AvijitDhangar/blog ──(read at build)──▶ this repo ──▶ GitHub Pages
```

1. You publish a note in Obsidian. The plugin commits it to `blog` (as it does today; Vercel keeps rebuilding your old blog).
2. This repo's workflow clones `blog`, keeps only notes with `dg-publish: true`, and builds the site.
3. GitHub Pages serves the result. A new note is live a minute or two after publishing.

## One-time setup

1. **Create the repo.** Name it `AvijitDhangar.github.io` (this gives the clean URL `https://avijitdhangar.github.io`). Upload everything in this folder and push to the `main` branch.
2. **Turn on Pages.** Repo → Settings → Pages → *Build and deployment* → Source: **GitHub Actions**.
3. **Run the first build.** Repo → Actions → *Build and deploy* → *Run workflow*. When it is green, the site is live.
4. **If `blog` is private again later**, create a fine-grained token (GitHub → Settings → Developer settings → Personal access tokens → Fine-grained): repository access *Only select repositories* → `blog`; permission *Contents: Read-only*. Save it in this repo as Settings → Secrets and variables → Actions → secret **`BLOG_READ_TOKEN`**. While `blog` is public you can skip this.
5. **Optional, instant rebuilds.** Without this the site checks `blog` every 30 minutes. For instant updates:
   - Create a second fine-grained token with repository access to **this repo only** and permission *Contents: Read and write* (that is what allows a repository dispatch). Save it in the `blog` repo as secret **`SITE_DISPATCH_TOKEN`**.
   - Copy `docs/notes-repo-trigger.yml` into the `blog` repo as `.github/workflows/notify-website.yml`.

Using a different repo name or a project site (`username.github.io/some-repo`)? Set `BASE_PATH=/some-repo` in the workflow's build step and change `site` in `astro.config.mjs`.

## Adding content from Obsidian (Library and Curiosities)

Publish notes as usual (`dg-publish`). Add properties to control where a note appears. All are optional.

| Property | Values | Effect |
| --- | --- | --- |
| `type` | `essay`, `article`, `note`, `reflection`, `guide`, `review`, `story`, `interest`, `exploration` | Where it appears. Defaults: notes under a `Story` folder become stories, under `Articles` become articles, everything else a note. |
| `topics` | `[Geography, Photography]` | Links the note to topic pages. Matching is case-insensitive. |
| `description` | short text | Preview text. Otherwise the first paragraph is used. |
| `featured` | `true` | Features it on the Library (and as the Home "Currently exploring" if it is a current exploration). |
| `status` | `current`, `past`, `archived` | Explorations: current or past. `archived` hides a note from lists (the page still works). |
| `series` and `order` | `Triggered Lives`, `3` | Groups notes into a series with chapter list and previous/next links. Folders under `Story` become series automatically, and `Chapter N` in the file name sets the order. |
| `created` | `2026-11-17` | Date shown. Otherwise the date it was first committed. |

- **A long-term interest** (e.g. Geography): a note with `type: interest` and `topics: [Geography]`. Its text becomes the introduction on the Geography page. Eight starter interests exist already (see `src/data/curiosities.mjs`) even without notes.
- **An exploration**: a note with `type: exploration`, `topics: [Geography]`, `status: current`.
- Links like `[[Other note]]`, `[[Note|alias]]`, `[[Note#Heading]]`, image embeds, callouts (`> [!note]`) and maths (`$...$`, `$$...$$`) all work. Links to unpublished notes show as dashed "not written yet" text instead of a broken link.

Build warnings (unknown topics, missing images, links to unpublished notes) appear in the Actions log.

## Things you edit directly in this repo

| What | File |
| --- | --- |
| Name, tagline, home text, About text, links, email | `src/data/site.mjs` |
| Workshop projects and experiments | `src/data/projects.mjs` |
| Long-term interests (name, colour, blurb) | `src/data/curiosities.mjs` |
| Portrait on Home | upload `public/portrait.jpg` |
| Photos for the gallery and Home strip | upload images to `public/gallery/` |
| Colours and fonts | `src/styles/global.css` (variables at the top) |

The text on Home, About and the Workshop entries is placeholder wording in your voice. Edit it freely. GitHub's web editor (press `.` on the repo page) is enough for all of this.

## Local development

```
npm install
BLOG_LOCAL_PATH=/path/to/your/blog/clone npm run dev   # or omit it to clone from GitHub
npm run build
```

`SKIP_SYNC=1` skips fetching notes and reuses `content/garden`.
