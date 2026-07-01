'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, arrayMove, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowLeft, BarChart2, BookOpen, CheckCheck, Copy,
  GripVertical, Plus, Send, Star, Trash2, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'

// ─── Types ────────────────────────────────────────────────────────────────────

type TipoCampo =
  | 'texto' | 'paragrafo' | 'multipla_escolha' | 'caixa_selecao'
  | 'lista_suspensa' | 'numero' | 'data' | 'moeda'

const TIPOS: { value: TipoCampo; label: string }[] = [
  { value: 'texto',           label: 'Resposta curta' },
  { value: 'paragrafo',       label: 'Parágrafo' },
  { value: 'multipla_escolha', label: 'Múltipla escolha' },
  { value: 'caixa_selecao',   label: 'Caixas de seleção' },
  { value: 'lista_suspensa',  label: 'Lista suspensa' },
  { value: 'numero',          label: 'Número' },
  { value: 'data',            label: 'Data' },
  { value: 'moeda',           label: 'Valor em R$' },
]

const TIPOS_COM_OPCOES: TipoCampo[] = ['multipla_escolha', 'caixa_selecao', 'lista_suspensa']

interface CampoBuilder {
  id: string
  tipo: TipoCampo
  label: string
  obrigatorio: boolean
  opcoes: string[]
  reutilizavel: boolean
}

interface BancoCampo {
  formId: string
  formTitulo: string
  campo: CampoBuilder
}

interface Pesquisa {
  id: string
  titulo: string
  descricao: string | null
  status: 'RASCUNHO' | 'PUBLICADA' | 'ENCERRADA'
  schema_json: Record<string, unknown> | null
  publicado_em: string | null
  encerrado_em: string | null
  created_at: string
  criador: { nome: string } | null
  _count: { respostas: number }
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'destructive'> = {
  RASCUNHO: 'secondary', PUBLICADA: 'success', ENCERRADA: 'destructive',
}
const STATUS_LABEL: Record<string, string> = {
  RASCUNHO: 'Rascunho', PUBLICADA: 'Publicada', ENCERRADA: 'Encerrada',
}

// ─── Schema helpers ───────────────────────────────────────────────────────────

function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

function newCampo(): CampoBuilder {
  return { id: genId(), tipo: 'texto', label: '', obrigatorio: false, opcoes: [], reutilizavel: false }
}

function schemaToBuilder(schema: Record<string, unknown> | null): CampoBuilder[] {
  if (!schema) return []
  const campos = schema.campos as Array<Record<string, unknown>> | undefined
  if (!Array.isArray(campos)) return []
  return campos.map((c) => ({
    id: String(c.id ?? genId()),
    tipo: (c.tipo as TipoCampo) ?? 'texto',
    label: String(c.label ?? ''),
    obrigatorio: Boolean(c.obrigatorio ?? false),
    opcoes: Array.isArray(c.opcoes) ? (c.opcoes as unknown[]).map(String) : [],
    reutilizavel: Boolean(c.reutilizavel ?? false),
  }))
}

function builderToSchema(campos: CampoBuilder[]): Record<string, unknown> {
  return {
    campos: campos.map(({ id, tipo, label, obrigatorio, opcoes, reutilizavel }) => ({
      id, tipo, label, obrigatorio, reutilizavel,
      ...(TIPOS_COM_OPCOES.includes(tipo) ? { opcoes } : {}),
    })),
  }
}

// ─── CampoCard ────────────────────────────────────────────────────────────────

interface CampoCardProps {
  campo: CampoBuilder
  idx: number
  canEdit: boolean
  onUpdate: (id: string, patch: Partial<CampoBuilder>) => void
  onRemove: (id: string) => void
  onDuplicate: (id: string) => void
  onAddOpcao: (id: string) => void
  onUpdateOpcao: (id: string, i: number, v: string) => void
  onRemoveOpcao: (id: string, i: number) => void
}

function CampoCard({
  campo, idx, canEdit,
  onUpdate, onRemove, onDuplicate,
  onAddOpcao, onUpdateOpcao, onRemoveOpcao,
}: CampoCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: campo.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.45 : 1 }}
      className="rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow p-5 space-y-4"
    >
      {/* Linha: grip + label + tipo + ações */}
      <div className="flex items-start gap-2">
        {canEdit && (
          <button
            {...attributes}
            {...listeners}
            className="shrink-0 mt-2 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
            tabIndex={-1}
          >
            <GripVertical className="h-5 w-5" />
          </button>
        )}
        <div className="flex-1 space-y-3">
          <Textarea
            placeholder={`Pergunta ${idx + 1}`}
            value={campo.label}
            rows={1}
            onChange={(e) => onUpdate(campo.id, { label: e.target.value })}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = `${el.scrollHeight}px`
            }}
            disabled={!canEdit}
            className="font-medium text-base resize-none overflow-hidden min-h-0 py-2"
          />
          <Select
            value={campo.tipo}
            onValueChange={(v) => onUpdate(campo.id, { tipo: v as TipoCampo, opcoes: [] })}
            disabled={!canEdit}
          >
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {canEdit && (
          <div className="flex gap-1 shrink-0 mt-1">
            <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={() => onDuplicate(campo.id)}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => onRemove(campo.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Preview do campo */}
      <div className="pl-1">
        {campo.tipo === 'texto' && (
          <Input disabled placeholder="Resposta curta" className="max-w-xs bg-muted/30 text-muted-foreground" />
        )}
        {campo.tipo === 'paragrafo' && (
          <Textarea disabled placeholder="Resposta longa..." rows={3} className="bg-muted/30 text-muted-foreground" />
        )}
        {campo.tipo === 'numero' && (
          <Input disabled type="number" placeholder="0" className="max-w-[120px] bg-muted/30" />
        )}
        {campo.tipo === 'data' && (
          <Input disabled type="date" className="max-w-[180px] bg-muted/30" />
        )}
        {campo.tipo === 'moeda' && (
          <div className="flex items-center border rounded-md max-w-[220px] bg-muted/30 overflow-hidden opacity-60">
            <span className="px-3 py-2 text-sm font-medium bg-muted text-muted-foreground border-r select-none">R$</span>
            <span className="px-3 py-2 text-sm text-muted-foreground">0,00</span>
          </div>
        )}
        {TIPOS_COM_OPCOES.includes(campo.tipo) && (
          <div className="space-y-2">
            {campo.opcoes.map((opcao, i) => (
              <div key={i} className="flex items-center gap-2">
                <div
                  className="shrink-0 w-4 h-4 border-2 border-muted-foreground bg-background"
                  style={{ borderRadius: campo.tipo === 'caixa_selecao' ? '4px' : campo.tipo === 'multipla_escolha' ? '50%' : '2px' }}
                />
                <Input
                  value={opcao}
                  onChange={(e) => onUpdateOpcao(campo.id, i, e.target.value)}
                  placeholder={`Opção ${i + 1}`}
                  disabled={!canEdit}
                  className="h-8 max-w-xs"
                />
                {canEdit && (
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onRemoveOpcao(campo.id, i)}>
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
            {canEdit && (
              <button
                onClick={() => onAddOpcao(campo.id)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors pl-6 mt-1"
              >
                <div
                  className="w-4 h-4 border-2 border-dashed border-muted-foreground shrink-0"
                  style={{ borderRadius: campo.tipo === 'caixa_selecao' ? '4px' : campo.tipo === 'multipla_escolha' ? '50%' : '2px' }}
                />
                Adicionar opção
              </button>
            )}
            {campo.opcoes.length === 0 && canEdit && (
              <p className="text-xs text-muted-foreground pl-6">Adicione pelo menos uma opção</p>
            )}
          </div>
        )}
      </div>

      {/* Rodapé */}
      <div className="flex items-center justify-between pt-2 border-t flex-wrap gap-2">
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={campo.reutilizavel}
            onChange={(e) => onUpdate(campo.id, { reutilizavel: e.target.checked })}
            disabled={!canEdit}
            className="h-4 w-4 rounded accent-amber-500"
          />
          <Star className={`h-3.5 w-3.5 ${campo.reutilizavel ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground'}`} />
          <span className={campo.reutilizavel ? 'text-amber-600 font-medium' : ''}>Reutilizável</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={campo.obrigatorio}
            onChange={(e) => onUpdate(campo.id, { obrigatorio: e.target.checked })}
            disabled={!canEdit}
            className="h-4 w-4 rounded"
          />
          Obrigatório
        </label>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PesquisaEditorPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [pesquisa, setPesquisa]   = useState<Pesquisa | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc]   = useState('')
  const [campos, setCampos]       = useState<CampoBuilder[]>([])
  const [saving, setSaving]       = useState(false)
  const [dirty, setDirty]         = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  const [bancoOpen, setBancoOpen]       = useState(false)
  const [bancoItems, setBancoItems]     = useState<BancoCampo[]>([])
  const [bancoSelected, setBancoSelected] = useState<Set<string>>(new Set())

  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const load = useCallback(async () => {
    try {
      const p = await api.get<Pesquisa>(`/pesquisas/${id}`)
      setPesquisa(p)
      setEditTitle(p.titulo)
      setEditDesc(p.descricao ?? '')
      setCampos(schemaToBuilder(p.schema_json))
    } catch {
      toast.error('Pesquisa não encontrada')
      router.push('/pesquisas')
    }
  }, [id, router])

  useEffect(() => { load() }, [load])

  // Auto-save
  useEffect(() => {
    if (!dirty) return
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current)
    autoSaveRef.current = setTimeout(() => saveChanges(false), 1500)
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campos, editTitle, editDesc, dirty])

  async function saveChanges(showToast = true) {
    if (!pesquisa) return
    setSaving(true)
    try {
      await api.patch(`/pesquisas/${pesquisa.id}`, {
        titulo: editTitle.trim() || pesquisa.titulo,
        descricao: editDesc.trim() || undefined,
        schema_json: builderToSchema(campos),
      })
      setDirty(false)
      if (showToast) toast.success('Salvo!')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function publicar() {
    await saveChanges(false)
    try {
      await api.post(`/pesquisas/${id}/publicar`, {})
      toast.success('Pesquisa publicada!')
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao publicar')
    }
  }

  async function encerrar() {
    if (!confirm('Encerrar esta pesquisa? Não será mais possível receber respostas.')) return
    try {
      await api.post(`/pesquisas/${id}/encerrar`, {})
      toast.success('Pesquisa encerrada')
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao encerrar')
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setCampos((prev) => {
      const from = prev.findIndex((c) => c.id === active.id)
      const to   = prev.findIndex((c) => c.id === over.id)
      return arrayMove(prev, from, to)
    })
    setDirty(true)
  }

  // Campo mutations
  function addCampo() { setCampos((p) => [...p, newCampo()]); setDirty(true) }
  function removeCampo(cid: string) { setCampos((p) => p.filter((c) => c.id !== cid)); setDirty(true) }
  function updateCampo(cid: string, patch: Partial<CampoBuilder>) {
    setCampos((p) => p.map((c) => c.id === cid ? { ...c, ...patch } : c)); setDirty(true)
  }
  function addOpcao(cid: string) {
    setCampos((p) => p.map((c) => c.id === cid ? { ...c, opcoes: [...c.opcoes, ''] } : c)); setDirty(true)
  }
  function updateOpcao(cid: string, i: number, v: string) {
    setCampos((p) => p.map((c) => c.id === cid ? { ...c, opcoes: c.opcoes.map((o, j) => j === i ? v : o) } : c)); setDirty(true)
  }
  function removeOpcao(cid: string, i: number) {
    setCampos((p) => p.map((c) => c.id === cid ? { ...c, opcoes: c.opcoes.filter((_, j) => j !== i) } : c)); setDirty(true)
  }
  function duplicarCampo(cid: string) {
    setCampos((p) => {
      const idx = p.findIndex((c) => c.id === cid)
      if (idx === -1) return p
      const copia = { ...p[idx], id: genId(), reutilizavel: false }
      const next = [...p]; next.splice(idx + 1, 0, copia); return next
    }); setDirty(true)
  }

  // Banco de perguntas
  async function loadBanco() {
    try {
      const forms = await api.get<Array<{ id: string; titulo: string; schema_json: Record<string, unknown> }>>('/formularios')
      const items: BancoCampo[] = []
      for (const f of forms) {
        const cs = schemaToBuilder(f.schema_json)
        for (const c of cs) {
          if (c.reutilizavel) items.push({ formId: f.id, formTitulo: f.titulo, campo: c })
        }
      }
      setBancoItems(items)
    } catch {
      toast.error('Erro ao carregar banco de perguntas')
    }
  }

  function toggleBancoSelect(key: string) {
    setBancoSelected((prev) => {
      const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next
    })
  }

  function addFromBanco() {
    const toAdd = bancoItems
      .filter((item) => bancoSelected.has(`${item.formId}:${item.campo.id}`))
      .map((item) => ({ ...item.campo, id: genId(), reutilizavel: false }))
    setCampos((p) => [...p, ...toAdd])
    setBancoSelected(new Set()); setBancoOpen(false); setDirty(true)
  }

  function copiarLink() {
    if (!pesquisa) return
    navigator.clipboard.writeText(`${window.location.origin}/pesquisa/${pesquisa.id}`).then(() => {
      setCopiedLink(true); toast.success('Link copiado!')
      setTimeout(() => setCopiedLink(false), 2000)
    })
  }

  if (!pesquisa) return <div className="p-6 text-muted-foreground">Carregando...</div>

  const canEdit = pesquisa.status === 'RASCUNHO'

  return (
    <div className="p-6 pb-12 space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/pesquisas')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{pesquisa.titulo}</h1>
            <Badge variant={STATUS_VARIANT[pesquisa.status] ?? 'secondary'}>
              {STATUS_LABEL[pesquisa.status]}
            </Badge>
            {saving && <span className="text-xs text-muted-foreground">Salvando...</span>}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Criado por {pesquisa.criador?.nome ?? '—'} em {formatDate(pesquisa.created_at)}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {canEdit && (
            <Button onClick={() => saveChanges()} disabled={saving} variant="outline">
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          )}
          {pesquisa.status === 'RASCUNHO' && (
            <Button onClick={publicar} disabled={saving}>
              <Send className="h-4 w-4 mr-1" />Publicar
            </Button>
          )}
          {pesquisa.status === 'PUBLICADA' && (
            <Button variant="destructive" onClick={encerrar}>Encerrar</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Coluna principal: builder */}
        <div className="lg:col-span-2 space-y-3">

          {/* Título e descrição */}
          <div className="rounded-xl border bg-card shadow-sm border-l-4 border-l-[#0f1b2d] p-5 space-y-3">
            <Input
              className="text-xl font-semibold border-0 border-b rounded-none px-0 focus-visible:ring-0"
              placeholder="Título da pesquisa"
              value={editTitle}
              onChange={(e) => { setEditTitle(e.target.value); setDirty(true) }}
              disabled={!canEdit}
            />
            <Input
              className="border-0 border-b rounded-none px-0 focus-visible:ring-0 text-sm text-muted-foreground"
              placeholder="Descrição (opcional)"
              value={editDesc}
              onChange={(e) => { setEditDesc(e.target.value); setDirty(true) }}
              disabled={!canEdit}
            />
          </div>

          {/* Perguntas (DnD) */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={campos.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              {campos.map((campo, idx) => (
                <CampoCard
                  key={campo.id}
                  campo={campo}
                  idx={idx}
                  canEdit={canEdit}
                  onUpdate={updateCampo}
                  onRemove={removeCampo}
                  onDuplicate={duplicarCampo}
                  onAddOpcao={addOpcao}
                  onUpdateOpcao={updateOpcao}
                  onRemoveOpcao={removeOpcao}
                />
              ))}
            </SortableContext>
          </DndContext>

          {/* Adicionar pergunta / Banco */}
          {canEdit && (
            <div className="flex gap-2">
              <button
                onClick={addCampo}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/30 p-5 text-sm text-muted-foreground hover:border-[#0f1b2d]/50 hover:text-[#0f1b2d] transition-colors"
              >
                <Plus className="h-4 w-4" />Adicionar pergunta
              </button>
              <button
                onClick={() => { setBancoSelected(new Set()); setBancoOpen(true); loadBanco() }}
                className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-amber-300 p-5 text-sm text-amber-600 hover:border-amber-500 hover:bg-amber-50 transition-colors px-6"
              >
                <BookOpen className="h-4 w-4" />Banco de perguntas
              </button>
            </div>
          )}

          {campos.length === 0 && !canEdit && (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma pergunta cadastrada</p>
          )}
        </div>

        {/* Painel lateral */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Informações</h2>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Status</span>
              <Badge variant={STATUS_VARIANT[pesquisa.status] ?? 'secondary'} className="text-[11px]">
                {STATUS_LABEL[pesquisa.status]}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Perguntas</span>
              <span className="font-medium text-foreground">{campos.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Respostas</span>
              <span className="font-medium text-foreground">{pesquisa._count.respostas}</span>
            </div>
            {pesquisa.publicado_em && (
              <div className="flex items-center justify-between">
                <span>Publicada em</span>
                <span>{formatDate(pesquisa.publicado_em)}</span>
              </div>
            )}
            {pesquisa.encerrado_em && (
              <div className="flex items-center justify-between">
                <span>Encerrada em</span>
                <span>{formatDate(pesquisa.encerrado_em)}</span>
              </div>
            )}
          </div>

          <Separator />

          {pesquisa.status !== 'RASCUNHO' && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Link público</p>
              <Button variant="outline" size="sm" className="w-full gap-2" onClick={copiarLink}>
                {copiedLink
                  ? <><CheckCheck className="h-3.5 w-3.5 text-green-500" />Copiado!</>
                  : <><Copy className="h-3.5 w-3.5" />Copiar link</>
                }
              </Button>
            </div>
          )}

          {pesquisa._count.respostas > 0 && (
            <Button
              variant="outline" size="sm" className="w-full gap-2"
              onClick={() => router.push(`/pesquisas/${pesquisa.id}/resultados`)}
            >
              <BarChart2 className="h-3.5 w-3.5" />
              Ver resultados ({pesquisa._count.respostas})
            </Button>
          )}
        </div>
      </div>

      {/* Dialog: banco de perguntas */}
      <Dialog open={bancoOpen} onOpenChange={setBancoOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-amber-500" />
              Banco de perguntas reutilizáveis
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1">
            {bancoItems.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <Star className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                <p>Nenhuma pergunta reutilizável encontrada.</p>
                <p className="mt-1 text-xs">
                  Marque perguntas como <span className="font-medium text-amber-600">Reutilizável</span> em qualquer formulário para vê-las aqui.
                </p>
              </div>
            ) : (
              (() => {
                const agrupado = bancoItems.reduce<Record<string, BancoCampo[]>>((acc, item) => {
                  if (!acc[item.formTitulo]) acc[item.formTitulo] = []
                  acc[item.formTitulo].push(item)
                  return acc
                }, {})
                return Object.entries(agrupado).map(([titulo, items]) => (
                  <div key={titulo}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{titulo}</p>
                    <div className="space-y-1.5">
                      {items.map((item) => {
                        const key = `${item.formId}:${item.campo.id}`
                        const selected = bancoSelected.has(key)
                        return (
                          <label
                            key={key}
                            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selected ? 'border-amber-400 bg-amber-50' : 'hover:bg-muted/40'}`}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleBancoSelect(key)}
                              className="mt-0.5 h-4 w-4 rounded accent-amber-500"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium leading-snug">
                                {item.campo.label || <span className="italic text-muted-foreground">Sem título</span>}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {TIPOS.find((t) => t.value === item.campo.tipo)?.label ?? item.campo.tipo}
                                {item.campo.obrigatorio && ' · Obrigatório'}
                              </p>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))
              })()
            )}
          </div>
          <DialogFooter className="border-t pt-3">
            <Button variant="outline" onClick={() => setBancoOpen(false)}>Cancelar</Button>
            <Button
              onClick={addFromBanco}
              disabled={bancoSelected.size === 0}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              Inserir {bancoSelected.size > 0 ? `${bancoSelected.size} ` : ''}pergunta{bancoSelected.size !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
