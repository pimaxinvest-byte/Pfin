function bar(val: number, goal: number) {
  return Math.min(100, (val / Math.max(goal, 1)) * 100)
}

function fmt(n: number) {
  return Math.round(n)
}

type Macros = { protein: number; carbs: number; fat: number; fiber: number }
type Goals = { proteinG: number; carbsG: number; fatG: number; fiberG: number }

export default function MacroBars({ macros, goals }: { macros: Macros; goals: Goals }) {
  const items = [
    { label: 'Prot', val: macros.protein, goal: goals.proteinG, unit: 'g', cls: 'fill-protein' },
    { label: 'HC', val: macros.carbs, goal: goals.carbsG, unit: 'g', cls: 'fill-carbs' },
    { label: 'Grasa', val: macros.fat, goal: goals.fatG, unit: 'g', cls: 'fill-fat' },
    { label: 'Fibra', val: macros.fiber, goal: goals.fiberG, unit: 'g', cls: 'fill-fiber' },
  ]

  return (
    <div className="macro-row">
      {items.map((item) => (
        <div key={item.label} className="macro-item">
          <div className="macro-label">
            <span>{item.label}</span>
            <span>{fmt(item.val)}/{fmt(item.goal)}{item.unit}</span>
          </div>
          <div className="macro-bar">
            <div
              className={`macro-fill ${item.cls}`}
              style={{ width: `${bar(item.val, item.goal)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
