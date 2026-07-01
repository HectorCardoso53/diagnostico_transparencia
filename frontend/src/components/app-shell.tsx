'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import {
  Building2, FolderOpen, LayoutDashboard, LogOut,
  ScrollText, Settings, Users, BarChart2,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

const adminNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/secretarias', label: 'Secretarias', icon: Building2 },
  { href: '/diretorias', label: 'Diretorias', icon: FolderOpen },
  { href: '/usuarios', label: 'Usuários', icon: Users },
  { href: '/formularios', label: 'Formulários', icon: ScrollText },
  { href: '/respostas', label: 'Respostas', icon: Settings },
  { href: '/pesquisas', label: 'Pesquisas de Opinião', icon: BarChart2 },
]

const secretarioNav = [
  { href: '/formularios', label: 'Meus Formulários', icon: ScrollText },
]

const diretorNav = [
  { href: '/formularios', label: 'Meus Formulários', icon: ScrollText },
]

const RESPONDER_ROLES = ['SECRETARIO', 'DIRETOR', 'OPERADOR']

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading, logout } = useAuth()

  const isResponder = RESPONDER_ROLES.includes(user?.role ?? '')
  const isDiretor   = user?.role === 'DIRETOR' || user?.role === 'OPERADOR'

  const navItems = user?.role === 'SECRETARIO'
    ? secretarioNav
    : isDiretor
      ? diretorNav
      : adminNav

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login')
      return
    }
    if (isResponder && pathname !== '/formularios' && !pathname.startsWith('/respostas')) {
      router.replace('/formularios')
    }
  }, [loading, user, isResponder, pathname, router])

  if (loading || !user) return null

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col bg-[#1a3a5c] text-white shadow-lg">

        {/* Cabeçalho — igual ao bloco de logo do login */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-[#22496e]">
          <img
            src="/img/prefeitura.png"
            alt="Logo da Prefeitura"
            width={44}
            height={44}
            className="rounded shrink-0"
          />
          <div className="overflow-hidden">
            <p className="font-bold text-white text-sm leading-tight truncate">Prefeitura Municipal</p>
            <p className="text-[#7eb3e8] font-medium text-xs truncate">Sistema de Diagnóstico</p>
          </div>
        </div>

        {/* Navegação */}
        <nav className="flex-1 overflow-y-auto p-2 mt-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors mb-0.5',
                pathname.startsWith(href)
                  ? 'bg-white text-[#1a3a5c] font-semibold shadow-sm'
                  : 'text-slate-300 hover:bg-[#22496e]',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Usuário */}
        <div className="border-t border-[#22496e] p-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#1a3a5c] text-xs font-bold shrink-0">
            {user?.nome?.charAt(0).toUpperCase() ?? 'U'}
          </div>
          <div className="flex flex-col text-xs overflow-hidden flex-1 min-w-0">
            <span className="font-semibold truncate text-white">{user?.nome}</span>
            <span className="text-[#7eb3e8] truncate">{user?.role}</span>
          </div>
          <button
            onClick={logout}
            title="Sair"
            className="shrink-0 p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-[#22496e] transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  )
}
