import Image from 'next/image'
import { cn } from '@/lib/utils'

interface LogoProps {
  size?: number
  className?: string
  /** show "GymBook" text alongside */
  withText?: boolean
  /** text color */
  textColor?: string
}

export function Logo({ size = 48, className, withText, textColor = 'white' }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        className="rounded-2xl overflow-hidden flex-shrink-0"
        style={{
          width: size,
          height: size,
          boxShadow: '0 4px 20px rgba(204,0,0,0.35), 0 2px 8px rgba(0,0,0,0.4)',
        }}
      >
        <Image
          src="/logo.svg"
          alt="GymBook logo"
          width={size}
          height={size}
          priority
          style={{ width: size, height: size, objectFit: 'cover' }}
        />
      </div>

      {withText && (
        <div>
          <p className="text-xl font-extrabold tracking-tight leading-none" style={{ color: textColor }}>
            GymBook
          </p>
          <p className="text-[11px] font-semibold opacity-60 leading-none mt-0.5" style={{ color: textColor }}>
            by Pietro · v1.1
          </p>
        </div>
      )}
    </div>
  )
}
