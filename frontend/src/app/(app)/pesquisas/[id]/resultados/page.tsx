'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Users, MessageSquare, CalendarDays, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid, PieChart, Pie, Legend,
} from 'recharts'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type TipoCampo = 'texto' | 'paragrafo' | 'multipla_escolha' | 'caixa_selecao' | 'lista_suspensa' | 'numero' | 'data' | 'moeda'

interface Campo {
  id: string
  tipo: TipoCampo
  label: string
  obrigatorio: boolean
  opcoes: string[]
}

interface Pesquisa {
  id: string
  titulo: string
  descricao: string | null
  status: 'RASCUNHO' | 'PUBLICADA' | 'ENCERRADA'
  schema_json: { campos?: Campo[] } | null
  publicado_em: string | null
  _count: { respostas: number }
}

interface Resposta {
  id: string
  nome: string
  secretaria: string | null
  diretoria: string | null
  cargo: string | null
  dados_json: Record<string, string | string[]>
  created_at: string
}

const HAS_OPTIONS: TipoCampo[] = ['multipla_escolha', 'caixa_selecao', 'lista_suspensa']

const CHART_COLORS = ['#1a3a5c', '#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#9333ea', '#ea580c', '#0891b2']

function buildAggregates(campos: Campo[], respostas: Resposta[]) {
  return campos
    .filter(c => HAS_OPTIONS.includes(c.tipo))
    .map(c => {
      const counts: Record<string, number> = {}
      for (const op of c.opcoes) counts[op] = 0
      for (const r of respostas) {
        const v = r.dados_json[c.id]
        if (!v) continue
        if (Array.isArray(v)) { for (const item of v) { if (item in counts) counts[item]++ } }
        else { if (v in counts) counts[v]++ }
      }
      const total = Object.values(counts).reduce((s, n) => s + n, 0)
      const data = c.opcoes.map(op => ({ name: op, total: counts[op] ?? 0 }))
      return { campo: c, data, total }
    })
}

function buildTrend(respostas: Resposta[]) {
  const map: Record<string, number> = {}
  for (const r of respostas) {
    const day = r.created_at.slice(0, 10)
    map[day] = (map[day] ?? 0) + 1
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, total]) => ({ data: data.slice(5).replace('-', '/'), total }))
}

function buildBySecretaria(respostas: Resposta[]) {
  const map: Record<string, number> = {}
  for (const r of respostas) {
    const key = r.secretaria?.trim() || 'Não informado'
    map[key] = (map[key] ?? 0) + 1
  }
  return Object.entries(map)
    .sort(([, a], [, b]) => b - a)
    .map(([name, value]) => ({ name: name.length > 18 ? name.slice(0, 18) + '…' : name, value }))
}

export default function ResultadosPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [pesquisa, setPesquisa] = useState<Pesquisa | null>(null)
  const [respostas, setRespostas] = useState<Resposta[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'visao' | 'perguntas' | 'individual'>('visao')

  const load = useCallback(async () => {
    try {
      const [p, r] = await Promise.all([
        api.get<Pesquisa>(`/pesquisas/${id}`),
        api.get<Resposta[]>(`/pesquisas/${id}/resultados`),
      ])
      setPesquisa(p)
      setRespostas(r)
    } catch {
      toast.error('Erro ao carregar resultados')
      router.push('/pesquisas')
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => { load() }, [load])

  if (loading || !pesquisa) {
    return <div className="p-6 text-muted-foreground">Carregando...</div>
  }

  const campos = pesquisa.schema_json?.campos ?? []
  const textCampos = campos.filter(c => !HAS_OPTIONS.includes(c.tipo))
  const aggregates = buildAggregates(campos, respostas)
  const trend = buildTrend(respostas)
  const bySecretaria = buildBySecretaria(respostas)
  const secretariasUnicas = bySecretaria.filter(s => s.name !== 'Não informado').length

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/pesquisas')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold truncate">{pesquisa.titulo}</h1>
            <Badge variant={pesquisa.status === 'PUBLICADA' ? 'success' : pesquisa.status === 'ENCERRADA' ? 'destructive' : 'secondary'}>
              {pesquisa.status === 'PUBLICADA' ? 'Publicada' : pesquisa.status === 'ENCERRADA' ? 'Encerrada' : 'Rascunho'}
            </Badge>
          </div>
          {pesquisa.descricao && <p className="text-sm text-muted-foreground mt-0.5">{pesquisa.descricao}</p>}
        </div>
      </div>

      {/* Cards de métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />Respostas
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-3xl font-bold text-[#1a3a5c]">{respostas.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" />Perguntas
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-3xl font-bold text-[#1a3a5c]">{campos.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" />Secretarias
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-3xl font-bold text-[#1a3a5c]">{secretariasUnicas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />Período
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-sm font-semibold text-[#1a3a5c]">
              {pesquisa.publicado_em ? formatDate(pesquisa.publicado_em) : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {([
          { key: 'visao', label: 'Visão Geral' },
          { key: 'perguntas', label: 'Por Pergunta' },
          { key: 'individual', label: 'Respostas individuais' },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.key
                ? 'border-[#1a3a5c] text-[#1a3a5c]'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Visão Geral ─────────────────────────────────────────────────── */}
      {tab === 'visao' && (
        <div className="space-y-6">
          {respostas.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-12">Nenhuma resposta recebida ainda.</p>
          )}

          {/* Tendência de respostas */}
          {trend.length >= 2 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Respostas ao longo do tempo</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={trend} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v: number) => [v, 'Respostas']} />
                    <Line type="monotone" dataKey="total" stroke="#1a3a5c" strokeWidth={2} dot={{ r: 4, fill: '#1a3a5c' }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Distribuição por secretaria */}
          {bySecretaria.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Respostas por secretaria</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={Math.max(160, bySecretaria.length * 40)}>
                    <BarChart layout="vertical" data={bySecretaria} margin={{ left: 8, right: 48, top: 4, bottom: 4 }}>
                      <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v: number) => [v, 'Respostas']} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {bySecretaria.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {bySecretaria.length >= 2 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Proporção por secretaria</CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center justify-center">
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={bySecretaria}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={75}
                          label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`}
                          labelLine={false}
                          fontSize={10}
                        >
                          {bySecretaria.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v: number) => [v, 'Respostas']} />
                        <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Por Pergunta ─────────────────────────────────────────────────── */}
      {tab === 'perguntas' && (
        <div className="space-y-6">
          {aggregates.length === 0 && textCampos.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-8">Nenhuma pergunta para exibir.</p>
          )}

          {aggregates.map(({ campo, data, total }) => (
            <Card key={campo.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold leading-snug">{campo.label}</CardTitle>
                <p className="text-xs text-muted-foreground">{total} resposta{total !== 1 ? 's' : ''}</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={Math.max(120, data.length * 44)}>
                  <BarChart layout="vertical" data={data} margin={{ left: 8, right: 56, top: 4, bottom: 4 }}>
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ fontSize: 12 }}
                      formatter={(v: number) => [
                        `${v} (${total > 0 ? Math.round((v / total) * 100) : 0}%)`,
                        'Respostas',
                      ]}
                    />
                    <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                      {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ))}

          {textCampos.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Respostas abertas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {textCampos.map(c => {
                  const resps = respostas.map(r => r.dados_json[c.id]).filter(Boolean) as string[]
                  return (
                    <div key={c.id} className="space-y-1.5">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{c.label}</p>
                      {resps.length === 0
                        ? <p className="text-xs text-muted-foreground italic">Sem respostas</p>
                        : (
                          <ul className="space-y-1">
                            {resps.map((v, i) => (
                              <li key={i} className="text-xs border-l-2 border-[#1a3a5c]/30 pl-3 py-0.5 text-foreground">{v}</li>
                            ))}
                          </ul>
                        )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Respostas individuais ─────────────────────────────────────────── */}
      {tab === 'individual' && (
        <div className="space-y-3">
          {respostas.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-8">Nenhuma resposta ainda.</p>
          )}
          {respostas.map((r, idx) => (
            <div key={r.id} className="rounded-lg border bg-background p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm">{r.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {[r.cargo, r.diretoria, r.secretaria].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[11px] text-muted-foreground">#{idx + 1}</span>
                  <p className="text-[11px] text-muted-foreground">{formatDate(r.created_at)}</p>
                </div>
              </div>
              {campos.length > 0 && (
                <div className="border-t pt-3 space-y-2">
                  {campos.map(c => {
                    const v = r.dados_json[c.id]
                    if (!v || (Array.isArray(v) && v.length === 0)) return null
                    return (
                      <div key={c.id} className="text-xs">
                        <p className="text-muted-foreground font-medium">{c.label}</p>
                        <p className="text-foreground mt-0.5">{Array.isArray(v) ? v.join(', ') : v}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
