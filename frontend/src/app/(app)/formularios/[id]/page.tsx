'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, arrayMove, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useRouter } from 'next/navigation'
import { ArrowLeft, BookOpen, Copy, GripVertical, Paperclip, Plus, Send, Star, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'

// ─── Types ────────────────────────────────────────────────────────────────────

type TipoCampo =
  | 'texto'
  | 'paragrafo'
  | 'multipla_escolha'
  | 'caixa_selecao'
  | 'lista_suspensa'
  | 'numero'
  | 'data'
  | 'moeda'

const TIPOS: { value: TipoCampo; label: string }[] = [
  { value: 'texto', label: 'Resposta curta' },
  { value: 'paragrafo', label: 'Parágrafo' },
  { value: 'multipla_escolha', label: 'Múltipla escolha' },
  { value: 'caixa_selecao', label: 'Caixas de seleção' },
  { value: 'lista_suspensa', label: 'Lista suspensa' },
  { value: 'numero', label: 'Número' },
  { value: 'data', label: 'Data' },
  { value: 'moeda', label: 'Valor em R$' },
]

const TIPOS_COM_OPCOES: TipoCampo[] = ['multipla_escolha', 'caixa_selecao', 'lista_suspensa']

interface CampoBuilder {
  id: string
  tipo: TipoCampo
  label: string
  obrigatorio: boolean
  opcoes: string[]
  reutilizavel: boolean
  permite_anexo: boolean
}

interface BancoCampo {
  formId: string
  formTitulo: string
  campo: CampoBuilder
}

interface Formulario {
  id: string
  titulo: string
  descricao: string | null
  status: string
  versao: number
  schema_json: Record<string, unknown>
  publicado_em: string | null
  arquivado_em: string | null
  created_at: string
  criador: { nome: string } | null
  atribuicoes: { id: string; diretoria: { id: string; nome: string }; prazo: string | null }[]
}

interface Diretoria {
  id: string
  nome: string
  secretaria?: { nome: string }
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'destructive'> = {
  RASCUNHO: 'secondary', PUBLICADO: 'success', ARQUIVADO: 'destructive',
}

// ─── Schema helpers ───────────────────────────────────────────────────────────

function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

function newCampo(): CampoBuilder {
  return { id: genId(), tipo: 'texto', label: '', obrigatorio: false, opcoes: [], reutilizavel: false, permite_anexo: false }
}

function schemaToBuilder(schema: Record<string, unknown>): CampoBuilder[] {
  const campos = schema.campos as Array<Record<string, unknown>> | undefined
  if (!Array.isArray(campos)) return []
  return campos.map((c) => ({
    id: String(c.id ?? genId()),
    tipo: (c.tipo as TipoCampo) ?? 'texto',
    label: String(c.label ?? ''),
    obrigatorio: Boolean(c.obrigatorio ?? false),
    opcoes: Array.isArray(c.opcoes) ? (c.opcoes as unknown[]).map(String) : [],
    reutilizavel: Boolean(c.reutilizavel ?? false),
    permite_anexo: Boolean(c.permite_anexo ?? false),
  }))
}

function builderToSchema(campos: CampoBuilder[]): Record<string, unknown> {
  return {
    campos: campos.map(({ id, tipo, label, obrigatorio, opcoes, reutilizavel, permite_anexo }) => ({
      id,
      tipo,
      label,
      obrigatorio,
      reutilizavel,
      permite_anexo,
      ...(TIPOS_COM_OPCOES.includes(tipo) ? { opcoes } : {}),
    })),
  }
}

// ─── Campo card sortável ───────────────────────────────────────────────────────

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

function CampoCard({ campo, idx, canEdit, onUpdate, onRemove, onDuplicate, onAddOpcao, onUpdateOpcao, onRemoveOpcao }: CampoCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: campo.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.45 : 1 }}
      className="rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow p-5 space-y-4"
    >
      {/* Linha superior: grip + label + tipo + ações */}
      <div className="flex items-start gap-2">
        {canEdit && (
          <button
            {...attributes}
            {...listeners}
            className="shrink-0 mt-2 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
            tabIndex={-1}
            title="Arrastar para reordenar"
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
            <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-foreground" title="Duplicar" onClick={() => onDuplicate(campo.id)}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => onRemove(campo.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Preview */}
      <div className="pl-1">
        {campo.tipo === 'texto' && <Input disabled placeholder="Resposta curta" className="max-w-xs bg-muted/30 text-muted-foreground" />}
        {campo.tipo === 'paragrafo' && <Textarea disabled placeholder="Resposta longa..." rows={3} className="bg-muted/30 text-muted-foreground" />}
        {campo.tipo === 'numero' && <Input disabled type="number" placeholder="0" className="max-w-[120px] bg-muted/30" />}
        {campo.tipo === 'data' && <Input disabled type="date" className="max-w-[180px] bg-muted/30" />}
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
                <div className="shrink-0 w-4 h-4 border-2 border-muted-foreground bg-background"
                  style={{ borderRadius: campo.tipo === 'caixa_selecao' ? '4px' : campo.tipo === 'multipla_escolha' ? '50%' : '2px' }} />
                <Input value={opcao} onChange={(e) => onUpdateOpcao(campo.id, i, e.target.value)}
                  placeholder={`Opção ${i + 1}`} disabled={!canEdit} className="h-8 max-w-xs" />
                {canEdit && (
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onRemoveOpcao(campo.id, i)}>
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
            {canEdit && (
              <button onClick={() => onAddOpcao(campo.id)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors pl-6 mt-1">
                <div className="w-4 h-4 border-2 border-dashed border-muted-foreground shrink-0"
                  style={{ borderRadius: campo.tipo === 'caixa_selecao' ? '4px' : campo.tipo === 'multipla_escolha' ? '50%' : '2px' }} />
                Adicionar opção
              </button>
            )}
            {campo.opcoes.length === 0 && canEdit && <p className="text-xs text-muted-foreground pl-6">Adicione pelo menos uma opção</p>}
          </div>
        )}
      </div>

      {/* Preview de anexo */}
      {campo.permite_anexo && (
        <div className="pl-1">
          <div className="flex items-center gap-2 rounded-md border border-dashed border-muted-foreground/40 px-3 py-2 max-w-xs bg-muted/20 text-muted-foreground opacity-60">
            <Paperclip className="h-4 w-4 shrink-0" />
            <span className="text-sm">Anexar arquivo</span>
          </div>
        </div>
      )}

      {/* Rodapé */}
      <div className="flex items-center justify-between pt-2 border-t flex-wrap gap-2">
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
          <input type="checkbox" checked={campo.reutilizavel}
            onChange={(e) => onUpdate(campo.id, { reutilizavel: e.target.checked })}
            disabled={!canEdit} className="h-4 w-4 rounded accent-amber-500" />
          <Star className={`h-3.5 w-3.5 ${campo.reutilizavel ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground'}`} />
          <span className={campo.reutilizavel ? 'text-amber-600 font-medium' : ''}>Reutilizável</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
          <input type="checkbox" checked={campo.permite_anexo}
            onChange={(e) => onUpdate(campo.id, { permite_anexo: e.target.checked })}
            disabled={!canEdit} className="h-4 w-4 rounded accent-blue-500" />
          <Paperclip className={`h-3.5 w-3.5 ${campo.permite_anexo ? 'text-blue-500' : 'text-muted-foreground'}`} />
          <span className={campo.permite_anexo ? 'text-blue-600 font-medium' : ''}>Permite anexo</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
          <input type="checkbox" checked={campo.obrigatorio}
            onChange={(e) => onUpdate(campo.id, { obrigatorio: e.target.checked })}
            disabled={!canEdit} className="h-4 w-4 rounded" />
          Obrigatório
        </label>
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FormularioDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [id, setId] = useState('')
  const [formulario, setFormulario] = useState<Formulario | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [campos, setCampos] = useState<CampoBuilder[]>([])
  const [saving, setSaving] = useState(false)
  const [atribOpen, setAtribOpen] = useState(false)
  const [atribForm, setAtribForm] = useState({ diretoria_id: '', prazo: '' })
  const [atribSaving, setAtribSaving] = useState(false)
  const [diretorias, setDiretorias] = useState<Diretoria[]>([])
  const [bancoOpen, setBancoOpen] = useState(false)
  const [bancoItems, setBancoItems] = useState<BancoCampo[]>([])
  const [bancoSelected, setBancoSelected] = useState<Set<string>>(new Set())

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setCampos((prev) => {
      const from = prev.findIndex((c) => c.id === active.id)
      const to   = prev.findIndex((c) => c.id === over.id)
      return arrayMove(prev, from, to)
    })
  }

  useEffect(() => { params.then((p) => setId(p.id)) }, [params])

  const load = useCallback(() => {
    if (!id) return
    api.get<Formulario>(`/formularios/${id}`)
      .then((f) => {
        setFormulario(f)
        setEditTitle(f.titulo)
        setEditDesc(f.descricao ?? '')
        setCampos(schemaToBuilder(f.schema_json))
      })
      .catch(() => toast.error('Erro ao carregar formulário'))
  }, [id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    api.get<Diretoria[]>('/diretorias').then(setDiretorias).catch(() => {})
  }, [])

  async function saveChanges() {
    if (!formulario) return
    setSaving(true)
    try {
      await api.patch(`/formularios/${formulario.id}`, {
        titulo: editTitle,
        descricao: editDesc || undefined,
        schema_json: builderToSchema(campos),
      })
      toast.success('Salvo')
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    } finally {
      setSaving(false)
    }
  }

  async function publicar() {
    if (!formulario) return
    setSaving(true)
    try {
      await api.patch(`/formularios/${formulario.id}`, {
        titulo: editTitle,
        descricao: editDesc || undefined,
        schema_json: builderToSchema(campos),
      })
      await api.post(`/formularios/${formulario.id}/publicar`, {})
      toast.success('Formulário publicado')
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    } finally {
      setSaving(false)
    }
  }

  async function arquivar() {
    if (!formulario) return
    try {
      await api.post(`/formularios/${formulario.id}/arquivar`, {})
      toast.success('Formulário arquivado')
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    }
  }

  async function removerAtribuicao(diretoriaId: string) {
    if (!formulario) return
    try {
      await api.delete(`/formularios/${formulario.id}/atribuicoes/${diretoriaId}`)
      toast.success('Atribuição removida')
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    }
  }

  async function adicionarAtribuicao() {
    if (!formulario) return
    setAtribSaving(true)
    try {
      await api.post(`/formularios/${formulario.id}/atribuicoes`, {
        diretoria_id: atribForm.diretoria_id,
        prazo: atribForm.prazo || undefined,
      })
      toast.success('Atribuição adicionada')
      setAtribOpen(false)
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    } finally {
      setAtribSaving(false)
    }
  }

  async function loadBanco() {
    try {
      const forms = await api.get<Array<{ id: string; titulo: string; schema_json: Record<string, unknown> }>>('/formularios')
      const items: BancoCampo[] = []
      for (const f of forms) {
        if (f.id === id) continue
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
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function addFromBanco() {
    const toAdd = bancoItems
      .filter((item) => bancoSelected.has(`${item.formId}:${item.campo.id}`))
      .map((item) => ({ ...item.campo, id: genId(), reutilizavel: false }))
    setCampos((prev) => [...prev, ...toAdd])
    setBancoSelected(new Set())
    setBancoOpen(false)
  }

  // ─── Campo mutations ─────────────────────────────────────────────────────

  function addCampo() {
    setCampos((prev) => [...prev, newCampo()])
  }

  function removeCampo(campoId: string) {
    setCampos((prev) => prev.filter((c) => c.id !== campoId))
  }

  function updateCampo(campoId: string, patch: Partial<CampoBuilder>) {
    setCampos((prev) => prev.map((c) => c.id === campoId ? { ...c, ...patch } : c))
  }

  function addOpcao(campoId: string) {
    setCampos((prev) => prev.map((c) =>
      c.id === campoId ? { ...c, opcoes: [...c.opcoes, ''] } : c
    ))
  }

  function updateOpcao(campoId: string, idx: number, value: string) {
    setCampos((prev) => prev.map((c) =>
      c.id === campoId ? { ...c, opcoes: c.opcoes.map((o, i) => i === idx ? value : o) } : c
    ))
  }

  function removeOpcao(campoId: string, idx: number) {
    setCampos((prev) => prev.map((c) =>
      c.id === campoId ? { ...c, opcoes: c.opcoes.filter((_, i) => i !== idx) } : c
    ))
  }

  function duplicarCampo(campoId: string) {
    setCampos((prev) => {
      const idx = prev.findIndex((c) => c.id === campoId)
      if (idx === -1) return prev
      const copia = { ...prev[idx], id: genId(), reutilizavel: false }
      const next = [...prev]
      next.splice(idx + 1, 0, copia)
      return next
    })
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (!formulario) return <div className="p-6 text-muted-foreground">Carregando...</div>

  const isRascunho = formulario.status === 'RASCUNHO'
  const canEdit = formulario.status !== 'ARQUIVADO'

  return (
    <div className="p-6 pb-12 space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/formularios')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{formulario.titulo}</h1>
            <Badge variant={STATUS_VARIANT[formulario.status] ?? 'secondary'}>{formulario.status}</Badge>
            <span className="text-sm text-muted-foreground">v{formulario.versao}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Criado por {formulario.criador?.nome ?? '—'} em {formatDate(formulario.created_at)}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {canEdit && (
            <Button onClick={saveChanges} disabled={saving} variant="outline">
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          )}
          {isRascunho && (
            <Button onClick={publicar} disabled={saving}>
              <Send className="h-4 w-4 mr-1" />Publicar
            </Button>
          )}
          {formulario.status === 'PUBLICADO' && (
            <Button variant="destructive" onClick={arquivar}>Arquivar</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Form builder */}
        <div className="lg:col-span-2 space-y-3">

          {/* Título e descrição */}
          <div className="rounded-xl border bg-card shadow-sm border-l-4 border-l-[#0f1b2d] p-5 space-y-3">
            <Input
              className="text-xl font-semibold border-0 border-b rounded-none px-0 focus-visible:ring-0"
              placeholder="Título do formulário"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              disabled={!canEdit}
            />
            <Input
              className="border-0 border-b rounded-none px-0 focus-visible:ring-0 text-sm text-muted-foreground"
              placeholder="Descrição (opcional)"
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              disabled={!canEdit}
            />
          </div>

          {/* Perguntas */}
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

          {/* Botões de ação */}
          {canEdit && (
            <div className="flex gap-2">
              <button
                onClick={addCampo}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/30 p-5 text-sm text-muted-foreground hover:border-[#0f1b2d]/50 hover:text-[#0f1b2d] transition-colors"
              >
                <Plus className="h-4 w-4" />
                Adicionar pergunta
              </button>
              <button
                onClick={() => { setBancoSelected(new Set()); setBancoOpen(true); loadBanco() }}
                className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-amber-300 p-5 text-sm text-amber-600 hover:border-amber-500 hover:bg-amber-50 transition-colors px-6"
              >
                <BookOpen className="h-4 w-4" />
                Banco de perguntas
              </button>
            </div>
          )}

          {campos.length === 0 && !canEdit && (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma pergunta cadastrada</p>
          )}
        </div>

        {/* Painel lateral: Atribuições */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Atribuições</h2>
            <Button size="sm" variant="outline" onClick={() => { setAtribForm({ diretoria_id: '', prazo: '' }); setAtribOpen(true) }}>
              <Plus className="h-3.5 w-3.5 mr-1" />Atribuir
            </Button>
          </div>

          {formulario.atribuicoes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma atribuição</p>
          ) : (
            <div className="space-y-2">
              {formulario.atribuicoes.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium">{a.diretoria.nome}</p>
                    {a.prazo && <p className="text-xs text-muted-foreground">Prazo: {formatDate(a.prazo)}</p>}
                  </div>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removerAtribuicao(a.diretoria.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Separator />

          <div className="space-y-1 text-sm text-muted-foreground">
            {formulario.publicado_em && <p>Publicado em: {formatDate(formulario.publicado_em)}</p>}
            {formulario.arquivado_em && <p>Arquivado em: {formatDate(formulario.arquivado_em)}</p>}
          </div>
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
                <p className="mt-1 text-xs">Marque perguntas como <span className="font-medium text-amber-600">Reutilizável</span> em qualquer formulário para vê-las aqui.</p>
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
                              <p className="text-sm font-medium leading-snug">{item.campo.label || <span className="italic text-muted-foreground">Sem título</span>}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {item.campo.tipo === 'texto' ? 'Resposta curta' :
                                 item.campo.tipo === 'paragrafo' ? 'Parágrafo' :
                                 item.campo.tipo === 'multipla_escolha' ? 'Múltipla escolha' :
                                 item.campo.tipo === 'caixa_selecao' ? 'Caixas de seleção' :
                                 item.campo.tipo === 'lista_suspensa' ? 'Lista suspensa' :
                                 item.campo.tipo === 'numero' ? 'Número' :
                                 item.campo.tipo === 'data' ? 'Data' :
                                 item.campo.tipo === 'moeda' ? 'Valor em R$' : item.campo.tipo}
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

      {/* Dialog: atribuir diretoria */}
      <Dialog open={atribOpen} onOpenChange={setAtribOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Atribuir Diretoria</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Diretoria *</Label>
              <Select value={atribForm.diretoria_id} onValueChange={(v) => setAtribForm({ ...atribForm, diretoria_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma diretoria..." />
                </SelectTrigger>
                <SelectContent>
                  {diretorias.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.nome}{d.secretaria ? ` — ${d.secretaria.nome}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prazo (opcional)</Label>
              <Input
                type="datetime-local"
                value={atribForm.prazo}
                onChange={(e) => setAtribForm({ ...atribForm, prazo: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAtribOpen(false)}>Cancelar</Button>
            <Button onClick={adicionarAtribuicao} disabled={atribSaving || !atribForm.diretoria_id}>
              {atribSaving ? 'Atribuindo...' : 'Atribuir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
