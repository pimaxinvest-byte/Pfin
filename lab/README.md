# P-Quantum Lab Finance (`lab/`)

Sitio de expediente Canadá–España dentro del monorepo [Pfin](https://github.com/pimaxinvest-byte/Pfin).

## Qué ve cada lado

- **Cliente** (`/expediente`): paquete recomendado automáticamente + **un solo total**. No hay tarifas por servicio.
- **Agencia** (`/agencia`): tarifario unitario (media Costa del Sol +33 %) + IVA + tasas + expedientes locales. PIN.

El motor elige NIE, no lucrativa (jubilado), empadronamiento, TIE, apostilla, traducción, modelo 100 si >183 días, 720 si patrimonio ≥ 50.000 €, 714 solo si CCAA sin bonus y patrimonio alto.

## Arranque local

```bash
cd lab
npm install
AGENCY_PIN=pimax2026 npm start
```

http://localhost:3000

## Railway

1. New Project → Deploy from GitHub → `pimaxinvest-byte/Pfin`
2. **Root Directory:** `lab`
3. Variable `AGENCY_PIN` (obligatoria en producción)
4. Healthcheck: `/api/health`
5. Start: `node server.js` (ya en `railway.json`)

Este servicio es independiente de `diet/` y `gym/`.
