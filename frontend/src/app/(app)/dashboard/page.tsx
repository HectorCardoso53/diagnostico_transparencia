'use client'

import { useEffect, useState } from 'react'
import {
  Building2, FolderOpen, ScrollText, Users,
  Clock, FileText, LayoutDashboard,
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RespostaItem { id: string; status: string; created_at: string }
interface FormularioItem { id: string; status: string; created_at: string }

interface Stats {
  secretarias: number | null
  diretorias: number | null
  usuarios: number | null
  formularios: number | null
  respostas: number | null
  respondidos: number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

const YEAR_COLORS = ['#0f1b2d','#2563eb','#16a34a','#dc2626','#9333ea','#ea580c']

const STATUS_CORES: Record<string, string> = {
  RASCUNHO:   '#94a3b8',
  ENVIADO:    '#2563eb',
  EM_REVISAO: '#f59e0b',
  APROVADO:   '#16a34a',
  REPROVADO:  '#dc2626',
}

const STATUS_LABEL: Record<string, string> = {
  RASCUNHO: 'Rascunho', ENVIADO: 'Enviado',
  EM_REVISAO: 'Em revisão', APROVADO: 'Aprovado', REPROVADO: 'Reprovado',
}

const FORM_STATUS_CORES: Record<string, string> = {
  RASCUNHO: '#94a3b8', PUBLICADO: '#16a34a', ARQUIVADO: '#dc2626',
}

function buildLinhaAnual(respostas: RespostaItem[]) {
  const anos = new Set<number>()
  const mapa: Record<string, Record<number, number>> = {}

  for (let m = 0; m < 12; m++) {
    mapa[MESES[m]] = {}
  }

  respostas.forEach((r) => {
    const d = new Date(r.created_at)
    const ano = d.getFullYear()
    const mes = MESES[d.getMonth()]
    anos.add(ano)
    mapa[mes][ano] = (mapa[mes][ano] ?? 0) + 1
  })

  return {
    anos: Array.from(anos).sort(),
    data: MESES.map((m) => ({ mes: m, ...mapa[m] })),
  }
}

function buildPieRespostas(respostas: RespostaItem[]) {
  const contagem: Record<string, number> = {}
  respostas.forEach((r) => { contagem[r.status] = (contagem[r.status] ?? 0) + 1 })
  return Object.entries(contagem).map(([status, value]) => ({
    name: STATUS_LABEL[status] ?? status,
    value,
    cor: STATUS_CORES[status] ?? '#94a3b8',
  }))
}

function buildBarFormularios(formularios: FormularioItem[]) {
  const contagem: Record<string, number> = { RASCUNHO: 0, PUBLICADO: 0, ARQUIVADO: 0 }
  formularios.forEach((f) => { contagem[f.status] = (contagem[f.status] ?? 0) + 1 })
  return Object.entries(contagem).map(([status, total]) => ({
    status: STATUS_LABEL[status] ?? status,
    total,
    cor: FORM_STATUS_CORES[status] ?? '#94a3b8',
  }))
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<Stats>({
    secretarias: null, diretorias: null,
    usuarios: null, formularios: null,
    respostas: null, respondidos: null,
  })
  const [respostas, setRespostas] = useState<RespostaItem[]>([])
  const [formularios, setFormularios] = useState<FormularioItem[]>([])

  useEffect(() => {
    api.get<{ id: string }[]>('/secretarias?ativo=true')
      .then((d) => setStats((s) => ({ ...s, secretarias: d.length }))).catch(() => {})

    api.get<{ id: string }[]>('/diretorias?ativo=true')
      .then((d) => setStats((s) => ({ ...s, diretorias: d.length }))).catch(() => {})

    if (['SUPER_ADMIN', 'ADMIN', 'SECRETARIO'].includes(user?.role ?? ''))
      api.get<{ id: string }[]>('/usuarios?ativo=true')
        .then((d) => setStats((s) => ({ ...s, usuarios: d.length }))).catch(() => {})

    api.get<FormularioItem[]>('/formularios')
      .then((d) => {
        setFormularios(d)
        setStats((s) => ({ ...s, formularios: d.length }))
      }).catch(() => {})

    api.get<RespostaItem[]>('/respostas')
      .then((d) => {
        setRespostas(d)
        setStats((s) => ({
          ...s,
          respostas: d.length,
          respondidos: d.filter((r) => r.status !== 'RASCUNHO').length,
        }))
      }).catch(() => {})
  }, [user])

  const { anos, data: linhaData } = buildLinhaAnual(respostas)
  const pieData = buildPieRespostas(respostas)
  const barData = buildBarFormularios(formularios)

  const statCards = [
    { label: 'Secretarias',            value: stats.secretarias,  icon: Building2,        color: 'text-[#0f1b2d]' },
    { label: 'Diretorias',             value: stats.diretorias,   icon: FolderOpen,        color: 'text-[#0f1b2d]' },
    { label: 'Usuários',               value: stats.usuarios,     icon: Users,             color: 'text-[#0f1b2d]' },
    { label: 'Formulários',            value: stats.formularios,  icon: ScrollText,        color: 'text-[#0f1b2d]' },
    { label: 'Total respostas',        value: stats.respostas,    icon: FileText,          color: 'text-blue-600' },
    { label: 'Formulários respondidos', value: stats.respondidos, icon: Clock,             color: 'text-yellow-600' },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral e histórico do sistema</p>
      </div>

      {/* ── Cards de resumo ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className={`h-4 w-4 ${color}`} />
            </CardHeader>
            <CardContent>
              {value === null ? (
                <div className="h-9 w-12 rounded bg-muted animate-pulse" />
              ) : (
                <div className="text-3xl font-bold">{value}</div>
              )}
            </CardContent>
          </Card>
        ))}

        {/* Card futuro — painel de transparência */}
        <Card className="border-dashed opacity-60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Painel de transparência</CardTitle>
            <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-muted-foreground">—</div>
            <p className="text-xs text-muted-foreground mt-1">Em desenvolvimento</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Linha + Pie ── */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* Gráfico de linhas: respostas por mês, separado por ano */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Respostas por mês</CardTitle>
            <p className="text-xs text-muted-foreground">Cada linha representa um ano — comparativo entre períodos</p>
          </CardHeader>
          <CardContent>
            {respostas.length === 0 ? (
              <div className="flex items-center justify-center h-56 text-sm text-muted-foreground">
                Nenhuma resposta registrada ainda
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={linhaData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  {anos.map((ano, i) => (
                    <Line
                      key={ano}
                      type="monotone"
                      dataKey={String(ano)}
                      name={String(ano)}
                      stroke={YEAR_COLORS[i % YEAR_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Pie: status das respostas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status das respostas</CardTitle>
            <p className="text-xs text-muted-foreground">Distribuição atual</p>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="flex items-center justify-center h-56 text-sm text-muted-foreground">
                Sem dados
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="45%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.cor} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend iconType="circle" iconSize={10} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Bar: formulários por status ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Formulários por status</CardTitle>
          <p className="text-xs text-muted-foreground">Visão geral do ciclo de vida dos formulários</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="status" tick={{ fontSize: 13 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="total" name="Formulários" radius={[4, 4, 0, 0]}>
                {barData.map((entry, i) => (
                  <Cell key={i} fill={entry.cor} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
