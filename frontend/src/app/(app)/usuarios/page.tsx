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
  secretaria: { id: string; nome: string } | null
  diretoria: { id: string; nome: string } | null
}

interface Secretaria { id: string; nome: string; sigla: string }
interface Diretoria { id: string; nome: string; sigla: string; secretaria_id: string }

const ROLES = ['ADMIN', 'SECRETARIO']
const NONE = '__none__'

const emptyForm = { nome: '', email: '', senha: '', role: 'SECRETARIO', secretaria_id: NONE, diretoria_id: NONE }

export default function UsuariosPage() {
  const [items, setItems] = useState<Usuario[]>([])
  const [secretarias, setSecretarias] = useState<Secretaria[]>([])
  const [diretorias, setDiretorias] = useState<Diretoria[]>([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Usuario | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    const q = new URLSearchParams({ ativo: 'true' })
    if (search) q.set('nome', search)
    api.get<Usuario[]>(`/usuarios?${q}`)
      .then(setItems).catch(() => toast.error('Erro ao carregar usuários'))
  }, [search])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    api.get<Secretaria[]>('/secretarias?ativo=true').then(setSecretarias).catch(() => {})
    api.get<Diretoria[]>('/diretorias?ativo=true').then(setDiretorias).catch(() => {})
  }, [])

  const diretoriasFiltradas = form.secretaria_id && form.secretaria_id !== NONE
    ? diretorias.filter((d) => d.secretaria_id === form.secretaria_id)
    : diretorias

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setOpen(true)
  }

  function openEdit(u: Usuario) {
    setEditing(u)
    setForm({
      nome: u.nome,
      email: u.email,
      senha: '',
      role: u.role,
      secretaria_id: u.secretaria?.id ?? NONE,
      diretoria_id: u.diretoria?.id ?? NONE,
    })
    setOpen(true)
  }

  function setSecretaria(val: string) {
    setForm((f) => ({ ...f, secretaria_id: val, diretoria_id: NONE }))
  }

  async function save() {
    setSaving(true)
    try {
      if (editing) {
        const payload: Record<string, unknown> = { nome: form.nome, email: form.email, role: form.role }
        if (form.senha) payload.senha = form.senha
        if (form.secretaria_id && form.secretaria_id !== NONE) payload.secretaria_id = form.secretaria_id
        if (form.diretoria_id && form.diretoria_id !== NONE) payload.diretoria_id = form.diretoria_id
        await api.patch(`/usuarios/${editing.id}`, payload)
        toast.success('Usuário atualizado')
      } else {
        const payload: Record<string, unknown> = {
          nome: form.nome,
          email: form.email,
          senha: form.senha,
          role: form.role,
        }
        if (form.secretaria_id !== NONE) payload.secretaria_id = form.secretaria_id
        if (form.diretoria_id !== NONE) payload.diretoria_id = form.diretoria_id
        await api.post('/usuarios', payload)
        toast.success('Usuário criado')
      }
      setOpen(false)
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    try {
      await api.delete(`/usuarios/${id}`)
      toast.success('Usuário removido')
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    }
  }

  const roleColor: Record<string, 'default' | 'secondary' | 'success'> = {
    ADMIN: 'default', SECRETARIO: 'success',
  }

  const canSave = form.nome.trim() && form.email.trim() && (editing || form.senha.trim())

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Usuários</h1>
          <p className="text-sm text-muted-foreground mt-1">{items.length} usuário{items.length !== 1 ? 's' : ''} ativo{items.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" />Novo usuário
        </Button>
      </div>

      <Input placeholder="Buscar por nome..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {['Nome', 'E-mail', 'Role', 'Secretaria', 'Diretoria', 'Criado em', 'Ações'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((u) => (
              <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium">{u.nome}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3"><Badge variant={roleColor[u.role] ?? 'secondary'}>{u.role}</Badge></td>
                <td className="px-4 py-3 text-muted-foreground">{u.secretaria?.nome ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.diretoria?.nome ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(u.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(u)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(u.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nenhum usuário encontrado</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{editing ? 'Nova senha (deixe vazio para manter)' : 'Senha *'}</Label>
              <Input type="password" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Role *</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Secretaria</Label>
                <Select value={form.secretaria_id} onValueChange={setSecretaria}>
                  <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Nenhuma</SelectItem>
                    {secretarias.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome} ({s.sigla})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Diretoria</Label>
                <Select value={form.diretoria_id} onValueChange={(v) => setForm({ ...form, diretoria_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Nenhuma</SelectItem>
                    {diretoriasFiltradas.map((d) => <SelectItem key={d.id} value={d.id}>{d.nome} ({d.sigla})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving || !canSave}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
