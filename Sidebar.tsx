// ============================================================
//  apps/frontend/components/layout/Sidebar.tsx
//  Navigation mit Sprocket-Rail-Signature (Filmrollen-Lochstreifen)
// ============================================================

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, BookOpen, Clapperboard,
  History, Settings, Film,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/characters', label: 'Charaktere', icon: Users },
  { href: '/stories/new', label: 'Story Creator', icon: BookOpen },
  { href: '/create', label: 'Video Creator', icon: Clapperboard },
  { href: '/history', label: 'Verlauf', icon: History },
  { href: '/settings', label: 'Einstellungen', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="flex h-screen sticky top-0">
      {/* Hauptbereich der Sidebar */}
      <aside className="w-sidebar bg-bg-elevated border-r border-border flex flex-col">
        {/* Logo */}
        <div className="h-topbar flex items-center gap-2.5 px-5 border-b border-border">
          <div className="w-8 h-8 rounded-md bg-accent-soft border border-accent/30 flex items-center justify-center">
            <Film size={16} className="text-accent" />
          </div>
          <span className="font-display font-semibold text-[15px] text-text tracking-tight">
            Character Studio
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href))
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-[13px] font-medium transition-colors ${
                  isActive
                    ? 'bg-accent-soft text-accent'
                    : 'text-text-muted hover:text-text hover:bg-surface'
                }`}
              >
                <Icon size={17} strokeWidth={2} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Footer: GPU-Status Kurzanzeige */}
        <div className="px-3 py-4 border-t border-border">
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-surface text-[11px] text-text-faint">
            <span className="status-dot-live" />
            <span className="font-mono">RTX 4090 · 18.2GB frei</span>
          </div>
        </div>
      </aside>

      {/* Signature-Element: Filmrollen-Lochstreifen-Leiste */}
      <div className="sprocket-rail" aria-hidden="true" />
    </div>
  )
}
