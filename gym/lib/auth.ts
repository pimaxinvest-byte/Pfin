import { NextAuthOptions, getServerSession } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { teacherProfile: true },
        })

        if (!user || !user.isActive) return null

        const valid = await bcrypt.compare(credentials.password, user.password)
        if (!valid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          telegramChatId: user.telegramChatId,
          teacherColor: user.teacherProfile?.color ?? null,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.telegramChatId = (user as any).telegramChatId
        token.teacherColor = (user as any).teacherColor
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.telegramChatId = token.telegramChatId as string | null
        session.user.teacherColor = token.teacherColor as string | null
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
}

export const getSession = () => getServerSession(authOptions)

export async function requireAuth(allowedRoles?: string[]) {
  const session = await getSession()
  if (!session?.user) {
    throw new Error('Unauthorized')
  }
  if (allowedRoles && !allowedRoles.includes(session.user.role)) {
    throw new Error('Forbidden')
  }
  return session
}
