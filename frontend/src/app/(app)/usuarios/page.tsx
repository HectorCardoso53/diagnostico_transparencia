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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Usuario {
  id: string
  nome: string
  email: string
  role: string
  ativo: boolean
  created_at: string
  secretaria: { nome: string } | null
  diretoria: { nome: string } | null
}

const ROLES = ['SUPER_ADMIN', 'ADMIN', 'SECRETARIO', 'DIRETOR', 'OPERADOR']
const empty = { nome: '', email: '', senha: '', role: 'OPERADOR', secretaria_id: '', diretoria_id: '' }

export default function UsuariosPage() {
  const [items, setItems] = useState<Usuario[]>([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Usuario | null>(null)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    api.get<Usuario[]>(`/usuarios${search ? `?nome=${search}` : ''}`)
      .then(setItems).catch(() => toast.error('Erro ao carregar usuários'))
  }, [search])

  useEffect(() => { load() }, [load])

  function openEdit(u: Usuario) {
    setEditing(u)
    setForm({ nome: u.nome, email: u.email, senha: '', role: u.role, secretaria_id: '', diretoria_id: '' })
    setOpen(true)
  }

  async function save() {
    setSaving(true)
    try {
      const payload = editing
        ? { nome: form.nome, email: form.email, role: form.role, ...(form.senha ? { senha: form.senha } : {}) }
        : form
      if (editing) {
        await api.patch(`/usuarios/${editing.id}`, payload)
      } else {
        await api.post('/usuarios', payload)
      }
      toast.success('Salvo com sucesso')
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
      await api.delete(`/usuarios/${id}`)
      toast.success('Usuário desativado')
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    }
  }

  const roleColor: Record<string, 'default' | 'secondary' | 'success'> = {
    SUPER_ADMIN: 'default', ADMIN: 'default', SECRETARIO: 'success', DIRETOR: 'success', OPERADOR: 'secondary',
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Usuários</h1>
          <p className="text-sm text-muted-foreground mt-1">{items.length} registros</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm(empty); setOpen(true) }} size="sm">
          <Plus className="h-4 w-4 mr-1" />Novo
        </Button>
      </div>

      <Input placeholder="Buscar por nome..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {['Nome', 'E-mail', 'Role', 'Secretaria', 'Diretoria', 'Status', 'Criado em', 'Ações'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((u) => (
              <tr key={u.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{u.nome}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3"><Badge variant={roleColor[u.role] ?? 'secondary'}>{u.role}</Badge></td>
                <td className="px-4 py-3 text-muted-foreground">{u.secretaria?.nome ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.diretoria?.nome ?? '—'}</td>
                <td className="px-4 py-3"><Badge variant={u.ativo ? 'success' : 'secondary'}>{u.ativo ? 'Ativo' : 'Inativo'}</Badge></td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(u.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(u)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => deactivate(u.id)} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Nenhum usuário encontrado</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2"><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
              <div className="space-y-1.5 col-span-2"><Label>E-mail *</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="space-y-1.5 col-span-2">
                <Label>{editing ? 'Nova Senha (deixe vazio para manter)' : 'Senha *'}</Label>
                <Input type="password" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Role *</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {!editing && (
                <>
                  <div className="space-y-1.5">
                    <Label>ID da Secretaria</Label>
                    <Input value={form.secretaria_id} onChange={(e) => setForm({ ...form, secretaria_id: e.target.value })} placeholder="UUID" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>ID da Diretoria</Label>
                    <Input value={form.diretoria_id} onChange={(e) => setForm({ ...form, diretoria_id: e.target.value })} placeholder="UUID" />
                  </div>
                </>
              )}
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
