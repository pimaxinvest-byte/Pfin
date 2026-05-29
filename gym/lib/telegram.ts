import { prisma } from './prisma'

interface TelegramMessage {
  chatId: string
  text: string
}

async function getBotToken(): Promise<string | null> {
  const settings = await prisma.appSettings.findFirst()
  return settings?.telegramBotToken ?? process.env.TELEGRAM_BOT_TOKEN ?? null
}

async function sendTelegramMessage({ chatId, text }: TelegramMessage): Promise<boolean> {
  const token = await getBotToken()
  if (!token || !chatId) return false

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

interface BookingNotificationData {
  bookingId: string
  teacherName: string
  teacherChatId?: string | null
  clientName?: string | null
  clientChatId?: string | null
  activityName: string
  spaceName: string
  startDatetime: Date
  endDatetime: Date
  status: string
  notes?: string | null
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function buildBookingMessage(action: string, data: BookingNotificationData): string {
  const lines = [
    `📅 <b>${action}</b>`,
    ``,
    `👨‍🏫 <b>Profesor:</b> ${data.teacherName}`,
    data.clientName ? `👤 <b>Cliente:</b> ${data.clientName}` : '',
    `🏋️ <b>Actividad:</b> ${data.activityName}`,
    `📍 <b>Espacio:</b> ${data.spaceName}`,
    `🗓 <b>Día:</b> ${formatDateTime(data.startDatetime)}`,
    `⏰ <b>Hora:</b> ${formatTime(data.startDatetime)} - ${formatTime(data.endDatetime)}`,
    data.notes ? `📝 <b>Notas:</b> ${data.notes}` : '',
    ``,
    `🔖 <b>Ref:</b> #${data.bookingId.slice(-8).toUpperCase()}`,
  ]
    .filter(Boolean)
    .join('\n')
  return lines
}

async function logNotification(
  bookingId: string,
  recipient: string,
  type: string,
  status: string,
  message: string
) {
  await prisma.notificationLog.create({
    data: { bookingId, recipient, type, status, message },
  })
}

export async function notifyBookingCreated(data: BookingNotificationData) {
  const settings = await prisma.appSettings.findFirst()
  const message = buildBookingMessage('Nueva Reserva Confirmada ✅', data)

  const promises: Promise<void>[] = []

  if (data.teacherChatId) {
    promises.push(
      sendTelegramMessage({ chatId: data.teacherChatId, text: message }).then((ok) =>
        logNotification(data.bookingId, 'teacher', 'booking_created', ok ? 'sent' : 'failed', message)
      )
    )
  }

  if (data.clientChatId) {
    promises.push(
      sendTelegramMessage({ chatId: data.clientChatId, text: message }).then((ok) =>
        logNotification(data.bookingId, 'client', 'booking_created', ok ? 'sent' : 'failed', message)
      )
    )
  }

  const adminChatId = settings?.telegramAdminChatId ?? process.env.TELEGRAM_ADMIN_CHAT_ID
  if (settings?.telegramNotifyAdmin && adminChatId) {
    promises.push(
      sendTelegramMessage({ chatId: adminChatId, text: message }).then((ok) =>
        logNotification(data.bookingId, 'admin', 'booking_created', ok ? 'sent' : 'failed', message)
      )
    )
  }

  await Promise.allSettled(promises)
}

export async function notifyBookingCancelled(data: BookingNotificationData) {
  const settings = await prisma.appSettings.findFirst()
  const message = buildBookingMessage('Reserva Cancelada ❌', data)

  const promises: Promise<void>[] = []

  if (data.teacherChatId) {
    promises.push(
      sendTelegramMessage({ chatId: data.teacherChatId, text: message }).then((ok) =>
        logNotification(data.bookingId, 'teacher', 'booking_cancelled', ok ? 'sent' : 'failed', message)
      )
    )
  }

  if (data.clientChatId) {
    promises.push(
      sendTelegramMessage({ chatId: data.clientChatId, text: message }).then((ok) =>
        logNotification(data.bookingId, 'client', 'booking_cancelled', ok ? 'sent' : 'failed', message)
      )
    )
  }

  const adminChatId = settings?.telegramAdminChatId ?? process.env.TELEGRAM_ADMIN_CHAT_ID
  if (settings?.telegramNotifyAdmin && adminChatId) {
    promises.push(
      sendTelegramMessage({ chatId: adminChatId, text: message }).then((ok) =>
        logNotification(data.bookingId, 'admin', 'booking_cancelled', ok ? 'sent' : 'failed', message)
      )
    )
  }

  await Promise.allSettled(promises)
}

export async function notifyBookingModified(data: BookingNotificationData) {
  const settings = await prisma.appSettings.findFirst()
  const message = buildBookingMessage('Reserva Modificada ✏️', data)

  const promises: Promise<void>[] = []

  if (data.teacherChatId) {
    promises.push(
      sendTelegramMessage({ chatId: data.teacherChatId, text: message }).then((ok) =>
        logNotification(data.bookingId, 'teacher', 'booking_modified', ok ? 'sent' : 'failed', message)
      )
    )
  }

  if (data.clientChatId) {
    promises.push(
      sendTelegramMessage({ chatId: data.clientChatId, text: message }).then((ok) =>
        logNotification(data.bookingId, 'client', 'booking_modified', ok ? 'sent' : 'failed', message)
      )
    )
  }

  const adminChatId = settings?.telegramAdminChatId ?? process.env.TELEGRAM_ADMIN_CHAT_ID
  if (settings?.telegramNotifyAdmin && adminChatId) {
    promises.push(
      sendTelegramMessage({ chatId: adminChatId, text: message }).then((ok) =>
        logNotification(data.bookingId, 'admin', 'booking_modified', ok ? 'sent' : 'failed', message)
      )
    )
  }

  await Promise.allSettled(promises)
}

export async function notifyRecurringCreated(
  teacherChatId: string | null | undefined,
  count: number,
  activityName: string,
  startDate: Date,
  endDate: Date
) {
  const settings = await prisma.appSettings.findFirst()
  const message = [
    `🔁 <b>Reservas Recurrentes Creadas ✅</b>`,
    ``,
    `🏋️ <b>Actividad:</b> ${activityName}`,
    `📆 <b>Del:</b> ${formatDateTime(startDate)}`,
    `📆 <b>Al:</b> ${formatDateTime(endDate)}`,
    `✅ <b>Total creadas:</b> ${count} reservas`,
  ].join('\n')

  const promises: Promise<boolean>[] = []

  if (teacherChatId) promises.push(sendTelegramMessage({ chatId: teacherChatId, text: message }))

  const adminChatId = settings?.telegramAdminChatId ?? process.env.TELEGRAM_ADMIN_CHAT_ID
  if (settings?.telegramNotifyAdmin && adminChatId) {
    promises.push(sendTelegramMessage({ chatId: adminChatId, text: message }))
  }

  await Promise.allSettled(promises)
}
