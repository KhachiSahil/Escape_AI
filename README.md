# ESCAPE_AI

Real-time Voice AI customer support platform.

## Tech Stack

### Frontend

* React JS
* Javascript
* TailwindCSS

### Backend

* Node.js
* WebSockets

### AI Agent

* Python
* FastAPI
* STT/TTS integrations
* Langchain

---

## Architecture

Frontend → Backend Gateway → AI Agent

---

## Project Structure

```txt id="j8j86t"
packages/
├── frontend/
├── backend/
└── agent/
```

---

## Running locally

```
npm install
npm run dev
```

Starts all three services together (`backend/api` on :4000, `frontend` on
:5173, the Python voice agent on :7860), labeled and color-coded in one
terminal. Requires Node.js, npm, and [uv](https://docs.astral.sh/uv/) (for
the Python agent) already installed, plus each service's own `.env` filled
in (`backend/api/.env`, `backend/src/server/.env`).

To run a single service on its own: `npm run dev --prefix backend/api`,
`npm run dev --prefix frontend`, or `npm run agent`.

---

## Engineering Rules

See:

```txt id="afjm6e"
docs/architecture/
docs/rules/
```
