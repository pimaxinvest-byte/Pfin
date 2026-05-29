import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: string
      telegramChatId: string | null
      teacherColor: string | null
    }
  }
  interface User {
    id: string
    role: string
    telegramChatId: string | null
    teacherColor: string | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: string
    telegramChatId: string | null
    teacherColor: string | null
  }
}
