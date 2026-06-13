import { NextRequest, NextResponse } from 'next/server'

const FDA_KEY = process.env.FDA_API_KEY ?? 'DEMO_KEY'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? ''
  if (!q || q.length < 3) return NextResponse.json({ recalls: [], events: [] })

  try {
    const term = encodeURIComponent(q)

    const [recallRes, eventRes] = await Promise.all([
      fetch(
        `https://api.fda.gov/food/enforcement.json?api_key=${FDA_KEY}&search=product_description:${term}&limit=5&sort=report_date:desc`,
        { next: { revalidate: 3600 } }
      ),
      fetch(
        `https://api.fda.gov/food/event.json?api_key=${FDA_KEY}&search=products.name_brand:${term}&limit=5`,
        { next: { revalidate: 3600 } }
      ),
    ])

    const recalls = recallRes.ok ? (await recallRes.json()).results ?? [] : []
    const events = eventRes.ok ? (await eventRes.json()).results ?? [] : []

    return NextResponse.json({
      recalls: recalls.map((r: Record<string, string>) => ({
        number: r.recall_number,
        reason: r.reason_for_recall,
        classification: r.classification,
        status: r.status,
        date: r.report_date,
        firm: r.recalling_firm,
      })),
      events: events.map((e: Record<string, unknown>) => ({
        reactions: (e.reactions as string[] | undefined)?.slice(0, 3),
        outcomes: e.outcomes,
        date: e.date_created,
      })),
    })
  } catch {
    return NextResponse.json({ recalls: [], events: [] })
  }
}
