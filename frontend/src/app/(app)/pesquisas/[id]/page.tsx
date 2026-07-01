'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Plus, Trash2, GripVertical, Copy,
  CheckCircle2, ChevronDown, Star,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

type TipoCampo = 'texto' | 'paragrafo' | 'multipla_escolha' | 'caixa_selecao' | 'lista_suspensa' | 'numero' | 'data' | 'moeda'

interface Campo {
  id: string
  tipo: TipoCampo
  label: string
  obrigatorio: boolean
  opcoes: string[]
  reutilizavel: boolean
}

interface Pesquisa {
  id: string
  titulo: string
  descricao: string | null
  schema_json: { campos?: Campo[] } | null
  status: 'RASCUNHO' | 'PUBLICADA' | 'ENCERRADA'
}

const TIPO_LABEL: Record<TipoCampo, string> = {
  texto: 'Resposta curta', paragrafo: 'Parágrafo',
  multipla_escolha: 'Múltipla escolha', caixa_selecao: 'Caixas de seleção',
  lista_suspensa: 'Lista suspensa', numero: 'Número', data: 'Data', moeda: 'Valor em R$',
}
const HAS_OPTIONS: TipoCampo[] = ['multipla_escolha', 'caixa_selecao', 'lista_suspensa']

function uid() { return Math.random().toString(36).slice(2) }

function newCampo(): Campo {
  return { id: uid(), tipo: 'texto', label: '', obrigatorio: false, opcoes: [''], reutilizavel: false }
}

function SortableCampo({
  campo, onChange, onRemove, onDuplicate,
}: {
  campo: Campo
  onChange: (c: Campo) => void
  onRemove: () => void
  onDuplicate: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: campo.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  const hasOpts = HAS_OPTIONS.includes(campo.tipo)

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border bg-background p-4 space-y-3">
      <div className="flex items-start gap-2">
        <button {...attributes} {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground mt-1 p-1 rounded"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="flex-1 space-y-2">
          <div className="flex gap-2 items-start">
            <Input
              className="flex-1 font-medium"
              placeholder="Digite a pergunta..."
              value={campo.label}
              onChange={e => onChange({ ...campo, label: e.target.value })}
            />
            <Select value={campo.tipo} onValueChange={v => onChange({ ...campo, tipo: v as TipoCampo, opcoes: [''] })}>
              <SelectTrigger className="w-44 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(TIPO_LABEL) as [TipoCampo, string][]).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Opções para tipos com escolha */}
          {hasOpts && (
            <div className="space-y-1.5 pl-1">
              {campo.opcoes.map((op, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-muted-foreground shrink-0">
                    {campo.tipo === 'multipla_escolha' ? '○' : campo.tipo === 'caixa_selecao' ? '☐' : `${i + 1}.`}
                  </span>
                  <Input
                    className="h-7 text-sm"
                    placeholder={`Opção ${i + 1}`}
                    value={op}
                    onChange={e => {
                      const opcoes = [...campo.opcoes]
                      opcoes[i] = e.target.value
                      onChange({ ...campo, opcoes })
                    }}
                  />
                  {campo.opcoes.length > 1 && (
                    <button
                      onClick={() => onChange({ ...campo, opcoes: campo.opcoes.filter((_, j) => j !== i) })}
                      className="text-muted-foreground hover:text-destructive"
                    ><Trash2 className="h-3.5 w-3.5" /></button>
                  )}
                </div>
              ))}
              <button
                onClick={() => onChange({ ...campo, opcoes: [...campo.opcoes, ''] })}
                className="text-xs text-primary hover:underline pl-5"
              >+ Adicionar opção</button>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="flex gap-1">
            <button
              onClick={() => onChange({ ...campo, reutilizavel: !campo.reutilizavel })}
              title="Marcar como reutilizável"
              className={campo.reutilizavel ? 'text-yellow-500' : 'text-muted-foreground/40 hover:text-muted-foreground'}
            >
              <Star className="h-4 w-4" fill={campo.reutilizavel ? 'currentColor' : 'none'} />
            </button>
            <button onClick={onDuplicate} className="text-muted-foreground hover:text-foreground p-1">
              <Copy className="h-3.5 w-3.5" />
            </button>
            <button onClick={onRemove} className="text-muted-foreground hover:text-destructive p-1">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={campo.obrigatorio}
              onChange={e => onChange({ ...campo, obrigatorio: e.target.checked })}
              className="rounded"
            />
            Obrigatório
          </label>
        </div>
      </div>
    </div>
  )
}

export default function PesquisaEditorPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [pesquisa, setPesquisa] = useState<Pesquisa | null>(null)
  const [campos, setCampos]     = useState<Campo[]>([])
  const [titulo, setTitulo]     = useState('')
  const [descricao, setDescricao] = useState('')
  const [saving, setSaving]     = useState(false)
  const [dirty, setDirty]       = useState(false)
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const load = useCallback(async () => {
    try {
      const p = await api.get<Pesquisa>(`/pesquisas/${id}`)
      setPesquisa(p)
      setTitulo(p.titulo)
      setDescricao(p.descricao ?? '')
      setCampos((p.schema_json?.campos ?? []) as Campo[])
    } catch {
      toast.error('Pesquisa não encontrada')
      router.push('/pesquisas')
    }
  }, [id, router])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!dirty) return
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current)
    autoSaveRef.current = setTimeout(() => save(false), 1500)
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campos, titulo, descricao, dirty])

  async function save(showToast = true) {
    if (!pesquisa) return
    setSaving(true)
    try {
      await api.patch(`/pesquisas/${pesquisa.id}`, {
        titulo: titulo.trim() || pesquisa.titulo,
        descricao: descricao.trim() || undefined,
        schema_json: { campos },
      })
      setDirty(false)
      if (showToast) toast.success('Salvo!')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally { setSaving(false) }
  }

  async function publicar() {
    await save(false)
    try {
      await api.post(`/pesquisas/${id}/publicar`, {})
      toast.success('Pesquisa publicada! Copie o link na lista.')
      router.push('/pesquisas')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao publicar')
    }
  }

  function updateCampo(idx: number, c: Campo) {
    setCampos(prev => { const n = [...prev]; n[idx] = c; return n })
    setDirty(true)
  }

  function addCampo() {
    setCampos(prev => [...prev, newCampo()])
    setDirty(true)
  }

  function removeCampo(idx: number) {
    setCampos(prev => prev.filter((_, i) => i !== idx))
    setDirty(true)
  }

  function duplicateCampo(idx: number) {
    const c = { ...campos[idx], id: uid() }
    setCampos(prev => [...prev.slice(0, idx + 1), c, ...prev.slice(idx + 1)])
    setDirty(true)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = campos.findIndex(c => c.id === active.id)
    const newIdx = campos.findIndex(c => c.id === over.id)
    setCampos(arrayMove(campos, oldIdx, newIdx))
    setDirty(true)
  }

  const isPublished = pesquisa?.status !== 'RASCUNHO'

  if (!pesquisa) return <div className="p-6 text-muted-foreground">Carregando...</div>

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/pesquisas')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold truncate">{pesquisa.titulo}</h1>
            <Badge variant={pesquisa.status === 'PUBLICADA' ? 'success' : pesquisa.status === 'ENCERRADA' ? 'destructive' : 'secondary'}>
              {pesquisa.status === 'PUBLICADA' ? 'Publicada' : pesquisa.status === 'ENCERRADA' ? 'Encerrada' : 'Rascunho'}
            </Badge>
            {saving && <span className="text-xs text-muted-foreground">Salvando...</span>}
          </div>
        </div>
        <div className="flex gap-2">
          {!isPublished && (
            <Button variant="outline" size="sm" onClick={() => save()}>Salvar</Button>
          )}
          {pesquisa.status === 'RASCUNHO' && (
            <Button size="sm" onClick={publicar} className="gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />Publicar
            </Button>
          )}
        </div>
      </div>

      {isPublished && (
        <div className="rounded-md bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 text-sm">
          Esta pesquisa está {pesquisa.status === 'PUBLICADA' ? 'publicada' : 'encerrada'} — as perguntas não podem ser editadas.
        </div>
      )}

      {/* Título e descrição */}
      {!isPublished && (
        <div className="rounded-lg border bg-background p-4 space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Título da pesquisa</label>
            <input
              className="w-full text-xl font-bold bg-transparent border-0 outline-none focus:ring-0 placeholder:text-muted-foreground/40 resize-none"
              value={titulo}
              onChange={e => { setTitulo(e.target.value); setDirty(true) }}
              placeholder="Título da pesquisa..."
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Descrição (opcional)</label>
            <textarea
              className="w-full text-sm bg-transparent border-0 outline-none focus:ring-0 resize-none placeholder:text-muted-foreground/40"
              rows={2}
              value={descricao}
              onChange={e => { setDescricao(e.target.value); setDirty(true) }}
              placeholder="Explique o objetivo desta pesquisa..."
            />
          </div>
        </div>
      )}

      {/* Campos */}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={campos.map(c => c.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {campos.map((c, i) => (
              isPublished
                ? (
                  <div key={c.id} className="rounded-lg border bg-muted/20 p-4">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground font-mono w-6">{i + 1}.</span>
                      <span className="font-medium flex-1">{c.label || <em className="text-muted-foreground">Sem texto</em>}</span>
                      {c.obrigatorio && <span className="text-destructive text-xs">*obrigatório</span>}
                      <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{TIPO_LABEL[c.tipo]}</span>
                    </div>
                    {HAS_OPTIONS.includes(c.tipo) && c.opcoes.length > 0 && (
                      <ul className="mt-2 ml-8 space-y-0.5">
                        {c.opcoes.map((op, j) => (
                          <li key={j} className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 inline-block" />{op}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
                : (
                  <SortableCampo
                    key={c.id}
                    campo={c}
                    onChange={updated => updateCampo(i, updated)}
                    onRemove={() => removeCampo(i)}
                    onDuplicate={() => duplicateCampo(i)}
                  />
                )
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {!isPublished && (
        <Button variant="outline" className="w-full gap-2" onClick={addCampo}>
          <Plus className="h-4 w-4" />
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          Adicionar pergunta
        </Button>
      )}

      {campos.length === 0 && !isPublished && (
        <p className="text-center text-sm text-muted-foreground py-4">
          Clique em "Adicionar pergunta" para começar a criar a pesquisa.
        </p>
      )}
    </div>
  )
}
