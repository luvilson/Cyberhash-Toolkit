# CyberHash Toolkit

Professional hash generator, identifier, and analysis toolkit for security
professionals and students. Built for defenders, not attackers.

## Stack

- **Frontend:** HTML5, CSS3, vanilla JavaScript (no build step)
- **Backend:** Python, FastAPI
- **Database:** SQLite via SQLAlchemy ORM

## Project layout

```
cyberhash-toolkit/
├── backend/
│   ├── app/
│   │   ├── main.py            FastAPI app, CORS, static frontend mount
│   │   ├── database.py        SQLAlchemy engine/session
│   │   ├── models.py          HistoryEntry ORM model
│   │   ├── schemas.py         Pydantic request/response models
│   │   ├── api/routes.py      All /api/* endpoints
│   │   └── services/          hashing.py, identify.py, encoding.py, wordlist.py
│   └── requirements.txt
└── frontend/
    ├── index.html
    ├── styles/main.css
    └── scripts/{api.js, main.js}
```

## Run it locally

**1. Install backend dependencies**

```bash
cd backend
python3 -m venv venv          # optional but recommended
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

> On some Debian/Ubuntu systems without a virtual environment, `pip`
> refuses to install with an "externally managed environment" error.
> Either use the `venv` steps above (recommended), or add
> `--break-system-packages` to the `pip install` command.

**2. Start the server**

```bash
uvicorn app.main:app --reload --port 8000
```

The backend automatically serves the frontend as static files from the
same origin, so this single command runs the whole app.

**3. Open the app**

Visit **http://localhost:8000** in your browser. That's it — no separate
frontend server or build step needed.

Interactive API docs (Swagger UI) are available at
**http://localhost:8000/docs**.

## Running frontend and backend separately (optional)

If you'd rather serve the frontend from its own dev server (e.g. VS
Code's Live Server on port 5500), add this line to the top of
`frontend/index.html`, before the other `<script>` tags:

```html
<script>window.CYBERHASH_API_BASE = "http://localhost:8000";</script>
```

and make sure the backend's `FRONTEND_ORIGINS` environment variable
includes your dev server's origin (it already includes
`http://localhost:5500` and `http://127.0.0.1:5500` by default).

## Notes on scope and safety

- The **Hash Decoder** and **Wordlist Attack** modules only ever check
  against small, curated, built-in wordlists — never external credential
  dumps — and cap the number of candidates tried.
- The **Brute-Force Demo** is hard-capped at a maximum candidate length
  of 5 and a total search-space ceiling, specifically so it stays a fast
  educational illustration rather than a real cracking tool.
- History is stored locally in the app's own SQLite database
  (`backend/cyberhash.db`, created automatically on first run) purely
  for your convenience — nothing is sent anywhere else.

## Database

The SQLite file `cyberhash.db` is created automatically in `backend/`
on first run. To reset all history, stop the server and delete that
file (or use the "Clear History" button in the app).
