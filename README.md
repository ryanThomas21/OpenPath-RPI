# OpenPath-RPI
An accessible campus navigation app for finding routes based on users’ mobility and accessibility needs.

## Run locally

The frontend gets map and route data from Django, so `npm run dev` by itself
does not start the whole app. Choose one of these options:

### Docker Compose

Start Docker Desktop, then run from the repository root:

```sh
docker compose up --build
```

Open <http://localhost:5173>. Compose starts PostgreSQL and Django before Vite.

### Frontend and Django separately

In one terminal, install the backend requirements and start Django (SQLite is
used when `POSTGRES_HOST` is not set):

```sh
cd backend
python -m venv .venv
```

On Windows PowerShell, activate it with `.venv\Scripts\Activate.ps1` (on
macOS/Linux, use `source .venv/bin/activate`), then run:

```sh
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

In a second terminal:

```sh
cd frontend
npm ci
npm run dev
```

Open <http://localhost:5173>. Vite proxies `/api` requests to Django on port
8000; if Django is stopped, the page explains how to start the API and offers
a retry.

## Map data

The mock campus map, its format, and the labeled test scenarios (stairs,
accessible entrances, unreachable areas, no accessible route) are described in
[backend/locations/DATASET.md](backend/locations/DATASET.md).

# Instructions:
1. Choose or receive a GitHub issue.
2. Create a branch for that issue.
3. Make and test your changes.
4. Commit your work using a clear message.
5. Push the branch to GitHub.
6. Open a pull request.
7. Do not merge your own pull request unless the Project Lead approves it.
