# GymBook v2

Version limpia de la app de reservas, preparada para Railway sin Docker.

## Funciones incluidas

- Setup inicial: si no hay usuarios, `/register` crea el primer admin.
- Login con cookie segura.
- Roles: admin, teacher, client.
- Admin crea profesores, salas y actividades.
- Admin o profesor crean franjas disponibles.
- Cliente ve franjas disponibles y reserva.
- Prisma con migracion real en `prisma/migrations`.

## Variables de entorno

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
SESSION_SECRET="usa-una-cadena-larga-y-segura"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## Railway

1. Crea un nuevo proyecto en Railway desde GitHub.
2. Usa como Root Directory:

```text
gym-v2
```

3. Anade PostgreSQL al proyecto.
4. En el servicio de la app, configura:

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
SESSION_SECRET=una-cadena-larga-y-segura
NEXT_PUBLIC_APP_URL=https://tu-app.up.railway.app
```

5. Railway usara Nixpacks. No hace falta Docker.
6. El predeploy ejecuta:

```bash
npx prisma migrate deploy
```

7. Abre la URL publica. La primera visita debe ir a `/register` para crear el admin.

## Local

Necesitas PostgreSQL disponible.

```bash
npm install
npx prisma migrate deploy
npm run dev
```

Despues abre:

```text
http://localhost:3000
```

## Datos demo opcionales

```bash
npm run db:seed
```

Usuarios demo:

- admin@gymbook.com / admin123
- maria@gymbook.com / teacher123
- cliente@gymbook.com / client123
