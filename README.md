# ✈ Travel Destinations

> **Note:** `mysql-connector-python` er til MySQL og er ikke kompatibelt med PostgreSQL.
> `psycopg2-binary` bliver brugt i stedet som PostgreSQL driver, da jeg allerede havde det installeret på min maskine i forbindelse med arbejde.

---

## Start appen på din maskine

### 1. Opstart gennem Docker

```bash
docker compose up --build
```

Dette skaber to containers:
- `travel_db` — PostgreSQL 16 på port `5432`
- `travel_backend` — Flask API på port `5001`

Backenden venter på at databasen får status **healthy** før den starter, hvorefter den automatisk laver tabellerne `users` og `destinations` på første opstart.

### 2. Byg TypeScript frontenden

```bash
cd frontend
npm install
npm run build

# Ellers kan man bruge scriptet nedenunder
# for at slå watch mode til under udvikling:
npm run watch
```

### 3. Tilgå din Frontend

Åben `frontend/index.html` direkte i din browser.
