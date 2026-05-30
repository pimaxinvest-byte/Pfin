import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

function sanitize(settings: any) {
  const { telegramBotToken, ...safe } = settings
  // Mask token: show only that it's set, never expose the actual value
  return { ...safe, telegramBotTokenSet: !!telegramBotToken }
}

export async function GET(req: Request) {
  const session = await getSession()
  let settings = await prisma.appSettings.findFirst()
  if (!settings) {
    settings = await prisma.appSettings.create({
      data: {
        gymName: 'Mi Gimnasio',
        primaryColor: '#0ea5e9',
        secondaryColor: '#10b981',
        telegramNotifyAdmin: true,
      },
    })
  }
  // Only admin sees the full object (still masked token); others get safe subset
  if (session?.user.role === 'admin') {
    return NextResponse.json(sanitize(settings))
  }
  const { telegramBotToken, telegramAdminChatId, ...publicSettings } = settings as any
  return NextResponse.json(publicSettings)
}

export async function PATCH(req: Request) {
  const session = await getSession()
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const data = await req.json()
  let settings = await prisma.appSettings.findFirst()

  if (settings) {
    settings = await prisma.appSettings.update({ where: { id: settings.id }, data })
  } else {
    settings = await prisma.appSettings.create({ data })
  }

  return NextResponse.json(sanitize(settings))
}
