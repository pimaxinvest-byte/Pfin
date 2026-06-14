// ─── Base de recetas (cocina española/andaluza, prevalencia de pescado) ──────
// Cada receta lleva kcal aproximadas + elaboración breve. El generador rota y
// combina por objetivo de calorías y por una semilla (cliente/usuario), de modo
// que el plan varía entre personas y no es el mismo para todos.

export type Meal = { title: string; kcal: number; prep: string }
export type DayPlan = { breakfast: Meal; lunch: Meal; dinner: Meal; snack: Meal }
export type VariedWeekPlan = Record<string, DayPlan>

const BREAKFASTS: Meal[] = [
  { title: 'Avena con leche desnatada, plátano y canela', kcal: 380, prep: 'Cuece 60g de avena en 250ml de leche desnatada, añade plátano en rodajas y canela.' },
  { title: 'Tortilla de 5 claras y 1 huevo con pan integral', kcal: 320, prep: 'Cuaja las claras con el huevo a fuego medio; acompaña con 1 rebanada de pan integral.' },
  { title: 'Yogur griego 0% con fresas y nueces', kcal: 300, prep: 'Mezcla 200g de yogur griego 0% con fresas troceadas y 20g de nueces.' },
  { title: 'Tostada de pan de pueblo con tomate, AOVE y jamón serrano', kcal: 420, prep: 'Tuesta el pan, frota tomate, riega con AOVE y añade 50g de jamón serrano.' },
  { title: 'Porridge de avena con proteína whey y kiwi', kcal: 450, prep: 'Cuece 60g de avena, fuera del fuego añade 25g de whey y kiwi en rodajas.' },
  { title: 'Revuelto de huevos con espinacas y aguacate', kcal: 480, prep: 'Saltea espinacas, añade 2 huevos y cuaja; acompaña con medio aguacate.' },
  { title: 'Salmorejo cordobés con huevo duro', kcal: 350, prep: 'Tritura tomate, pan, ajo y AOVE; sirve frío con huevo duro picado.' },
  { title: 'Tortitas de avena y plátano con miel', kcal: 520, prep: 'Tritura 60g de avena, 1 plátano y 1 huevo; cuaja en sartén y añade un hilo de miel.' },
  { title: 'Pan integral con atún, tomate y aguacate', kcal: 460, prep: 'Monta tostada integral con atún al natural, tomate y láminas de aguacate.' },
  { title: 'Yogur con granola casera y arándanos', kcal: 400, prep: 'Sirve 200g de yogur con 40g de granola y un puñado de arándanos.' },
  { title: 'Batido de avena, plátano, cacao y leche', kcal: 560, prep: 'Bate 50g de avena, 1 plátano, cacao puro y 300ml de leche desnatada.' },
  { title: 'Tostada francesa integral con fruta', kcal: 540, prep: 'Empapa pan integral en huevo y leche, dora en sartén y sirve con fruta fresca.' },
]

const LUNCHES: Meal[] = [
  { title: 'Merluza al vapor con arroz integral y ensalada', kcal: 520, prep: 'Cuece 200g de merluza al vapor; acompaña con 150g de arroz integral y ensalada mixta.' },
  { title: 'Dorada al horno con patata y verduras', kcal: 560, prep: 'Hornea la dorada con patata en rodajas, pimiento y cebolla a 200°C 25 min.' },
  { title: 'Atún fresco a la plancha con pasta integral y tomate', kcal: 620, prep: 'Marca el atún 1 min por lado; sirve con 80g (seco) de pasta integral y tomate.' },
  { title: 'Salmón a la plancha con boniato y brócoli', kcal: 650, prep: 'Plancha el salmón; acompaña con boniato al horno y brócoli al vapor.' },
  { title: 'Lubina a la sal con arroz y pimientos asados', kcal: 540, prep: 'Hornea la lubina cubierta de sal 25 min; sirve con arroz y pimientos asados.' },
  { title: 'Lentejas estofadas con verduras y pez espada', kcal: 600, prep: 'Guisa lentejas con verduras; añade tacos de pez espada al final.' },
  { title: 'Garbanzos con espinacas y bacalao', kcal: 580, prep: 'Saltea garbanzos cocidos con espinacas y bacalao desmigado.' },
  { title: 'Pollo a la plancha con quinoa y ensalada', kcal: 560, prep: 'Plancha 150g de pechuga; acompaña con 150g de quinoa cocida y ensalada.' },
  { title: 'Arroz con pollo y verduras', kcal: 640, prep: 'Sofríe pollo y verduras, añade arroz y caldo, cuece 18 min.' },
  { title: 'Paella de marisco (ración controlada)', kcal: 600, prep: 'Arroz con caldo de pescado, gambas, mejillones y calamar; ración de 250g.' },
  { title: 'Ternera magra con patata y judías verdes', kcal: 680, prep: 'Plancha 150g de ternera magra; acompaña con patata cocida y judías verdes.' },
  { title: 'Pasta integral con gambas y tomate', kcal: 600, prep: 'Saltea gambas con ajo y tomate; mezcla con 80g (seco) de pasta integral.' },
]

const DINNERS: Meal[] = [
  { title: 'Gambas a la plancha con brócoli y tortilla de claras', kcal: 380, prep: 'Plancha las gambas, cuece el brócoli y cuaja una tortilla de claras.' },
  { title: 'Caballa a la plancha con espinacas y huevo', kcal: 450, prep: 'Plancha la caballa; acompaña con espinacas rehogadas y huevo a la plancha.' },
  { title: 'Calamares a la plancha con verduras asadas', kcal: 400, prep: 'Marca los calamares con ajo y perejil; sirve con verduras asadas.' },
  { title: 'Sardinas a la plancha con pimientos y medio aguacate', kcal: 480, prep: 'Plancha las sardinas; acompaña con pimientos asados y medio aguacate.' },
  { title: 'Pechuga de pavo con berenjena al horno', kcal: 420, prep: 'Plancha el pavo; hornea berenjena en láminas con AOVE y orégano.' },
  { title: 'Revuelto de gambas y espárragos', kcal: 360, prep: 'Saltea espárragos y gambas, añade 2 huevos y cuaja suave.' },
  { title: 'Crema de calabacín con queso fresco y huevo', kcal: 390, prep: 'Tritura calabacín cocido; sirve con queso fresco y huevo duro.' },
  { title: 'Boquerones en vinagre con ensalada y pan', kcal: 440, prep: 'Sirve boquerones en vinagre con ensalada de tomate y 1 rebanada de pan.' },
  { title: 'Mejillones al vapor con ensalada mixta', kcal: 360, prep: 'Abre los mejillones al vapor con limón; acompaña con ensalada mixta.' },
  { title: 'Pulpo a la gallega con patata', kcal: 420, prep: 'Sirve pulpo cocido sobre patata con pimentón y AOVE.' },
  { title: 'Tortilla de espinacas con pavo', kcal: 410, prep: 'Cuaja huevos con espinacas y tacos de pavo a fuego medio.' },
  { title: 'Bacalao al pil-pil con pimientos', kcal: 520, prep: 'Confita el bacalao en AOVE y ajo, emulsiona la salsa; sirve con pimientos.' },
]

const SNACKS: Meal[] = [
  { title: 'Yogur griego 0% con nueces', kcal: 220, prep: '150g de yogur griego 0% con 20g de nueces.' },
  { title: 'Plátano con proteína whey', kcal: 230, prep: '1 plátano + 25g de whey en agua o leche desnatada.' },
  { title: 'Queso fresco de Burgos con fresas', kcal: 180, prep: '80g de queso fresco con fresas troceadas.' },
  { title: 'Almendras y manzana', kcal: 280, prep: '30g de almendras crudas + 1 manzana.' },
  { title: 'Tortitas de arroz con pavo y aguacate', kcal: 250, prep: '2 tortitas de arroz con pavo y láminas de aguacate.' },
  { title: 'Requesón con miel y nueces', kcal: 300, prep: '150g de requesón con un hilo de miel y nueces.' },
  { title: 'Batido de whey con leche desnatada', kcal: 200, prep: '25g de whey en 300ml de leche desnatada.' },
  { title: 'Huevos duros con tomate', kcal: 180, prep: '2 huevos duros con rodajas de tomate y sal.' },
  { title: 'Hummus con crudités de zanahoria', kcal: 220, prep: '50g de hummus con bastones de zanahoria y pepino.' },
  { title: 'Yogur con higos frescos', kcal: 210, prep: '150g de yogur griego con 2 higos frescos.' },
  { title: 'Tostada integral con crema de cacahuete', kcal: 320, prep: '1 rebanada integral con 20g de crema de cacahuete.' },
  { title: 'Pavo en lonchas con palitos de pepino', kcal: 160, prep: '80g de pavo en lonchas con pepino en bastones.' },
]

// Distribución de calorías por comida (suma ≈ 1)
function ratios(goal: string): { breakfast: number; lunch: number; dinner: number; snack: number } {
  if (goal === 'gain') return { breakfast: 0.27, lunch: 0.35, dinner: 0.26, snack: 0.12 }
  return { breakfast: 0.25, lunch: 0.35, dinner: 0.28, snack: 0.12 }
}

// Hash determinista (FNV-1a) para la semilla
export function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

// Devuelve un selector que, para el día i, da una receta del pool cercana al
// objetivo de kcal de esa comida, rotada por la semilla → varía por persona y
// no repite dentro de la semana.
function picker(pool: Meal[], slotKcal: number, seed: number) {
  const sorted = [...pool].sort((a, b) => Math.abs(a.kcal - slotKcal) - Math.abs(b.kcal - slotKcal))
  const size = Math.min(sorted.length, Math.max(7, 9))
  const window = sorted.slice(0, size)
  return (i: number) => window[(seed + i) % window.length]
}

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export function generateVariedWeekPlan(targetKcal: number, goal: string, seedStr: string): VariedWeekPlan {
  const kcal = Math.max(1200, Math.min(targetKcal || 2000, 6000))
  const r = ratios(goal)
  const seed = hashSeed(`${seedStr}:${Math.round(kcal / 50)}:${goal}`)

  const pickB = picker(BREAKFASTS, kcal * r.breakfast, seed)
  const pickL = picker(LUNCHES, kcal * r.lunch, seed + 3)
  const pickD = picker(DINNERS, kcal * r.dinner, seed + 7)
  const pickS = picker(SNACKS, kcal * r.snack, seed + 11)

  const plan: VariedWeekPlan = {}
  for (let i = 0; i < 7; i++) {
    plan[DAYS[i]] = { breakfast: pickB(i), lunch: pickL(i), dinner: pickD(i), snack: pickS(i) }
  }
  return plan
}
