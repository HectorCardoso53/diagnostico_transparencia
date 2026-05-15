'use client'

import { useEffect, useState } from 'react'
import { Building2, FolderOpen, ScrollText, Users } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Stats {
  secretarias: number
  diretorias: number
  usuarios: number
  formularios: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ secretarias: 0, diretorias: 0, usuarios: 0, formularios: 0 })

  useEffect(() => {
    Promise.all([
      api.get<unknown[]>('/secretarias'),
      api.get<unknown[]>('/diretorias'),
      api.get<unknown[]>('/usuarios'),
      api.get<unknown[]>('/formularios'),
    ]).then(([s, d, u, f]) =>
      setStats({ secretarias: s.length, diretorias: d.length, usuarios: u.length, formularios: f.length }),
    ).catch(() => {})
  }, [])

  const cards = [
    { label: 'Secretarias', value: stats.secretarias, icon: Building2, href: '/secretarias' },
    { label: 'Diretorias', value: stats.diretorias, icon: FolderOpen, href: '/diretorias' },
    { label: 'Usuários', value: stats.usuarios, icon: Users, href: '/usuarios' },
    { label: 'Formulários', value: stats.formularios, icon: ScrollText, href: '/formularios' },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral do sistema</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
