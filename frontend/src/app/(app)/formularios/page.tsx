'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Eye, MoreHorizontal, Plus, Trash2, Archive, ClipboardList,
  CheckCircle2, Clock, AlertCircle, ChevronDown, ChevronUp, GripVertical,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  DndContext, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel,
  SelectSeparator, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Campo {
  id?: string
  nome?: string
  label: string
  tipo: string
  obrigatorio?: boolean
  opcoes?: string[]
}

interface Atribuicao {
  diretoria: { id: string; nome: string }
  prazo: string | null
  obrigatorio: boolean
}

interface Resposta {
  id: string
  status: string
  diretoria_id: string | null
  enviado_em: string | null
  usuario: { nome: string } | null
}

interface Formulario {
  id: string
  titulo: string
  descricao: string | null
  schema_json: { campos?: Campo[] } | null
  status: string
  versao: number
  posicao: number
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
const RESP_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'destructive'> = {
  RASCUNHO: 'secondary', ENVIADO: 'default', EM_REVISAO: 'default',
  APROVADO: 'success', REPROVADO: 'destructive',
}
function statusIcon(status: string) {
  if (status === 'APROVADO') return <CheckCircle2 className="h-4 w-4 text-green-500" />
  if (status === 'ENVIADO' || status === 'EM_REVISAO') return <Clock className="h-4 w-4 text-yellow-500" />
  if (status === 'REPROVADO') return <AlertCircle className="h-4 w-4 text-red-500" />
  return <ClipboardList className="h-4 w-4 text-muted-foreground" />
}

const TIPO_LABEL: Record<string, string> = {
  texto: 'Resposta curta', paragrafo: 'Parágrafo', textarea: 'Parágrafo',
  multipla_escolha: 'Múltipla escolha', caixa_selecao: 'Caixas de seleção',
  lista_suspensa: 'Lista suspensa', select: 'Lista suspensa',
  numero: 'Número', data: 'Data', booleano: 'Sim/Não', moeda: 'Valor em R$',
}

/* ── Painel para DIRETOR/OPERADOR ─────────────────────────── */
function PainelDiretor({ items, diretoriaId }: { items: Formulario[]; diretoriaId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  async function abrirFormulario(formId: string, respostaId?: string) {
    if (respostaId) { router.push(`/respostas/${respostaId}`); return }
    setLoading(formId)
    try {
      const nova = await api.post<{ id: string }>('/respostas', {
        form_id: formId, diretoria_id: diretoriaId, dados_json: {},
      })
      router.push(`/respostas/${nova.id}`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao abrir formulário')
      setLoading(null)
    }
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Nenhum formulário disponível</p>
        <p className="text-sm mt-1">Aguarde o administrador atribuir formulários à sua diretoria.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map(f => {
        const resp = f.respostas.find(r => r.diretoria_id === diretoriaId)
        const atrib = f.atribuicoes.find(a => a.diretoria.id === diretoriaId)
        const isLoading = loading === f.id

        const btnLabel = isLoading ? 'Carregando...'
          : !resp           ? 'Abrir formulário'
          : resp.status === 'RASCUNHO'    ? 'Continuar preenchendo'
          : resp.status === 'REPROVADO'   ? 'Ver resposta reprovada'
          : resp.status === 'APROVADO'    ? 'Ver formulário aprovado'
          : 'Ver resposta enviada'

        return (
          <Card key={f.id} className="border shadow-sm flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base font-semibold leading-tight">{f.titulo}</CardTitle>
                {resp && (
                  <Badge variant={RESP_VARIANT[resp.status] ?? 'secondary'} className="shrink-0 text-[11px]">
                    {statusIcon(resp.status)}
                    <span className="ml-1">{RESP_LABEL[resp.status] ?? resp.status}</span>
                  </Badge>
                )}
              </div>
              {f.descricao && <p className="text-xs text-muted-foreground mt-1">{f.descricao}</p>}
            </CardHeader>
            <CardContent className="space-y-3 flex-1 flex flex-col justify-end">
              {atrib?.prazo && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Prazo: {formatDate(atrib.prazo)}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">
                Publicado em {f.publicado_em ? formatDate(f.publicado_em) : '—'} · v{f.versao}
              </p>
              <Button
                className="w-full"
                variant={resp?.status === 'APROVADO' ? 'outline' : 'default'}
                disabled={isLoading}
                onClick={() => abrirFormulario(f.id, resp?.id)}
              >
                {btnLabel}
              </Button>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

/* ── Card de formulário que o secretário preenche diretamente ── */
function CardSecretarioResponde({ f }: { f: Formulario }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const resp = f.respostas.find(r => r.diretoria_id === null)

  async function abrirFormulario() {
    if (resp) { router.push(`/respostas/${resp.id}`); return }
    setLoading(true)
    try {
      const nova = await api.post<{ id: string }>('/respostas', {
        form_id: f.id, dados_json: {},
      })
      router.push(`/respostas/${nova.id}`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao abrir formulário')
      setLoading(false)
    }
  }

  const btnLabel = loading ? 'Carregando...'
    : !resp                       ? 'Preencher formulário'
    : resp.status === 'RASCUNHO'  ? 'Continuar preenchendo'
    : resp.status === 'REPROVADO' ? 'Ver resposta reprovada'
    : resp.status === 'APROVADO'  ? 'Ver formulário aprovado'
    : 'Ver resposta enviada'

  return (
    <Card className="border shadow-sm flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-semibold leading-tight">{f.titulo}</CardTitle>
          {resp ? (
            <Badge variant={RESP_VARIANT[resp.status] ?? 'secondary'} className="shrink-0 text-[11px]">
              {statusIcon(resp.status)}
              <span className="ml-1">{RESP_LABEL[resp.status] ?? resp.status}</span>
            </Badge>
          ) : (
            <Badge variant="secondary" className="shrink-0 text-[11px]">Aguardando resposta</Badge>
          )}
        </div>
        {f.descricao && <p className="text-xs text-muted-foreground mt-1">{f.descricao}</p>}
      </CardHeader>
      <CardContent className="space-y-3 flex-1 flex flex-col justify-end">
        <p className="text-[11px] text-muted-foreground">
          Publicado em {f.publicado_em ? formatDate(f.publicado_em) : '—'} · v{f.versao}
        </p>
        <Button
          className="w-full"
          variant={resp?.status === 'APROVADO' ? 'outline' : 'default'}
          disabled={loading}
          onClick={abrirFormulario}
        >
          {btnLabel}
        </Button>
      </CardContent>
    </Card>
  )
}

/* ── Painel de formulários para secretários ───────────────── */
function PainelSecretario({ items }: { items: Formulario[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const semDiretoria = items.filter(f => f.atribuicoes.length === 0)
  const comDiretoria = items.filter(f => f.atribuicoes.length > 0)

  function toggleExpand(id: string) {
    setExpandedId(prev => prev === id ? null : id)
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Nenhum formulário publicado</p>
        <p className="text-sm mt-1">Nenhum formulário foi publicado para sua secretaria ainda.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Formulários que o secretário responde diretamente */}
      {semDiretoria.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Para preencher</h2>
            <p className="text-xs text-muted-foreground">
              Formulários sem diretoria atribuída são de sua responsabilidade.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {semDiretoria.map(f => <CardSecretarioResponde key={f.id} f={f} />)}
          </div>
        </section>
      )}

      {/* Acompanhamento das diretorias */}
      {comDiretoria.length > 0 && (
        <section className="space-y-3">
          {semDiretoria.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold">Acompanhamento das diretorias</h2>
              <p className="text-xs text-muted-foreground">
                Monitore o status das respostas das diretorias abaixo.
              </p>
            </div>
          )}
          <div className="space-y-4">
            {comDiretoria.map(f => {
              const total      = f.atribuicoes.length
              const aprovadas  = f.respostas.filter(r => r.status === 'APROVADO').length
              const analise    = f.respostas.filter(r => r.status === 'ENVIADO' || r.status === 'EM_REVISAO').length
              const reprovadas = f.respostas.filter(r => r.status === 'REPROVADO').length
              const enviadas   = f.respostas.filter(r => r.status !== 'RASCUNHO').length
              const aguardando = total - enviadas - aprovadas

              return (
                <Card key={f.id} className="border shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base font-semibold">{f.titulo}</CardTitle>
                        {f.descricao && <p className="text-xs text-muted-foreground mt-1">{f.descricao}</p>}
                      </div>
                      <p className="text-xs text-muted-foreground shrink-0">
                        Publicado em {f.publicado_em ? formatDate(f.publicado_em) : '—'}
                      </p>
                    </div>

                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{enviadas}/{total} diretorias responderam</span>
                        <button
                          onClick={() => toggleExpand(f.id)}
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          {expandedId === f.id
                            ? <><ChevronUp className="h-3 w-3" />Ocultar perguntas</>
                            : <><ChevronDown className="h-3 w-3" />Ver perguntas</>}
                        </button>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden flex">
                        {total > 0 && <>
                          <div className="h-full bg-green-500 transition-all"  style={{ width: `${(aprovadas / total) * 100}%` }} />
                          <div className="h-full bg-yellow-400 transition-all" style={{ width: `${(analise / total) * 100}%` }} />
                          <div className="h-full bg-red-400 transition-all"    style={{ width: `${(reprovadas / total) * 100}%` }} />
                        </>}
                      </div>
                      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                        {aprovadas  > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />{aprovadas} aprovada{aprovadas !== 1 ? 's' : ''}</span>}
                        {analise    > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />{analise} em análise</span>}
                        {reprovadas > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />{reprovadas} reprovada{reprovadas !== 1 ? 's' : ''}</span>}
                        {aguardando > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-muted-foreground/40 inline-block" />{aguardando} aguardando</span>}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="divide-y rounded-md border overflow-hidden">
                      {f.atribuicoes.map(({ diretoria, prazo }) => {
                        const resp = f.respostas.find(r => r.diretoria_id === diretoria.id)
                        return (
                          <div key={diretoria.id} className="flex items-center justify-between px-3 py-2.5 bg-background text-sm">
                            <div className="flex items-center gap-2 min-w-0">
                              {statusIcon(resp?.status ?? '')}
                              <div className="min-w-0">
                                <p className="font-medium truncate">{diretoria.nome}</p>
                                {resp?.usuario && (
                                  <p className="text-[11px] text-muted-foreground">
                                    Respondido por {resp.usuario.nome}
                                    {resp.enviado_em ? ` · ${formatDate(resp.enviado_em)}` : ''}
                                  </p>
                                )}
                                {!resp && prazo && (
                                  <p className="text-[11px] text-muted-foreground">Prazo: {formatDate(prazo)}</p>
                                )}
                              </div>
                            </div>
                            <div className="shrink-0 ml-3">
                              {resp ? (
                                <Link href={`/respostas/${resp.id}`} className="flex items-center gap-1.5 hover:opacity-80">
                                  <Badge variant={RESP_VARIANT[resp.status] ?? 'secondary'} className="text-[10px] px-1.5 py-0">
                                    {RESP_LABEL[resp.status] ?? resp.status}
                                  </Badge>
                                  <Eye className="h-3 w-3 text-muted-foreground" />
                                </Link>
                              ) : (
                                <span className="text-[11px] text-muted-foreground italic">Aguardando</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>

                  {expandedId === f.id && (
                    <div className="border-t px-6 py-4 space-y-2 bg-muted/20">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                        Perguntas do formulário
                      </p>
                      {(() => {
                        const campos: Campo[] = (f.schema_json as { campos?: Campo[] } | null)?.campos ?? []
                        if (campos.length === 0)
                          return <p className="text-xs text-muted-foreground italic">Este formulário ainda não possui perguntas.</p>
                        return campos.map((c, i) => (
                          <div key={c.id ?? c.nome ?? i} className="flex items-start gap-3 py-2 border-b last:border-0">
                            <span className="text-xs font-bold text-muted-foreground w-5 shrink-0 pt-0.5">{i + 1}.</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium leading-snug">
                                {c.label}
                                {c.obrigatorio && <span className="text-destructive ml-1 text-xs">*</span>}
                              </p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">{TIPO_LABEL[c.tipo] ?? c.tipo}</p>
                              {c.opcoes && c.opcoes.length > 0 && (
                                <ul className="mt-1 space-y-0.5">
                                  {c.opcoes.map(o => (
                                    <li key={o} className="text-[11px] text-muted-foreground flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 inline-block shrink-0" />{o}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        ))
                      })()}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

/* ── Linha da tabela admin com suporte a drag ─────────────── */
function SortableRow({
  f, canManage, onArquivar, onExcluir,
}: {
  f: Formulario
  canManage: boolean
  onArquivar: (id: string) => void
  onExcluir: (f: Formulario) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: f.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <tr ref={setNodeRef} style={style} className="hover:bg-muted/30">
      <td className="px-2 py-3 w-8">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground p-1 rounded"
          aria-label="Arrastar para reordenar"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </td>
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
        {f.atribuicoes.length === 0 ? (
          <span className="text-muted-foreground text-xs">—</span>
        ) : (
          <div className="flex flex-wrap gap-1 max-w-[220px]">
            {f.atribuicoes.slice(0, 3).map(({ diretoria }) => (
              <span key={diretoria.id} className="inline-block text-[11px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground leading-tight">
                {diretoria.nome}
              </span>
            ))}
            {f.atribuicoes.length > 3 && (
              <span className="inline-block text-[11px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground leading-tight">
                +{f.atribuicoes.length - 3}
              </span>
            )}
          </div>
        )}
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
                  <DropdownMenuItem onClick={() => onArquivar(f.id)}>
                    <Archive className="h-3.5 w-3.5 mr-2" />Arquivar
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onExcluir(f)} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-3.5 w-3.5 mr-2" />Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </td>
    </tr>
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

  const isSecretario = user?.role === 'SECRETARIO'
  const isDiretor    = user?.role === 'DIRETOR' || user?.role === 'OPERADOR'
  const isResponder  = isSecretario || isDiretor
  const canManage    = !isResponder

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const load = useCallback(() => {
    const q = new URLSearchParams()
    if (search) q.set('titulo', search)
    if (isSecretario) {
      q.set('status', 'PUBLICADO')
      if (user?.secretaria_id) q.set('secretaria_id', user.secretaria_id)
    }
    if (isDiretor) {
      q.set('status', 'PUBLICADO')
      if (user?.diretoria_id) q.set('diretoria_id', user.diretoria_id)
    }
    api.get<Formulario[]>(`/formularios?${q}`)
      .then(setItems).catch(() => toast.error('Erro ao carregar formulários'))
  }, [search, isSecretario, isDiretor, user?.secretaria_id, user?.diretoria_id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (canManage) api.get<Secretaria[]>('/secretarias').then(setSecretarias).catch(() => {})
  }, [canManage])

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

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = items.findIndex(f => f.id === active.id)
    const newIndex = items.findIndex(f => f.id === over.id)
    const reordered = arrayMove(items, oldIndex, newIndex)
    setItems(reordered)

    try {
      await api.patch('/formularios/reordenar', {
        items: reordered.map((f, i) => ({ id: f.id, posicao: i })),
      })
    } catch {
      toast.error('Erro ao salvar ordem')
      load()
    }
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

      {isDiretor ? (
        <PainelDiretor items={items} diretoriaId={user?.diretoria_id ?? ''} />
      ) : isSecretario ? (
        <PainelSecretario items={items} />
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map(f => f.id)} strategy={verticalListSortingStrategy}>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-2 py-3 w-8" />
                    {['Título', 'Órgão', 'Diretorias', 'Status', 'Versão', 'Criador', 'Publicado em', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((f) => (
                    <SortableRow
                      key={f.id}
                      f={f}
                      canManage={canManage}
                      onArquivar={arquivar}
                      onExcluir={excluir}
                    />
                  ))}
                  {items.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">Nenhum formulário encontrado</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </SortableContext>
        </DndContext>
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

            {canManage && !user?.secretaria_id && (
              <div className="space-y-1.5">
                <Label>Órgão responsável *</Label>
                <Select value={secretariaId} onValueChange={setSecretariaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o órgão" />
                  </SelectTrigger>
                  <SelectContent>
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
