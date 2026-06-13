export type Sex = 'M' | 'F'

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

// ─── Goal-adjusted range ─────────────────────────────────────────────────────
export function goalKcalRange(tdee: number, goal: string): { min: number; max: number } {
  if (goal === 'lose') return { min: tdee - 500, max: tdee - 200 }
  if (goal === 'gain') return { min: tdee + 200, max: tdee + 400 }
  return { min: tdee - 100, max: tdee + 100 }
}

// ─── Macro recommendations (% of kcal) ───────────────────────────────────────
export function macroTargets(kcal: number, leanMassKg: number, goal: string) {
  // Protein: 1.8-2.2 g/kg lean mass
  const proteinG = Math.round(leanMassKg * (goal === 'gain' ? 2.2 : 1.8))
  const proteinKcal = proteinG * 4
  // Fat: 25% of kcal
  const fatG = Math.round((kcal * 0.25) / 9)
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
    const val = 86.010 * Math.log10(waistCm - neckCm) - 70.041 * Math.log10(heightCm) + 36.76
    return Math.max(0, val)
  }
  const hip = hipCm ?? waistCm * 1.1
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

// ─── Ideal weight ranges (Devine formula) ────────────────────────────────────
export function idealWeightRange(heightCm: number, sex: Sex): { min: number; max: number } {
  const h = heightCm / 100
  // Hamwi method
  const base = sex === 'M' ? 48 + 2.7 * ((heightCm - 152.4) / 2.54) : 45.5 + 2.2 * ((heightCm - 152.4) / 2.54)
  return { min: Math.round(base * 0.9), max: Math.round(base * 1.1) }
}
