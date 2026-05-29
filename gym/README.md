# GymBook — Sistema de Reservas de Gimnasio

App web **mobile-first** para gestionar reservas de espacios y sesiones en un gimnasio.

## Stack

- **Frontend**: Next.js 14 (App Router) + Tailwind CSS
- **Backend**: Next.js API Routes
- **Base de datos**: PostgreSQL + Prisma ORM
- **Auth**: NextAuth.js (email/contraseña + roles)
- **Notificaciones**: Telegram Bot API

## Roles

| Rol | Acceso |
|-----|--------|
| `admin` | Todo: usuarios, espacios, actividades, configuración, calendario completo |
| `teacher` | Su propio calendario, crear franjas individuales y recurrentes |
| `client` | Ver disponibilidad, reservar sesiones, cancelar, historial |

## Instalación

### 1. Clonar y entrar al directorio

```bash
cd gym
npm install
```

### 2. Variables de entorno

```bash
cp .env.example .env
```

Edita `.env`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/gym_booking"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="tu-secret-aqui"  # openssl rand -base64 32
TELEGRAM_BOT_TOKEN="opcional"
TELEGRAM_ADMIN_CHAT_ID="opcional"
```

### 3. Base de datos

```bash
# Crear la base de datos y aplicar el esquema
npm run db:push

# Cargar datos de ejemplo
npm run db:seed
```

### 4. Desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Usuarios de prueba (tras el seed)

| Rol | Email | Contraseña |
|-----|-------|------------|
| Admin | admin@gymbook.com | admin123 |
| Profesor | maria@gymbook.com | teacher123 |
| Profesor | carlos@gymbook.com | teacher123 |
| Cliente | juan@email.com | client123 |

## Despliegue

### Railway / Render / Fly.io

1. Crea una base de datos PostgreSQL
2. Configura las variables de entorno
3. Conecta el repo y despliega la carpeta `gym/`

### Vercel (recomendado)

```bash
cd gym
npx vercel
```

Configura las env vars en el dashboard de Vercel.

## Telegram

1. Crea un bot con [@BotFather](https://t.me/BotFather) en Telegram
2. Copia el token en Ajustes → Configuración de Telegram
3. Obtén tu Chat ID hablando con [@userinfobot](https://t.me/userinfobot)
4. Los usuarios también pueden añadir su propio Chat ID en su perfil

## Estructura del proyecto

```
gym/
├── app/
│   ├── (auth)/           # Login, registro
│   ├── (admin)/admin/    # Dashboard, usuarios, espacios, actividades, ajustes
│   ├── (teacher)/teacher/ # Calendario, reservas, recurrentes
│   ├── (client)/dashboard/ # Inicio, reservar, mis reservas, profesores
│   └── api/              # Endpoints REST
├── components/
│   ├── calendar/         # Calendar, DayView, WeekView, MonthView, BookingDetail
│   ├── layout/           # BottomNav, Header
│   └── ui/               # Modal, StatusBadge
├── lib/
│   ├── prisma.ts         # Cliente Prisma
│   ├── auth.ts           # NextAuth config
│   ├── telegram.ts       # Notificaciones Telegram
│   └── utils.ts          # Utilidades fecha, colores
├── prisma/
│   ├── schema.prisma     # Esquema BD
│   └── seed.ts           # Datos iniciales
└── middleware.ts          # Protección de rutas por rol
```

## API Reference

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/register` | Registro |
| GET/POST | `/api/bookings` | Listar / crear reservas |
| GET/PATCH/DELETE | `/api/bookings/:id` | Detalle / editar / eliminar |
| POST | `/api/bookings/:id/reserve` | Cliente reserva una franja |
| POST | `/api/bookings/recurring` | Crear reservas recurrentes |
| GET | `/api/bookings/stats` | Estadísticas |
| GET/POST | `/api/users` | Listar / crear usuarios |
| PATCH/DELETE | `/api/users/:id` | Editar / eliminar usuario |
| GET/POST | `/api/spaces` | Espacios |
| GET/POST | `/api/activities` | Actividades |
| GET/PATCH | `/api/settings` | Configuración app |

## Flujo principal

1. **Admin** configura el gimnasio, profesores y espacios
2. **Profesor** crea franjas recurrentes: *"Lun/Mié/Vie 10:00-11:00 junio"*
3. El sistema genera todas las franjas automáticamente (detecta conflictos)
4. **Cliente** ve las franjas disponibles, filtra por profesor/actividad y reserva
5. Todos reciben notificación por Telegram
6. **Admin** ve el calendario completo con estadísticas

## Futuras funciones

- 💳 Pagos online (Stripe)
- 🎟 Bonos de sesiones
- ⏳ Lista de espera
- 🔔 Recordatorios automáticos (24h antes)
- 📊 Informes avanzados
- 📱 PWA instalable
