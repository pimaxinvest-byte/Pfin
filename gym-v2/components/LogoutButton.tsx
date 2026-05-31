'use client'

export function LogoutButton() {
  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <button className="button secondary" onClick={logout}>
      Salir
    </button>
  )
}
