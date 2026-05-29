'use client'

import { useEffect, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fade-in">
      {/* backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* sheet */}
      <div className={cn(
        'relative w-full max-w-lg animate-slide-up',
        'bg-white rounded-t-[28px] sm:rounded-[28px]',
        'max-h-[92dvh] overflow-y-auto',
        className
      )}
        style={{ boxShadow: '0 -8px 40px rgba(0,0,0,0.18)' }}
      >
        {/* drag handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* header */}
        <div className="sticky top-0 bg-white/90 backdrop-blur-sm px-6 pt-4 pb-3 flex items-center justify-between z-10 border-b border-[var(--border)]">
          {title && <h3 className="text-base font-bold text-[var(--ink)]">{title}</h3>}
          <button
            onClick={onClose}
            className="ml-auto w-8 h-8 flex items-center justify-center rounded-full text-sm transition-colors"
            style={{ background: 'var(--surface-2)', color: 'var(--ink-2)' }}
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5 pb-8">{children}</div>
      </div>
    </div>
  )
}
