# Daddy's Trainer · Estado del proyecto

> Archivo de seguimiento. Se actualiza en cada hito para retomar sin re-explorar.
> Última actualización: 2026-06-14

## App
- **Carpeta**: `diet/` (app independiente; coexiste con `gym/` y `gym-v2/` en el repo)
- **Stack**: Next.js 14.2.35 (App Router) + Prisma + PostgreSQL
- **Marca**: Daddy's Trainer · Coach Pietro (oro/negro)
- **Idioma**: Español
- **Rama de desarrollo**: `claude/diet-app-fullstack-mobile-x03t7p` (se hace mirror a `main`)

## Funcionalidad implementada
- Auth (cookie base64, sin JWT). Demo: `demo@daddystrainer.com` / `demo1234`
- Dashboard: anillo calorías, barras macros, comidas del día
- Diario de comidas + búsqueda local + USDA FoodData Central + alertas openFDA
- Fichas de cliente (CRUD) con categoría de culturismo y BF%
- Valoración corporal (plicometría Yuhász/JP3/US Navy, TDEE Mifflin-St Jeor)
- Correcciones enhanced/TRT (TDEE +18%/+8%, proteína por kg LBM)
- Suplementos por objetivo × categoría
- 10 zumos naturales vitamínicos
- Asistente de plan nutricional (6 pasos, skill nutr)
- Seed: 65 alimentos españoles/andaluces (pescado primero)

## DESPLIEGUE (en curso) — Railway proyecto `adequate-purpose`
Estado: build local VERDE. Fixes aplicados:
1. ✅ `railway.json` builder NIXPACKS → **RAILPACK** (NIXPACKS deprecado)
2. ✅ Next.js 14.2.23 → **14.2.35** (CVE-2025-55184, CVE-2025-67779)
3. ✅ React 19 `useActionState` → React 18 `useFormState` + `SubmitButton` (useFormStatus) en 13 páginas
4. ✅ `computeMacros`/`DayEntry` movidos fuera de archivo `'use server'` → `lib/diary-utils.ts`
5. ✅ Tipo compartido `FormState` + anotación de retorno en todas las server actions
6. ✅ Fix narrowing `requireAuth`, tipo `firm` en recalls FDA, tipo `AssessmentResult`
7. ✅ eslint 9 → 8.57.1 (conflicto peer con eslint-config-next)
8. ✅ `/diary/add` `useSearchParams` envuelto en Suspense
9. ✅ Añadido `diet/.gitignore` + `package-lock.json` commiteado (build reproducible)
> `npm run build` pasa al 100% (29 páginas). Pusheado a `main` → Railway redeploy.

### Pendiente para que la app funcione tras el deploy:
- [ ] Build verde en Railway
- [ ] Añadido PostgreSQL en el proyecto (usuario dice ✅)
- [ ] Variables en el servicio Next.js:
  - `DATABASE_URL = ${{Postgres.DATABASE_URL}}`
  - `NODE_ENV = production`
  - `SESSION_SECRET = <string largo>`
  - (opcional) `USDA_API_KEY`, `FDA_API_KEY`
- [ ] Root Directory del servicio = `diet`
- [ ] Ejecutar seed tras primer deploy: `npm run db:seed`

### GitHub Actions (alternativa de deploy)
- Workflow: `.github/workflows/deploy-diet.yml` (push a `main` con cambios en `diet/**`)
- Requiere: secret `RAILWAY_TOKEN` (usuario dice ✅) + variable `RAILWAY_PROJECT_ID`

## Notas de entorno
- Railway CLI / API bloqueados por egress de red desde el entorno cloud → deploy se gestiona desde la UI de Railway o GitHub Actions.
- `startCommand`: `npx prisma migrate deploy && npm start`

## Próximo paso
Confirmar build verde en Railway con Next 14.2.35; luego verificar variables y correr seed.
