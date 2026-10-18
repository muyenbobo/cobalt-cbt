# Cobalt — CBT practice app (plain HTML, CSS & JavaScript)

JAMB-style Computer-Based Test practice. No frameworks, no build step.

## Run it

The API only allows requests from `http://localhost:3000`, so serve this folder on **port 3000**:

```
npx serve -l 3000
```

then open **http://localhost:3000** (use `localhost`, not `127.0.0.1`).
Any admin account will also show an **Admin** tab.

## Pages

| File | What it does | Team owner |
|---|---|---|
| `index.html` | Login + register | Person 1 |
| `dashboard.html` | Pick 1–4 subjects + time limit, start quiz, resume an unfinished quiz | Person 2 |
| `quiz.html` | The timed exam | Person 2 |
| `results.html` | Score screen | Person 3 |
| `history.html` | Past attempts | Person 3 |
| `books.html` | Library: search, read | Person 4 |
| `admin.html` | Questions, users, all results, book management | Person 5 |

Shared code (Person 1 owns; everyone else only *adds* to it):
`js/auth.js` (session) · `js/api.js` (every network call) · `js/ui.js` (DOM helper + header/nav) · `css/style.css`.

Script order on every page: `auth.js → api.js → ui.js → <page>.js`.

## The timer

* Choose a limit on the dashboard (default **Auto = 1 minute per question**; change `SECONDS_PER_QUESTION` in `js/dashboard.js`).
* The countdown starts when `quiz.html` first opens and runs to a fixed deadline saved in `sessionStorage`,
  so refreshing the page does **not** reset it.
* Turns amber at 5 minutes, red + pulsing at 1 minute, then **auto-submits at 00:00**.
* If a submit fails (network, etc.) answers are kept and a **Retry submit** button appears.
* Keyboard: `A`–`D` choose an option, `←` `→` move between questions.

## API wake-up

The API is on Render's free tier and sleeps when idle. `js/api.js` pings it in the background the moment
any page loads (`wakeUpApi()`), shows a small "Waking up the server…" pill, and holds the first real
request until the server answers. It won't re-ping on every page change (10-minute window).

## How data moves between pages

| Key | Storage | Set by → read by |
|---|---|---|
| `cbt_session` `{token, role, username}` | localStorage | index → every page |
| `cobalt_quiz` (questions, answers, deadline…) | sessionStorage | dashboard → quiz |
| `cobalt_last_result` | sessionStorage | quiz → results |
