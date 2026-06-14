# Daddy's Trainer · Estado del proyecto

> Archivo de seguimiento. Se actualiza en cada hito para retomar sin re-explorar.
> Última actualización: 2026-06-14
>
> ⚡ AL REANUDAR: leer SOLO este archivo. No re-explorar el código.

## ▶ AHORA MISMO (estado)
✅ App DESPLEGADA y arrancando en Railway. ✅ Variables OK. ✅ Seed automatizado en startCommand.
PENDIENTE USUARIO: generar dominio público (Settings → Networking → Generate Domain, puerto 8080).

### Estructura de roles (implementada)
- **Rol por email** (sin migración): `TRAINER_EMAILS` env o fallback
  `demo@daddystrainer.com` + `pimaxinvest@gmail.com` (Pietro Anoe).
- Trainers ven pestaña **Clientes** + **Cuentas activas** (`/users`): lista de TODOS los
  usuarios registrados con sus datos, objetivos calculados y plan. Ficha en `/users/[id]`.
- Clientes (resto) solo ven su diario/dashboard/plan; rutas `/clients` y `/users` bloqueadas
  (requireTrainer → redirect /dashboard).

### Algoritmos / cálculo (implementado)
- Al guardar Perfil (peso/altura/año/sexo/actividad/objetivo) → auto-calcula kcal+macros
  (BMR Mifflin → TDEE → rango objetivo) y guarda en UserGoals. (saveProfile en foods.ts)
- Plan de comidas VARIADO por recetas: `lib/recipes.ts` (50 recetas españolas con kcal+
  elaboración) + `generateVariedWeekPlan(kcal, goal, seed)` rota por cliente. Se muestra en
  `/plan` (usuario), `/clients/[id]` y `/users/[id]` (trainer).

Nota deploy: Railway despliega desde `main`. Workflow = commit dev → push dev →
`git push origin <dev>:main`. Riesgo: `db:seed` usa `tsx` (devDep); guard `|| true`.
NO puedo consultar la BD de producción desde este entorno (host interno + egress bloqueado):
la lista de cuentas se ve EN LA APP (/users), no desde aquí.

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

## Revisión con 3 agentes (2026-06-14) — IMPLEMENTADO
- **Seguridad:** cookie de sesión firmada con HMAC (SESSION_SECRET); IDOR cerrado (read actions derivan userId/trainerId de la sesión).
- **Corrección:** sexo obligatorio (no asumir 'M'); validación de food en diario; guard NaN en Navy; macros coherentes (suelo de grasa 15%); try/catch en escrituras.
- **UX:** color de acción → oro de marca (texto negro, WCAG AA); PWA instalable (iconos 192/512/maskable + apple-touch-icon); login/register con marca Daddy's Trainer; zoom accesible; theme negro.
- **CI:** `.eslintrc.json` + `.env.example`.
- Fórmulas de nutrición verificadas correctas por el agente de testing.

## DEPLOY — estado actual (2026-06-14 09:06)
- ✅ Build de Railway PASA.
- ❌ Contenedor en bucle de reinicio: **falta `DATABASE_URL`** (P1012) y **falta `SESSION_SECRET`**.
- ACCIÓN PENDIENTE DEL USUARIO en Railway (servicio de la app, pestaña Variables):
  - `DATABASE_URL = ${{Postgres.DATABASE_URL}}`  (referencia al servicio Postgres)
  - `SESSION_SECRET = <openssl rand -base64 32>`
  - `NODE_ENV = production`
- Tras arrancar: `npm run db:seed` para cargar 65 alimentos + usuario demo.

## Próximo paso
Usuario añade DATABASE_URL + SESSION_SECRET en Railway → contenedor arranca → seed.
Pendiente opcional (no bloquea): tests unitarios de lib/nutrition.ts, loading.tsx/toasts, colapsar ficha cliente, reordenar BottomNav.
