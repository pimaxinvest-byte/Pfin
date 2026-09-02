# P-Quantum Lab Finance (`lab/`)

## PostgreSQL

Tablas: `clients`, `cases`, `case_services`, `documents`, `quotes`, `service_catalog`, `agency_users`.

Local:

```bash
cd lab
docker compose up -d
cp .env.example .env
npm install
npm start
```

Railway: plugin PostgreSQL + `DATABASE_URL` + `AGENCY_PIN`. Root directory `lab`. El schema se aplica al arrancar.

API: POST /api/cases · GET /api/cases/:ref-o-email · GET /api/agency/cases · GET /api/agency/catalog
