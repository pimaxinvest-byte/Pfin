# DietBook

App de diario alimenticio mobile-first. Registra comidas, controla calorías y macros, y revisa tu progreso semanal.

## Funciones

- Registro diario por comida (desayuno, comida, cena, snack)
- Anillo de calorías y barras de macros en tiempo real
- Base de datos de 20+ alimentos verificados + alimentos personalizados
- Historial semanal con gráfica de barras
- Objetivos personalizables (kcal, proteínas, HC, grasas, fibra)
- Perfil con peso, altura, nivel de actividad y objetivo
- PWA instalable en Android (manifest + meta tags)

### Plan Nutricional (6 pasos, basado en skill `nutr`)

1. **Patrones actuales** — frecuencia de comidas, cocina, picoteo, hidratación, restricciones
2. **Objetivo y enfoque** — meta principal, plazo, enfoque (conteo/porciones/calidad/hábitos)
3. **Marco de comidas** — plantillas por comida con ejemplos reales (no planes rígidos)
4. **Obstáculos** — restaurantes, alcohol, viajes, bajón de fuerza de voluntad, antojos
5. **Compra semanal** — lista base y día fijo de preparación
6. **Hábitos graduales** — un cambio por semana + check-in semanal de energía/hambre/adherencia

## Variables de entorno

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
```

## Railway

1. Crea proyecto desde GitHub con Root Directory: `diet`
2. Añade PostgreSQL
3. Configura `DATABASE_URL=${{Postgres.DATABASE_URL}}`
4. El start command ejecuta `prisma migrate deploy && npm start`
5. Primera vez: `npm run db:seed` para cargar alimentos demo

## Local

```bash
cd diet
npm install
npx prisma migrate deploy
npm run db:seed   # opcional
npm run dev
```

Usuario demo: `demo@dietbook.com` / `demo1234`
