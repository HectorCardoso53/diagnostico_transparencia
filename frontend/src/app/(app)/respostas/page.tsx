'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Eye, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Resposta {
  id: string
  status: string
  enviado_em: string | null
  created_at: string
  formulario: { titulo: string } | null
  diretoria: { nome: string } | null
  usuario: { nome: string } | null
  revisado_por_usuario: { nome: string } | null
}

interface Formulario {
  id: string
  titulo: string
  status: string
}

interface Diretoria {
  id: string
  nome: string
  secretaria?: { nome: string }
}

const STATUS_LABEL: Record<string, string> = {
  RASCUNHO: 'Rascunho', ENVIADO: 'Enviado', APROVADO: 'Aprovado',
  REPROVADO: 'Reprovado', EM_REVISAO: 'Em revisão',
}
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'destructive'> = {
  RASCUNHO: 'secondary', ENVIADO: 'default', APROVADO: 'success',
  REPROVADO: 'destructive', EM_REVISAO: 'default',
}

export default function RespostasPage() {
  const [items, setItems] = useState<Resposta[]>([])
  const [formularios, setFormularios] = useState<Formulario[]>([])
  const [diretorias, setDiretorias] = useState<Diretoria[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ form_id: '', diretoria_id: '' })
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Resposta | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(() => {
    api.get<Resposta[]>('/respostas').then(setItems).catch(() => toast.error('Erro ao carregar respostas'))
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    api.get<Formulario[]>('/formularios').then((list) =>
      setFormularios(list.filter((f) => f.status === 'PUBLICADO'))
    ).catch(() => {})
    api.get<Diretoria[]>('/diretorias').then(setDiretorias).catch(() => {})
  }, [])

  async function remove() {
    if (!confirmDelete) return
    setDeleting(true)
    try {
      await api.delete(`/respostas/${confirmDelete.id}`)
      toast.success('Resposta excluída')
      setConfirmDelete(null)
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao excluir')
    } finally {
      setDeleting(false)
    }
  }

  async function create() {
    setSaving(true)
    try {
      await api.post('/respostas', { form_id: form.form_id, diretoria_id: form.diretoria_id, dados_json: {} })
      toast.success('Rascunho criado')
      setOpen(false)
      setForm({ form_id: '', diretoria_id: '' })
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Respostas</h1>
          <p className="text-sm text-muted-foreground mt-1">{items.length} resposta{items.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => { setForm({ form_id: '', diretoria_id: '' }); setOpen(true) }} size="sm">
          <Plus className="h-4 w-4 mr-1" />Nova resposta
        </Button>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {['Formulário', 'Diretoria', 'Usuário', 'Status', 'Enviado em', 'Revisado por', 'Criado em', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((r) => (
              <tr key={r.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{r.formulario?.titulo ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.diretoria?.nome ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.usuario?.nome ?? '—'}</td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_VARIANT[r.status] ?? 'secondary'}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{r.enviado_em ? formatDate(r.enviado_em) : '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.revisado_por_usuario?.nome ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(r.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" asChild>
                      <Link href={`/respostas/${r.id}`}><Eye className="h-3.5 w-3.5" /></Link>
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setConfirmDelete(r)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  Nenhuma resposta encontrada
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Confirmação de exclusão */}
      <Dialog open={!!confirmDelete} onOpenChange={(v) => { if (!v) setConfirmDelete(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir resposta</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir a resposta de{' '}
            <span className="font-medium text-foreground">{confirmDelete?.diretoria?.nome ?? '—'}</span>{' '}
            para o formulário{' '}
            <span className="font-medium text-foreground">{confirmDelete?.formulario?.titulo ?? '—'}</span>?
            Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={deleting}>Cancelar</Button>
            <Button variant="destructive" onClick={remove} disabled={deleting}>
              {deleting ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Resposta</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Formulário *</Label>
              <Select value={form.form_id} onValueChange={(v) => setForm({ ...form, form_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um formulário publicado..." />
                </SelectTrigger>
                <SelectContent>
                  {formularios.length === 0 && (
                    <SelectItem value="__none__" disabled>Nenhum formulário publicado</SelectItem>
                  )}
                  {formularios.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.titulo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Diretoria *</Label>
              <Select value={form.diretoria_id} onValueChange={(v) => setForm({ ...form, diretoria_id: v })}>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={create} disabled={saving || !form.form_id || !form.diretoria_id}>
              {saving ? 'Criando...' : 'Criar rascunho'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
