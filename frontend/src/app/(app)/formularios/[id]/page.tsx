'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Send, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
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

const TIPOS: { value: TipoCampo; label: string }[] = [
  { value: 'texto', label: 'Resposta curta' },
  { value: 'paragrafo', label: 'Parágrafo' },
  { value: 'multipla_escolha', label: 'Múltipla escolha' },
  { value: 'caixa_selecao', label: 'Caixas de seleção' },
  { value: 'lista_suspensa', label: 'Lista suspensa' },
  { value: 'numero', label: 'Número' },
  { value: 'data', label: 'Data' },
]

const TIPOS_COM_OPCOES: TipoCampo[] = ['multipla_escolha', 'caixa_selecao', 'lista_suspensa']

interface CampoBuilder {
  id: string
  tipo: TipoCampo
  label: string
  obrigatorio: boolean
  opcoes: string[]
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

function newCampo(): CampoBuilder {
  return { id: crypto.randomUUID(), tipo: 'texto', label: '', obrigatorio: false, opcoes: [] }
}

function schemaToBuilder(schema: Record<string, unknown>): CampoBuilder[] {
  const campos = schema.campos as Array<Record<string, unknown>> | undefined
  if (!Array.isArray(campos)) return []
  return campos.map((c) => ({
    id: String(c.id ?? crypto.randomUUID()),
    tipo: (c.tipo as TipoCampo) ?? 'texto',
    label: String(c.label ?? ''),
    obrigatorio: Boolean(c.obrigatorio ?? false),
    opcoes: Array.isArray(c.opcoes) ? (c.opcoes as unknown[]).map(String) : [],
  }))
}

function builderToSchema(campos: CampoBuilder[]): Record<string, unknown> {
  return {
    campos: campos.map(({ id, tipo, label, obrigatorio, opcoes }) => ({
      id,
      tipo,
      label,
      obrigatorio,
      ...(TIPOS_COM_OPCOES.includes(tipo) ? { opcoes } : {}),
    })),
  }
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
          {campos.map((campo, idx) => (
            <div key={campo.id} className="rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow p-5 space-y-4">

              {/* Linha superior: label + tipo + excluir */}
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-3">
                  <Input
                    placeholder={`Pergunta ${idx + 1}`}
                    value={campo.label}
                    onChange={(e) => updateCampo(campo.id, { label: e.target.value })}
                    disabled={!canEdit}
                    className="font-medium text-base"
                  />
                  <Select
                    value={campo.tipo}
                    onValueChange={(v) => updateCampo(campo.id, { tipo: v as TipoCampo, opcoes: [] })}
                    disabled={!canEdit}
                  >
                    <SelectTrigger className="w-52">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {canEdit && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive shrink-0 mt-1"
                    onClick={() => removeCampo(campo.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Preview do tipo de campo */}
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

                {TIPOS_COM_OPCOES.includes(campo.tipo) && (
                  <div className="space-y-2">
                    {campo.opcoes.map((opcao, i) => (
                      <div key={i} className="flex items-center gap-2">
                        {/* Indicador visual do tipo */}
                        <div
                          className="shrink-0 w-4 h-4 border-2 border-muted-foreground bg-background"
                          style={{ borderRadius: campo.tipo === 'caixa_selecao' ? '4px' : campo.tipo === 'multipla_escolha' ? '50%' : '2px' }}
                        />
                        <Input
                          value={opcao}
                          onChange={(e) => updateOpcao(campo.id, i, e.target.value)}
                          placeholder={`Opção ${i + 1}`}
                          disabled={!canEdit}
                          className="h-8 max-w-xs"
                        />
                        {canEdit && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => removeOpcao(campo.id, i)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {canEdit && (
                      <button
                        onClick={() => addOpcao(campo.id)}
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

              {/* Rodapé: obrigatório */}
              <div className="flex items-center justify-end pt-2 border-t">
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={campo.obrigatorio}
                    onChange={(e) => updateCampo(campo.id, { obrigatorio: e.target.checked })}
                    disabled={!canEdit}
                    className="h-4 w-4 rounded"
                  />
                  Obrigatório
                </label>
              </div>
            </div>
          ))}

          {/* Botão adicionar pergunta */}
          {canEdit && (
            <button
              onClick={addCampo}
              className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/30 p-5 text-sm text-muted-foreground hover:border-[#0f1b2d]/50 hover:text-[#0f1b2d] transition-colors"
            >
              <Plus className="h-4 w-4" />
              Adicionar pergunta
            </button>
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
