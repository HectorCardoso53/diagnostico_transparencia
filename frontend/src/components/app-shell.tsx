'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Building2, FolderOpen, LayoutDashboard, LogOut,
  ScrollText, Settings, Users,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/secretarias', label: 'Secretarias', icon: Building2 },
  { href: '/diretorias', label: 'Diretorias', icon: FolderOpen },
  { href: '/usuarios', label: 'Usuários', icon: Users },
  { href: '/formularios', label: 'Formulários', icon: ScrollText },
  { href: '/respostas', label: 'Respostas', icon: Settings },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="flex w-60 flex-col border-r bg-sidebar">
        <div className="flex h-14 items-center border-b border-sidebar-border px-4">
          <span className="font-semibold text-sm">Diagnóstico</span>
          <span className="ml-1 text-xs text-muted-foreground">Transparência</span>
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                pathname.startsWith(href)
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/60',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-3 px-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold shrink-0">
                  {user?.nome?.charAt(0).toUpperCase() ?? 'U'}
                </div>
                <div className="flex flex-col items-start text-xs overflow-hidden">
                  <span className="font-medium truncate w-full">{user?.nome}</span>
                  <span className="text-muted-foreground truncate w-full">{user?.role}</span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  )
}
