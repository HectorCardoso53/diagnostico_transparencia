'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, MoreHorizontal, Plus, Trash2, Archive, ClipboardList, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Atribuicao {
  diretoria: { id: string; nome: string }
  prazo: string | null
  obrigatorio: boolean
}

interface Resposta {
  id: string
  status: string
  diretoria_id: string
}

interface Formulario {
  id: string
  titulo: string
  descricao: string | null
  status: string
  versao: number
  publicado_em: string | null
  created_at: string
  criador: { nome: string } | null
  secretaria: { nome: string; sigla: string; tipo: 'SECRETARIA' | 'PGM' | 'GABINETE' } | null
  atribuicoes: Atribuicao[]
  respostas: Resposta[]
}

interface Secretaria { id: string; nome: string; tipo: 'SECRETARIA' | 'PGM' | 'GABINETE' }
interface Diretoria  { id: string; nome: string; secretaria_id: string }

const STATUS_LABEL: Record<string, string> = {
  RASCUNHO: 'Rascunho', PUBLICADO: 'Publicado', ARQUIVADO: 'Arquivado',
}
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'destructive'> = {
  RASCUNHO: 'secondary', PUBLICADO: 'success', ARQUIVADO: 'destructive',
}
const RESP_LABEL: Record<string, string> = {
  RASCUNHO: 'Rascunho', ENVIADO: 'Enviado', EM_REVISAO: 'Em revisão',
  APROVADO: 'Aprovado', REPROVADO: 'Reprovado',
}
function statusIcon(status: string) {
  if (status === 'APROVADO') return <CheckCircle2 className="h-4 w-4 text-green-500" />
  if (status === 'ENVIADO' || status === 'EM_REVISAO') return <Clock className="h-4 w-4 text-yellow-500" />
  if (status === 'REPROVADO') return <AlertCircle className="h-4 w-4 text-red-500" />
  return <ClipboardList className="h-4 w-4 text-muted-foreground" />
}

/* ── Painel de formulários para secretários ───────────────── */
function PainelSecretario({ items }: { items: Formulario[] }) {
  const router = useRouter()
  const [responding, setResponding] = useState<string | null>(null)

  async function responder(formId: string, diretoriaId: string) {
    const key = `${formId}:${diretoriaId}`
    setResponding(key)
    try {
      const nova = await api.post<{ id: string }>('/respostas', {
        form_id: formId, diretoria_id: diretoriaId, dados_json: {},
      })
      router.push(`/respostas/${nova.id}`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao criar resposta')
      setResponding(null)
    }
  }

  return (
    <div className="space-y-6">
      {items.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Formulários para responder</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {items.map(f => (
              <Card key={f.id} className="border shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold leading-tight">{f.titulo}</CardTitle>
                  {f.descricao && <p className="text-xs text-muted-foreground mt-1">{f.descricao}</p>}
                </CardHeader>
                <CardContent className="space-y-2">
                  {f.atribuicoes.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Nenhuma diretoria atribuída</p>
                  ) : (
                    <div className="divide-y rounded-md border overflow-hidden">
                      {f.atribuicoes.map(({ diretoria, prazo }) => {
                        const resp = f.respostas.find(r => r.diretoria_id === diretoria.id)
                        return (
                          <div key={diretoria.id} className="flex items-center justify-between px-3 py-2 bg-background hover:bg-muted/30 text-sm">
                            <div className="flex items-center gap-2">
                              {statusIcon(resp?.status ?? '')}
                              <span className="font-medium">{diretoria.nome}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {prazo && <span>Prazo: {formatDate(prazo)}</span>}
                              {resp ? (
                                <Link
                                  href={`/respostas/${resp.id}`}
                                  className="flex items-center gap-1.5 hover:opacity-80"
                                >
                                  <Badge variant={STATUS_VARIANT[resp.status] ?? 'secondary'} className="text-[10px] px-1.5 py-0">
                                    {RESP_LABEL[resp.status] ?? resp.status}
                                  </Badge>
                                  <Eye className="h-3 w-3" />
                                </Link>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 text-[11px] px-2"
                                  disabled={responding === `${f.id}:${diretoria.id}`}
                                  onClick={() => responder(f.id, diretoria.id)}
                                >
                                  {responding === `${f.id}:${diretoria.id}` ? '...' : 'Responder'}
                                </Button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Publicado em {f.publicado_em ? formatDate(f.publicado_em) : '—'} · v{f.versao}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {items.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="font-medium">Nenhum formulário publicado para você</p>
          <p className="text-sm mt-1">Aguarde o administrador publicar e atribuir formulários à sua secretaria.</p>
        </div>
      )}
    </div>
  )
}

/* ── Página principal ─────────────────────────────────────── */
export default function FormulariosPage() {
  const { user } = useAuth()
  const [items, setItems]               = useState<Formulario[]>([])
  const [search, setSearch]             = useState('')
  const [open, setOpen]                 = useState(false)
  const [titulo, setTitulo]             = useState('')
  const [descricao, setDescricao]       = useState('')
  const [secretariaId, setSecretariaId] = useState('')
  const [secretarias, setSecretarias]   = useState<Secretaria[]>([])
  const [diretorias, setDiretorias]     = useState<Diretoria[]>([])
  const [diretoriasSel, setDiretoriasSel] = useState<string[]>([])
  const [saving, setSaving]             = useState(false)

  const isAdmin    = user?.role !== 'SECRETARIO'
  const isSecretario = user?.role === 'SECRETARIO'
  const canManage  = isAdmin

  /* carrega formulários */
  const load = useCallback(() => {
    const q = new URLSearchParams()
    if (search) q.set('titulo', search)
    if (isSecretario) {
      q.set('status', 'PUBLICADO')
      if (user?.secretaria_id) q.set('secretaria_id', user.secretaria_id)
    }
    api.get<Formulario[]>(`/formularios?${q}`)
      .then(setItems).catch(() => toast.error('Erro ao carregar formulários'))
  }, [search, isSecretario, user?.secretaria_id])

  useEffect(() => { load() }, [load])

  /* pré-carrega secretarias para admins */
  useEffect(() => {
    if (isAdmin) api.get<Secretaria[]>('/secretarias').then(setSecretarias).catch(() => {})
  }, [isAdmin])

  /* quando secretaria muda, recarrega diretorias */
  useEffect(() => {
    if (!secretariaId) { setDiretorias([]); setDiretoriasSel([]); return }
    api.get<Diretoria[]>(`/diretorias?secretaria_id=${secretariaId}`)
      .then(setDiretorias).catch(() => {})
    setDiretoriasSel([])
  }, [secretariaId])

  function openCreate() {
    setTitulo(''); setDescricao(''); setDiretoriasSel([])
    const sid = user?.secretaria_id ?? ''
    setSecretariaId(sid)
    setOpen(true)
  }

  function toggleDiretoria(id: string) {
    setDiretoriasSel(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function create() {
    const sid = secretariaId || user?.secretaria_id
    if (!sid) { toast.error('Selecione uma secretaria'); return }
    setSaving(true)
    try {
      const novo = await api.post<Formulario>('/formularios', {
        titulo, descricao: descricao || undefined,
        secretaria_id: sid, schema_json: { campos: [] },
      })
      await Promise.all(
        diretoriasSel.map(did =>
          api.post(`/formularios/${novo.id}/atribuicoes`, { diretoria_id: did })
        )
      )
      toast.success('Formulário criado')
      setOpen(false)
      window.location.href = `/formularios/${novo.id}`
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao criar formulário')
    } finally { setSaving(false) }
  }

  async function arquivar(id: string) {
    try { await api.post(`/formularios/${id}/arquivar`, {}); toast.success('Arquivado'); load() }
    catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Erro') }
  }

  async function excluir(f: Formulario) {
    if (!confirm(`Excluir "${f.titulo}"? Todas as respostas associadas também serão removidas.`)) return
    try { await api.delete(`/formularios/${f.id}`); toast.success('Excluído'); load() }
    catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Erro') }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Formulários</h1>
          <p className="text-sm text-muted-foreground mt-1">{items.length} formulário{items.length !== 1 ? 's' : ''}</p>
        </div>
        {canManage && (
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-1" />Novo formulário
          </Button>
        )}
      </div>

      <Input placeholder="Buscar por título..." value={search}
        onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />

      {/* secretário vê painel de cards; admin vê tabela */}
      {isSecretario ? (
        <PainelSecretario items={items} />
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {['Título', 'Órgão', 'Status', 'Versão', 'Criador', 'Publicado em', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((f) => (
                <tr key={f.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{f.titulo}</td>
                  <td className="px-4 py-3">
                    {f.secretaria ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">{f.secretaria.sigla}</span>
                        {f.secretaria.tipo !== 'SECRETARIA' && (
                          <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                            {f.secretaria.tipo}
                          </span>
                        )}
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[f.status] ?? 'secondary'}>{STATUS_LABEL[f.status] ?? f.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">v{f.versao}</td>
                  <td className="px-4 py-3 text-muted-foreground">{f.criador?.nome ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{f.publicado_em ? formatDate(f.publicado_em) : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" asChild>
                        <Link href={`/formularios/${f.id}`}><Eye className="h-3.5 w-3.5" /></Link>
                      </Button>
                      {canManage && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/formularios/${f.id}`}>Editar / Ver</Link>
                            </DropdownMenuItem>
                            {f.status !== 'ARQUIVADO' && (
                              <DropdownMenuItem onClick={() => arquivar(f.id)}>
                                <Archive className="h-3.5 w-3.5 mr-2" />Arquivar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => excluir(f)} className="text-destructive focus:text-destructive">
                              <Trash2 className="h-3.5 w-3.5 mr-2" />Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Nenhum formulário encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* modal criar */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Formulário</DialogTitle>
            <DialogDescription>Defina o título, a secretaria e as diretorias que vão responder.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex: Diagnóstico de TI 2026" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)}
                rows={2} placeholder="Objetivo do formulário..." />
            </div>

            {/* secretaria — só para admins sem secretaria fixa */}
            {isAdmin && !user?.secretaria_id && (
              <div className="space-y-1.5">
                <Label>Órgão responsável *</Label>
                <Select value={secretariaId} onValueChange={setSecretariaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o órgão" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Órgãos superiores: PGM e Gabinete primeiro */}
                    {secretarias.filter(s => s.tipo !== 'SECRETARIA').length > 0 && (
                      <SelectGroup>
                        <SelectLabel className="text-xs font-semibold text-amber-600 uppercase tracking-wide">
                          ★ Órgãos Superiores
                        </SelectLabel>
                        {secretarias
                          .filter(s => s.tipo !== 'SECRETARIA')
                          .map(s => (
                            <SelectItem key={s.id} value={s.id}>
                              <span className="font-medium">{s.nome}</span>
                              <span className="ml-2 text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                {s.tipo}
                              </span>
                            </SelectItem>
                          ))}
                      </SelectGroup>
                    )}
                    {secretarias.filter(s => s.tipo !== 'SECRETARIA').length > 0 &&
                     secretarias.filter(s => s.tipo === 'SECRETARIA').length > 0 && (
                      <SelectSeparator />
                    )}
                    {/* Secretarias */}
                    {secretarias.filter(s => s.tipo === 'SECRETARIA').length > 0 && (
                      <SelectGroup>
                        <SelectLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Secretarias
                        </SelectLabel>
                        {secretarias
                          .filter(s => s.tipo === 'SECRETARIA')
                          .map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                          ))}
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* diretorias — aparecem quando secretaria está definida */}
            {diretorias.length > 0 && (
              <div className="space-y-1.5">
                <Label>Diretorias que vão responder</Label>
                <div className="rounded-md border divide-y max-h-44 overflow-y-auto">
                  {diretorias.map((d) => (
                    <label key={d.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/40">
                      <Checkbox checked={diretoriasSel.includes(d.id)} onCheckedChange={() => toggleDiretoria(d.id)} />
                      <span className="text-sm">{d.nome}</span>
                    </label>
                  ))}
                </div>
                {diretoriasSel.length > 0 && (
                  <p className="text-xs text-muted-foreground">{diretoriasSel.length} selecionada(s)</p>
                )}
              </div>
            )}

            {secretariaId && diretorias.length === 0 && (
              <p className="text-xs text-muted-foreground italic">Nenhuma diretoria cadastrada nesta secretaria.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={create} disabled={saving || !titulo.trim() || (!secretariaId && !user?.secretaria_id)}>
              {saving ? 'Criando...' : 'Criar e editar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
