'use client'

import { useFormStatus } from 'react-dom'
import type { CSSProperties, ReactNode } from 'react'

export default function SubmitButton({
  children,
  pendingText,
  className = 'btn btn-primary',
  style,
}: {
  children: ReactNode
  pendingText: string
  className?: string
  style?: CSSProperties
}) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className={className} disabled={pending} style={style}>
      {pending ? pendingText : children}
    </button>
  )
}
