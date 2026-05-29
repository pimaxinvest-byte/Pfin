import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const session = await getSession()
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const settings = await prisma.appSettings.findFirst()
  const token    = settings?.telegramBotToken
  const chatId   = (await req.json().catch(() => ({}))).chatId
               || settings?.telegramAdminChatId

  if (!token)  return NextResponse.json({ error: 'No hay token configurado' }, { status: 400 })
  if (!chatId) return NextResponse.json({ error: 'No hay Chat ID configurado' }, { status: 400 })

  const text = [
    `⚡ <b>GymBook — Mensaje de prueba</b>`,
    ``,
    `✅ La integración con Telegram está funcionando correctamente.`,
    ``,
    `📱 <b>${settings?.gymName ?? 'GymBook'}</b>`,
    `🔖 Versión 1.1 · by Pietro`,
  ].join('\n')

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json({ error: data.description ?? 'Error de Telegram' }, { status: 400 })
    }

    await prisma.notificationLog.create({
      data: { recipient: chatId, type: 'test', status: 'sent', message: text },
    })

    return NextResponse.json({ ok: true, chatId, messageId: data.result?.message_id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
