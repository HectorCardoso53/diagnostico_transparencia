'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'

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

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'destructive'> = {
  RASCUNHO: 'secondary', PUBLICADO: 'success', ARQUIVADO: 'destructive',
}

export default function FormularioDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [id, setId] = useState('')
  const [formulario, setFormulario] = useState<Formulario | null>(null)
  const [editSchema, setEditSchema] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [atribOpen, setAtribOpen] = useState(false)
  const [atribForm, setAtribForm] = useState({ diretoria_id: '', prazo: '' })
  const [atribSaving, setAtribSaving] = useState(false)

  useEffect(() => {
    params.then((p) => setId(p.id))
  }, [params])

  const load = useCallback(() => {
    if (!id) return
    api.get<Formulario>(`/formularios/${id}`)
      .then((f) => {
        setFormulario(f)
        setEditTitle(f.titulo)
        setEditDesc(f.descricao ?? '')
        setEditSchema(JSON.stringify(f.schema_json, null, 2))
      })
      .catch(() => toast.error('Erro ao carregar formulário'))
  }, [id])

  useEffect(() => { load() }, [load])

  async function saveChanges() {
    if (!formulario) return
    setSaving(true)
    try {
      let schema: unknown
      try { schema = JSON.parse(editSchema) } catch { toast.error('Schema JSON inválido'); setSaving(false); return }
      await api.patch(`/formularios/${formulario.id}`, { titulo: editTitle, descricao: editDesc || undefined, schema_json: schema })
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
    try {
      await api.post(`/formularios/${formulario.id}/publicar`, {})
      toast.success('Formulário publicado')
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro')
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

  if (!formulario) return <div className="p-6 text-muted-foreground">Carregando...</div>

  const isRascunho = formulario.status === 'RASCUNHO'

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/formularios')}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{formulario.titulo}</h1>
            <Badge variant={STATUS_VARIANT[formulario.status] ?? 'secondary'}>{formulario.status}</Badge>
            <span className="text-sm text-muted-foreground">v{formulario.versao}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Criado por {formulario.criador?.nome ?? '—'} em {formatDate(formulario.created_at)}
          </p>
        </div>
        <div className="flex gap-2">
          {isRascunho && (
            <>
              <Button onClick={saveChanges} disabled={saving} variant="outline">{saving ? 'Salvando...' : 'Salvar'}</Button>
              <Button onClick={publicar}><Send className="h-4 w-4 mr-1" />Publicar</Button>
            </>
          )}
          {formulario.status === 'PUBLICADO' && (
            <Button variant="destructive" onClick={arquivar}>Arquivar</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Configuração</h2>
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} disabled={!isRascunho} />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2} disabled={!isRascunho} />
          </div>
          <div className="space-y-1.5">
            <Label>Schema JSON</Label>
            <Textarea
              value={editSchema}
              onChange={(e) => setEditSchema(e.target.value)}
              rows={12}
              className="font-mono text-xs"
              disabled={!isRascunho}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Atribuições</h2>
            {formulario.status === 'PUBLICADO' && (
              <Button size="sm" variant="outline" onClick={() => { setAtribForm({ diretoria_id: '', prazo: '' }); setAtribOpen(true) }}>
                <Plus className="h-3.5 w-3.5 mr-1" />Atribuir
              </Button>
            )}
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

      <Dialog open={atribOpen} onOpenChange={setAtribOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Atribuir Diretoria</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>ID da Diretoria *</Label>
              <Input value={atribForm.diretoria_id} onChange={(e) => setAtribForm({ ...atribForm, diretoria_id: e.target.value })} placeholder="UUID" />
            </div>
            <div className="space-y-1.5">
              <Label>Prazo</Label>
              <Input type="datetime-local" value={atribForm.prazo} onChange={(e) => setAtribForm({ ...atribForm, prazo: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAtribOpen(false)}>Cancelar</Button>
            <Button onClick={adicionarAtribuicao} disabled={atribSaving}>{atribSaving ? 'Atribuindo...' : 'Atribuir'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
