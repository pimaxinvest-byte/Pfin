export type Sex = 'M' | 'F'
export type BuildingCategory = 'beginner' | 'recreational' | 'natural_comp' | 'enhanced_comp' | 'trt'

export const CATEGORY_LABELS: Record<BuildingCategory, string> = {
  beginner: 'Principiante',
  recreational: 'Recreativo / Fitness',
  natural_comp: 'Competición Natural',
  enhanced_comp: 'Competición Enhanced',
  trt: 'TRT (Terapia Hormonal)',
}

// ─── BMR (Mifflin-St Jeor, 1990) ─────────────────────────────────────────────
export function calcBMR(weightKg: number, heightCm: number, ageYears: number, sex: Sex): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears
  return Math.round(sex === 'M' ? base + 5 : base - 161)
}

// ─── TDEE ─────────────────────────────────────────────────────────────────────
const ACTIVITY_MULT: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
}

export function calcTDEE(bmr: number, activityLevel: string): number {
  return Math.round(bmr * (ACTIVITY_MULT[activityLevel] ?? 1.55))
}

// ─── Corrección TDEE para terapia anabólica / enhanced ───────────────────────
// Enhanced athletes have higher BMR due to increased muscle protein synthesis
export function enhancedTDEEMultiplier(category: BuildingCategory): number {
  if (category === 'enhanced_comp') return 1.18  // +18% en ciclo completo
  if (category === 'trt') return 1.08            // +8% TRT solo
  return 1.0
}

export function calcTDEEEnhanced(bmr: number, activityLevel: string, category: BuildingCategory): number {
  const base = calcTDEE(bmr, activityLevel)
  return Math.round(base * enhancedTDEEMultiplier(category))
}

// ─── Goal-adjusted range ─────────────────────────────────────────────────────
export function goalKcalRange(tdee: number, goal: string): { min: number; max: number } {
  if (goal === 'lose') return { min: tdee - 500, max: tdee - 200 }
  if (goal === 'gain') return { min: tdee + 200, max: tdee + 400 }
  return { min: tdee - 100, max: tdee + 100 }
}

// ─── Macro recommendations con corrección anabólica ──────────────────────────
export function macroTargets(kcal: number, leanMassKg: number, goal: string, category: BuildingCategory = 'recreational') {
  // Protein requirements (g/kg LBM)
  const proteinPerKg: Record<BuildingCategory, number> = {
    beginner: 1.6,
    recreational: 1.8,
    natural_comp: 2.2,
    enhanced_comp: 3.0,   // mayor síntesis proteica, más requerimiento
    trt: 2.4,
  }
  const proteinG = Math.round(leanMassKg * (proteinPerKg[category] ?? 1.8))
  const proteinKcal = proteinG * 4
  // Fat: 25% of kcal, but never let protein + fat exceed the calorie budget.
  // In aggressive cuts with very high protein (enhanced), drop fat toward a
  // 15% floor so carbs don't go negative and the macro split stays coherent.
  let fatG = Math.round((kcal * 0.25) / 9)
  if (proteinKcal + fatG * 9 > kcal) {
    const fatFloorKcal = Math.max(kcal * 0.15, kcal - proteinKcal)
    fatG = Math.max(0, Math.round(Math.min(kcal * 0.25, fatFloorKcal) / 9))
  }
  const fatKcal = fatG * 9
  // Carbs: remainder
  const carbsG = Math.round((kcal - proteinKcal - fatKcal) / 4)
  const fiberG = Math.round(kcal / 66) // ~30g per 2000 kcal
  return { proteinG, carbsG: Math.max(0, carbsG), fatG, fiberG }
}

// ─── Plicometría: Yuhász (1974) ───────────────────────────────────────────────
// Sites: triceps, subscapular, abdominal, suprailiac (supraespinal), thigh (muslo)
// All in mm
export function bodyFatYuhasz(
  triceps: number,
  subscapular: number,
  abdominal: number,
  suprailiac: number,
  thigh: number,
  sex: Sex,
): number {
  const sum5 = triceps + subscapular + abdominal + suprailiac + thigh
  return sex === 'M' ? sum5 * 0.1051 + 2.585 : sum5 * 0.1548 + 3.58
}

// ─── Plicometría: Jackson & Pollock (1978/1980) — 3 sitios ───────────────────
// Men: abdomen + subscapular (proxy chest) + thigh
// Women: triceps + suprailiac + thigh
// Returns body density → Siri equation → %fat
export function bodyFatJP3(
  a: number, b: number, c: number,
  age: number, sex: Sex,
): number {
  const S = a + b + c
  let bd: number
  if (sex === 'M') {
    bd = 1.10938 - 0.0008267 * S + 0.0000016 * S * S - 0.0002574 * age
  } else {
    bd = 1.099492 - 0.0009929 * S + 0.0000023 * S * S - 0.0001392 * age
  }
  return (495 / bd) - 450
}

// ─── Perímetros: US Navy method ───────────────────────────────────────────────
// Men: abdomen (navel), neck, height
// Women: waist (narrowest), hip, neck, height
export function bodyFatNavy(
  waistCm: number,
  hipCm: number | null,
  neckCm: number,
  heightCm: number,
  sex: Sex,
): number {
  if (sex === 'M') {
    // log10 argument must be positive: waist must exceed neck
    if (waistCm - neckCm <= 0 || heightCm <= 0) return NaN
    const val = 86.010 * Math.log10(waistCm - neckCm) - 70.041 * Math.log10(heightCm) + 36.76
    return Math.max(0, val)
  }
  const hip = hipCm ?? waistCm * 1.1
  if (waistCm + hip - neckCm <= 0 || heightCm <= 0) return NaN
  const val = 163.205 * Math.log10(waistCm + hip - neckCm) - 97.684 * Math.log10(heightCm) - 78.387
  return Math.max(0, val)
}

// ─── Classification ───────────────────────────────────────────────────────────
export function bfCategory(pct: number, sex: Sex): { label: string; color: string } {
  const thresholds: [number, string, string][] = sex === 'M'
    ? [
        [6, 'Esencial', '#7c3aed'],
        [14, 'Atlético', '#16a34a'],
        [18, 'Fitness', '#2563eb'],
        [25, 'Aceptable', '#d97706'],
        [Infinity, 'Obesidad', '#dc2626'],
      ]
    : [
        [14, 'Esencial', '#7c3aed'],
        [21, 'Atlético', '#16a34a'],
        [25, 'Fitness', '#2563eb'],
        [32, 'Aceptable', '#d97706'],
        [Infinity, 'Obesidad', '#dc2626'],
      ]
  for (const [max, label, color] of thresholds) {
    if (pct < max) return { label, color }
  }
  return { label: 'Obesidad', color: '#dc2626' }
}

// ─── Suplementos recomendados por objetivo y categoría ───────────────────────
export type Supplement = {
  name: string
  dose: string
  timing: string
  priority: 'esencial' | 'recomendado' | 'opcional'
  note?: string
}

export function getSupplements(goal: string, category: BuildingCategory): Supplement[] {
  const base: Supplement[] = [
    { name: 'Proteína de suero (Whey)', dose: '25-30g', timing: 'Post-entrenamiento', priority: 'esencial' },
    { name: 'Creatina monohidrato', dose: '5g', timing: 'Cualquier momento del día', priority: 'esencial' },
    { name: 'Multivitamínico', dose: '1 cápsula', timing: 'Con el desayuno', priority: 'esencial' },
    { name: 'Omega-3 (EPA+DHA)', dose: '2-3g', timing: 'Con comidas', priority: 'recomendado' },
    { name: 'Vitamina D3', dose: '2000-4000 UI', timing: 'Mañana con grasa', priority: 'recomendado' },
    { name: 'Magnesio quelato', dose: '300mg', timing: 'Noche', priority: 'recomendado' },
  ]

  if (goal === 'lose') {
    base.push(
      { name: 'L-Carnitina L-Tartrato', dose: '2g', timing: '30 min antes del cardio', priority: 'recomendado' },
      { name: 'Cafeína', dose: '100-200mg', timing: '30 min pre-entrenamiento', priority: 'recomendado' },
      { name: 'CLA (Ácido Linoleico Conjugado)', dose: '3g', timing: 'Con comidas', priority: 'opcional' },
      { name: 'Caseína', dose: '25-30g', timing: 'Antes de dormir', priority: 'recomendado', note: 'Digestión lenta, anti-catabolismo nocturno' },
    )
  }

  if (goal === 'gain') {
    base.push(
      { name: 'EAA / BCAA', dose: '10g', timing: 'Durante el entrenamiento', priority: 'recomendado' },
      { name: 'Beta-Alanina', dose: '3.2g', timing: 'Pre-entrenamiento', priority: 'recomendado', note: 'Puede causar parestesia (hormigueo), normal' },
      { name: 'Caseína', dose: '30g', timing: 'Antes de dormir', priority: 'esencial', note: 'Crítico para síntesis proteica nocturna' },
      { name: 'Carbohidratos (dextrosa/maltodextrina)', dose: '40-80g', timing: 'Post-entrenamiento', priority: 'opcional' },
    )
  }

  if (category === 'natural_comp') {
    base.push(
      { name: 'Ashwagandha (KSM-66)', dose: '600mg', timing: 'Noche', priority: 'recomendado', note: 'Reduce cortisol, apoya testosterona natural' },
      { name: 'Zinc + Magnesio (ZMA)', dose: 'Según fabricante', timing: 'Noche con estómago vacío', priority: 'recomendado' },
      { name: 'L-Glutamina', dose: '5g', timing: 'Post-entreno + antes de dormir', priority: 'opcional' },
    )
  }

  if (category === 'enhanced_comp' || category === 'trt') {
    base.push(
      { name: 'Protector hepático (Milk Thistle / TUDCA)', dose: '500mg', timing: 'Con comidas', priority: 'esencial', note: '⚠️ OBLIGATORIO en ciclos orales' },
      { name: 'Taurina', dose: '3-5g', timing: 'Pre-entrenamiento o con comidas', priority: 'esencial', note: 'Cardioprotector y anticalambres' },
      { name: 'Ácido Alfa-Lipoico (ALA)', dose: '300-600mg', timing: 'Con comidas ricas en HC', priority: 'recomendado', note: 'Mejora sensibilidad a insulina' },
      { name: 'N-Acetil Cisteína (NAC)', dose: '600mg x2', timing: 'Con comidas', priority: 'recomendado', note: 'Antioxidante hepático' },
      { name: 'Coenzima Q10', dose: '200mg', timing: 'Con comida grasa', priority: 'recomendado', note: 'Protección cardiovascular' },
      { name: 'Omega-3 alta dosis (EPA+DHA)', dose: '4-6g', timing: 'Repartido en comidas', priority: 'esencial', note: 'Cardioprotección y antiinflamatorio' },
      { name: 'Vitamina K2 (MK-7)', dose: '200mcg', timing: 'Con vitamina D', priority: 'recomendado' },
      { name: 'Proteína (multiingesta)', dose: '40-50g', timing: 'Cada 3-4h durante el día', priority: 'esencial', note: 'Mayor ventana anabólica, requiere más frecuencia' },
    )
  }

  return base
}

// ─── Zumos vitamínicos naturales ──────────────────────────────────────────────
export type Juice = {
  name: string
  emoji: string
  objective: string
  ingredients: string[]
  benefits: string
  kcal: number
  timing: string
}

export const JUICES: Juice[] = [
  {
    name: 'Verde Energético',
    emoji: '🥬',
    objective: 'Energía y depuración',
    ingredients: ['2 manzanas verdes', '1 pepino', '1 puñado espinacas', '½ limón', '1 trozo jengibre (2cm)'],
    benefits: 'Rico en clorofila, vitaminas K, C y antioxidantes. Alcalinizante.',
    kcal: 95,
    timing: 'Mañana en ayunas o pre-entrenamiento',
  },
  {
    name: 'Rojo Antioxidante',
    emoji: '🥕',
    objective: 'Recuperación y antiinflamatorio',
    ingredients: ['1 remolacha mediana', '3 zanahorias', '2 naranjas', '1 cm cúrcuma fresca', 'pizca pimienta negra'],
    benefits: 'Nitratos (rendimiento), betacaroteno, vitamina C. Reduce inflamación post-entreno.',
    kcal: 130,
    timing: 'Pre-entrenamiento (nitratos) o post-entreno (recuperación)',
  },
  {
    name: 'Electrolitos Post-Entreno',
    emoji: '🍉',
    objective: 'Hidratación y recuperación',
    ingredients: ['400g sandía', '1 limón', '1 naranja', 'pizca sal marina', '1 hoja menta'],
    benefits: 'L-citrulina natural, potasio, sodio. Rehidratación y reducción de agujetas.',
    kcal: 80,
    timing: 'Inmediatamente post-entrenamiento',
  },
  {
    name: 'Piña Antiinflamatoria',
    emoji: '🍍',
    objective: 'Recuperación muscular',
    ingredients: ['200g piña natural', '1 naranja', '1 cm jengibre', '½ cm cúrcuma', 'pizca pimienta'],
    benefits: 'Bromelina (digestión proteínas), vitamina C, antiinflamatorio natural.',
    kcal: 110,
    timing: 'Post-entrenamiento o con cena de recuperación',
  },
  {
    name: 'Termogénico Natural',
    emoji: '🍋',
    objective: 'Quema de grasa y activación metabólica',
    ingredients: ['2 pomelos', '1 limón', '1 trozo jengibre', 'pizca cayena', '1 cucharadita miel (opcional)'],
    benefits: 'Naringenina (moduladora metabólica), capsaicina, vitamina C. Potencia oxidación de grasas.',
    kcal: 65,
    timing: 'Mañana 30 min antes del cardio en ayunas',
  },
  {
    name: 'Proteico Verde',
    emoji: '🥦',
    objective: 'Culturismo y masa muscular',
    ingredients: ['200g espinacas', '1 manzana', '2 tallos apio', '½ limón', '½ aguacate'],
    benefits: 'Hierro, magnesio, vitamina K, grasas saludables. Base alcalina para días de carga.',
    kcal: 145,
    timing: 'Con el desayuno en días de entrenamiento',
  },
  {
    name: 'Granada y Cereza (Testosterona Natural)',
    emoji: '🍒',
    objective: 'Optimización hormonal natural',
    ingredients: ['100g granada en grano', '150g cerezas (o congeladas)', '1 naranja', '½ limón'],
    benefits: 'Estudios muestran que la granada aumenta testosterona libre hasta un 24%. Cerezas reducen cortisol.',
    kcal: 120,
    timing: 'Mañana o pre-entrenamiento (natural comp/TRT)',
  },
  {
    name: 'Hígado Protector',
    emoji: '🌿',
    objective: 'Protección hepática (enhanced)',
    ingredients: ['200g brócoli', '1 manzana verde', '½ limón', '1 diente ajo', '1 trozo jengibre'],
    benefits: 'Sulforafano (brócoli), glutatión precursor, detoxificante hepático. Ideal en ciclos.',
    kcal: 75,
    timing: 'Mañana durante ciclos anabólicos',
  },
  {
    name: 'Tropical Vitamínico',
    emoji: '🥭',
    objective: 'Vitaminas y minerales (todos los objetivos)',
    ingredients: ['150g mango', '1 kiwi', '150g piña', '1 naranja', 'unas hojas hierbabuena'],
    benefits: 'Vitaminas A, C, K1, folato, manganeso. Prebiótico natural.',
    kcal: 140,
    timing: 'Desayuno o merienda',
  },
  {
    name: 'Remolacha del Atleta',
    emoji: '🫀',
    objective: 'Rendimiento cardiovascular',
    ingredients: ['2 remolachas medianas', '2 manzanas', '1 naranja', '1 cm jengibre', '½ limón'],
    benefits: 'Nitratos → óxido nítrico → mejor flujo sanguíneo. Mejora VO2max y resistencia.',
    kcal: 115,
    timing: '2-3h antes de competición o entrenamiento intenso',
  },
]

// ─── Plan semanal tipo (cocina andaluza/española) ─────────────────────────────
export type MealPlan = { breakfast: string; lunch: string; dinner: string; snack: string }
export type WeekPlan = Record<string, MealPlan>

export function generateWeeklyPlan(goal: string, category: BuildingCategory): WeekPlan {
  const highProteinFish = [
    { lunch: 'Merluza al vapor (200g) + arroz integral (150g) + ensalada mixta', cals: 420 },
    { lunch: 'Dorada al horno con verduras + patata cocida (150g)', cals: 430 },
    { lunch: 'Atún fresco a la plancha (150g) + pasta integral (150g) + tomate', cals: 480 },
    { lunch: 'Salmón a la plancha (150g) + boniato al horno + brócoli al vapor', cals: 510 },
    { lunch: 'Lubina a la sal (200g) + arroz blanco + pimiento rojo asado', cals: 420 },
    { lunch: 'Pez espada a la plancha (180g) + lentejas estofadas', cals: 440 },
    { lunch: 'Cazón en adobo (150g) + garbanzos cocidos + ensalada', cals: 460 },
  ]

  const highProteinDinners = [
    'Gambas a la plancha (150g) + brócoli al vapor + tortilla de claras',
    'Caballa a la plancha + espinacas rehogadas + huevo a la plancha',
    'Berberechos al vapor + ensalada mixta + queso fresco',
    'Calamares a la plancha + verduras asadas',
    'Sardinas a la plancha + pimiento rojo + aguacate (½)',
    'Boquerones en vinagre + ensalada de tomate + pan de pueblo',
    'Pechuga de pavo a la plancha + berenjenas al horno',
  ]

  const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
  const plan: WeekPlan = {}

  const breakfasts = [
    'Avena (60g) con leche desnatada + fresas (150g) + café solo',
    'Tortilla de 3 claras + 1 huevo entero + pan masa madre (60g) + naranja',
    'Yogur griego 0% (200g) + plátano + almendras (20g)',
    'Avena (60g) + proteína whey (25g) + kiwi + café',
    'Salmorejo cordobés (200g) + jamón serrano (50g) + huevo duro',
    'Tostadas pan de pueblo + atún en agua + tomate + AOVE',
    'Claras de huevo revueltas (6u) + aguacate (½) + café',
  ]

  const snacks = [
    'Yogur griego 0% (150g) + nueces (20g)',
    'Plátano + proteína whey (25g)',
    'Queso fresco Burgos (80g) + fresas',
    'Almendras (30g) + manzana',
    'Claras de huevo pasteurizadas (150ml) + naranja',
    'Proteína whey (25g) + plátano',
    'Yogur griego + higos frescos (2u)',
  ]

  for (let i = 0; i < 7; i++) {
    plan[days[i]] = {
      breakfast: breakfasts[i],
      lunch: highProteinFish[i].lunch,
      dinner: highProteinDinners[i],
      snack: snacks[i],
    }
  }

  // Adjust for goal
  if (goal === 'gain' || category === 'enhanced_comp') {
    // Add more carbs at lunch and add mass breakfast
    for (const day of days) {
      plan[day].lunch += ' + pan de pueblo (60g)'
      plan[day].snack = snacks[days.indexOf(day)] + ' + proteína whey (25g)'
    }
  }

  return plan
}

// ─── Ideal weight ranges (Devine formula) ────────────────────────────────────
export function idealWeightRange(heightCm: number, sex: Sex): { min: number; max: number } {
  const h = heightCm / 100
  // Hamwi method
  const base = sex === 'M' ? 48 + 2.7 * ((heightCm - 152.4) / 2.54) : 45.5 + 2.2 * ((heightCm - 152.4) / 2.54)
  return { min: Math.round(base * 0.9), max: Math.round(base * 1.1) }
}
