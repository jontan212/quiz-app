'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import ThemeToggle from '@/app/_components/ThemeToggle'

const NAV_ITEMS = [
  { href: '/',         label: 'Inicio',       icon: '🏠' },
  { href: '/stats',    label: 'Estadísticas',  icon: '📊' },
  { href: '/settings', label: 'Ajustes',       icon: '⚙️' },
  { href: '/admin',    label: 'Admin',         icon: '🔧' },
] as const

export default function Navbar() {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* ── Desktop: fixed top bar ── */}
      <nav className="hidden md:flex fixed top-0 inset-x-0 z-50 h-14 items-center px-6 bg-surface-card border-b border-wire">
        <Link href="/" className="text-sm font-bold text-ink-strong mr-8 shrink-0">
          Quiz App
        </Link>

        <div className="flex items-center gap-0.5 flex-1">
          {NAV_ITEMS.map(({ href, label }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-surface-input text-ink-strong'
                    : 'text-ink-dim hover:text-ink hover:bg-surface-input'
                }`}
              >
                {label}
              </Link>
            )
          })}
        </div>

        <ThemeToggle />
      </nav>

      {/* ── Mobile: fixed bottom bar ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 h-16 flex bg-surface-card border-t border-wire">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                active ? 'text-blue-500' : 'text-ink-dim'
              }`}
            >
              {active && (
                <span className="absolute top-0 inset-x-4 h-0.5 bg-blue-500 rounded-full" />
              )}
              <span className="text-xl leading-none">{icon}</span>
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
