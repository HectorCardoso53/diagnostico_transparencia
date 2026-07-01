'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, BarChart2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

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

function buildAggregates(campos: Campo[], respostas: Resposta[]) {
  return campos
    .filter(c => HAS_OPTIONS.includes(c.tipo))
    .map(c => {
      const counts: Record<string, number> = {}
      for (const op of c.opcoes) counts[op] = 0

      for (const r of respostas) {
        const v = r.dados_json[c.id]
        if (!v) continue
        if (Array.isArray(v)) {
          for (const item of v) { if (item in counts) counts[item]++ }
        } else {
          if (v in counts) counts[v]++
        }
      }

      const total = Object.values(counts).reduce((s, n) => s + n, 0)
      return { campo: c, counts, total }
    })
}

export default function ResultadosPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [pesquisa, setPesquisa] = useState<Pesquisa | null>(null)
  const [respostas, setRespostas] = useState<Resposta[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'resumo' | 'individual'>('resumo')

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

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
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
          {pesquisa.descricao && (
            <p className="text-sm text-muted-foreground mt-0.5">{pesquisa.descricao}</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border bg-background p-4 text-center">
          <Users className="h-6 w-6 mx-auto mb-1 text-[#1a3a5c]" />
          <p className="text-2xl font-bold">{respostas.length}</p>
          <p className="text-xs text-muted-foreground">Resposta{respostas.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="rounded-lg border bg-background p-4 text-center">
          <BarChart2 className="h-6 w-6 mx-auto mb-1 text-[#1a3a5c]" />
          <p className="text-2xl font-bold">{campos.length}</p>
          <p className="text-xs text-muted-foreground">Pergunta{campos.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="rounded-lg border bg-background p-4 text-center col-span-2 sm:col-span-1">
          <p className="text-2xl font-bold">{aggregates.length}</p>
          <p className="text-xs text-muted-foreground">Com gráfico</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(['resumo', 'individual'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t
                ? 'border-[#1a3a5c] text-[#1a3a5c]'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'resumo' ? 'Resumo por pergunta' : 'Respostas individuais'}
          </button>
        ))}
      </div>

      {/* Resumo */}
      {tab === 'resumo' && (
        <div className="space-y-6">
          {aggregates.length === 0 && textCampos.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-8">
              Nenhuma pergunta com opções para agregar.
            </p>
          )}

          {aggregates.map(({ campo, counts, total }) => (
            <div key={campo.id} className="rounded-lg border bg-background p-5 space-y-3">
              <p className="font-medium text-sm">{campo.label}</p>
              <p className="text-xs text-muted-foreground">{total} resposta{total !== 1 ? 's' : ''}</p>
              <div className="space-y-2">
                {campo.opcoes.map(op => {
                  const count = counts[op] ?? 0
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0
                  return (
                    <div key={op} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-foreground">{op}</span>
                        <span className="text-muted-foreground font-medium">{count} ({pct}%)</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-[#1a3a5c] rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {textCampos.length > 0 && (
            <div className="rounded-lg border bg-background p-5 space-y-4">
              <p className="font-medium text-sm">Respostas abertas</p>
              {textCampos.map(c => {
                const resps = respostas.map(r => r.dados_json[c.id]).filter(Boolean) as string[]
                return (
                  <div key={c.id} className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{c.label}</p>
                    {resps.length === 0
                      ? <p className="text-xs text-muted-foreground italic">Sem respostas</p>
                      : (
                        <ul className="space-y-1">
                          {resps.map((v, i) => (
                            <li key={i} className="text-xs border-l-2 border-[#1a3a5c]/30 pl-3 py-0.5 text-foreground">
                              {v}
                            </li>
                          ))}
                        </ul>
                      )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Individual */}
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
                        <p className="text-foreground mt-0.5">
                          {Array.isArray(v) ? v.join(', ') : v}
                        </p>
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
