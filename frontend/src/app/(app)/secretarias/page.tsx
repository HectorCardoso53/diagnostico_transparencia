'use client'

import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface Secretaria {
  id: string
  nome: string
  sigla: string
  responsavel: string | null
  email: string | null
  ativo: boolean
  created_at: string
  municipio: { nome: string; uf: string } | null
}

const empty = { nome: '', sigla: '', responsavel: '', email: '', telefone: '' }

export default function SecretariasPage() {
  const [items, setItems] = useState<Secretaria[]>([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Secretaria | null>(null)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    const q = new URLSearchParams({ ativo: 'true' })
    if (search) q.set('nome', search)
    api.get<Secretaria[]>(`/secretarias?${q}`)
      .then(setItems)
      .catch(() => toast.error('Erro ao carregar secretarias'))
  }, [search])

  useEffect(() => { load() }, [load])

  function openCreate() { setEditing(null); setForm(empty); setOpen(true) }
  function openEdit(s: Secretaria) {
    setEditing(s)
    setForm({ nome: s.nome, sigla: s.sigla, responsavel: s.responsavel ?? '', email: s.email ?? '', telefone: '' })
    setOpen(true)
  }

  async function save() {
    setSaving(true)
    try {
      if (editing) {
        const payload = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ''))
        await api.patch(`/secretarias/${editing.id}`, payload)
        toast.success('Secretaria atualizada')
      } else {
        await api.post('/secretarias', form)
        toast.success('Secretaria criada')
      }
      setOpen(false)
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    } finally {
      setSaving(false)
    }
  }

  async function deactivate(id: string) {
    try {
      await api.delete(`/secretarias/${id}`)
      toast.success('Secretaria desativada')
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Secretarias</h1>
          <p className="text-sm text-muted-foreground mt-1">{items.length} registros</p>
        </div>
        <Button onClick={openCreate} size="sm"><Plus className="h-4 w-4 mr-1" />Nova</Button>
      </div>

      <Input placeholder="Buscar por nome..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {['Nome', 'Sigla', 'Responsável', 'Status', 'Criado em', 'Ações'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((s) => (
              <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium">{s.nome}</td>
                <td className="px-4 py-3">{s.sigla}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.responsavel ?? '—'}</td>
                <td className="px-4 py-3">
                  <Badge variant={s.ativo ? 'success' : 'secondary'}>{s.ativo ? 'Ativo' : 'Inativo'}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(s.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => deactivate(s.id)} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhuma secretaria encontrada</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Editar Secretaria' : 'Nova Secretaria'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            {!editing && (
              <p className="text-xs text-muted-foreground bg-muted px-3 py-2 rounded-md">
                Município: <strong>Oriximiná — PA</strong>
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Sigla *</Label>
                <Input value={form.sigla} onChange={(e) => setForm({ ...form, sigla: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Responsável</Label>
              <Input value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
