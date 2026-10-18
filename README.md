# Cobalt

**Cobalt** is a Computer-Based Test (CBT) practice app for JAMB-style exams. Students register, pick subjects, take a timed quiz, see their score, and review past attempts. There is also a study library and an admin panel for managing questions, users, results, and books.

It is built with plain **HTML, CSS and JavaScript**, with no frameworks and no build step, and talks to a hosted REST API.

**Live demo:** https://muyenbobo.github.io/cobalt-cbt/

## Features

- **Accounts**: register and log in (session kept in `localStorage`)
- **Practice**: choose 1–4 subjects and a time limit, then answer a quiz one question at a time
- **Countdown timer**: starts when the quiz opens, warns as time runs low, and submits automatically at 00:00
- **Results**: score, percentage, subjects covered, and time used
- **History**: every past attempt, newest first
- **Library**: search and read uploaded study texts
- **Admin panel** (admin accounts only): add, edit and delete questions; view all users; view every user's results; upload, edit and delete books
- **Server wake-up**: the hosted API sleeps when idle, so the app pings it in the background as soon as any page loads

## Tech stack

- HTML5, CSS3, vanilla JavaScript (no React, no bundler)
- Hosted REST API: `https://cbt-api-tauf.onrender.com`
- Auth with a JWT token and role (`user` or `admin`)

## Team

| Member | Responsibility |
|---|---|
| **Bilal / Muhammad** | Login page and Registration page, plus the shared foundation: `api.js`, `auth.js` / session handling, shared CSS and nav |
| **Samantha** | Dashboard page (subject selection) |
| **Musty** | Results page (score screen) and History page (past attempts) |
| **Aliyu / Yusuf** | Library page (search, list, read books) and Quiz page (timed questions, answering, submit) |
| **Steven** | Timer, and the Admin page: questions management (add/edit/delete), users list, all-results view, and books management (upload/edit/delete) |

## Project structure

```
cobalt/
├── index.html          Login / register
├── dashboard.html      Subject selection + time limit
├── quiz.html           Timed quiz
├── results.html        Score screen
├── history.html        Past attempts
├── books.html          Library
├── admin.html          Admin panel (admin accounts only)
├── css/
│   └── style.css       Shared styles
└── js/
    ├── auth.js         Session helpers (save / read / clear, login guards)
    ├── api.js          Every network call + background API wake-up
    ├── ui.js           DOM helper, header and nav shared by all pages
    ├── index.js
    ├── dashboard.js
    ├── quiz.js         Includes the countdown timer
    ├── results.js
    ├── history.js
    ├── books.js
    └── admin.js
```

Scripts load in this order on every page: `auth.js` → `api.js` → `ui.js` → the page's own script.

## Getting started

### 1. Clone the repo

```bash
git clone https://github.com/<your-username>/cobalt.git
cd cobalt
```

### 2. Serve it locally

The app is plain static files, so any static server works. Serve the folder rather than double-clicking `index.html`, because pages opened straight from disk (`file://`) have not been tested with the API. For example:

```bash
npx http-server -p 3000 -c-1
```

(`-c-1` turns off caching so edits show up on a normal refresh.) Other options: `python -m http.server 3000`, or the VS Code Live Server extension.

### 3. Open the app

Go to **http://localhost:3000** (or whichever port you chose).

The first load after a period of inactivity can take up to a minute while the hosted API wakes up. A small "Waking up the server…" note shows until it is ready.

## How it works

### Timer

- The time limit is chosen on the dashboard. The default is **Auto: 1 minute per question** (change `SECONDS_PER_QUESTION` in `js/dashboard.js`).
- The countdown starts when `quiz.html` first opens and runs to a fixed deadline saved in `sessionStorage`, so **refreshing the page does not reset it**.
- The clock turns amber at 5 minutes and red at 1 minute, then the quiz locks and **submits automatically at 00:00**.
- If a submit fails, answers are kept and a **Retry submit** button appears.
- Keyboard shortcuts: `A`–`D` choose an option, `←` `→` move between questions.

### API wake-up

The API runs on a free hosting tier and sleeps after about 15 idle minutes. `api.js` sends a background request the moment any page loads, and holds the first real request until the server answers. It does not repeat the ping on every page change (10-minute window).

### Data shared between pages

| Key | Storage | Written by → read by |
|---|---|---|
| `cbt_session` (`token`, `role`, `username`) | `localStorage` | login page → every page |
| `cobalt_quiz` (questions, answers, deadline) | `sessionStorage` | dashboard → quiz |
| `cobalt_last_result` | `sessionStorage` | quiz → results |

## API notes

- The API accepted requests from the deployed GitHub Pages site, so it is not limited to `localhost:3000`. If you ever see a CORS error in the browser console, the API's allowed origins need to include your site's address (just the origin, e.g. `https://muyenbobo.github.io`, with no path).
- Failed login and register attempts return **HTTP 200** with a `{ message }` body, so the code checks for the expected field (for example `access_token`) rather than only the status.
- There is no endpoint to list questions, so editing or deleting a question in the admin panel needs its id.
- Adding a book uses `multipart/form-data`; editing a book sends title, author and category as query parameters.

## Contributing with Git

Each person works on their own pages, so branches rarely collide.

```bash
git checkout -b feature/<your-page>     # e.g. feature/admin
# ...make changes...
git add .
git commit -m "Add admin books management"
git push -u origin feature/<your-page>
```

Then open a pull request into `main`.

Shared files (`js/api.js`, `js/auth.js`, `js/ui.js`, `css/style.css`) are owned by Bilal / Muhammad. If your page needs a new API function or shared style, add it and mention it in your pull request so it can be merged cleanly.

## Original project

Cobalt is a vanilla JavaScript rebuild of a React + Vite CBT app originally named "Bench".