'use client'

import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Diretoria {
  id: string
  nome: string
  sigla: string | null
  responsavel: string | null
  ativo: boolean
  created_at: string
  secretaria: { id: string; nome: string } | null
}

interface Secretaria {
  id: string
  nome: string
  sigla: string
}

const empty = { secretaria_id: '', nome: '', sigla: '', responsavel: '' }

export default function DiretoriasPage() {
  const [items, setItems] = useState<Diretoria[]>([])
  const [secretarias, setSecretarias] = useState<Secretaria[]>([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Diretoria | null>(null)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    const q = new URLSearchParams({ ativo: 'true' })
    if (search) q.set('nome', search)
    api.get<Diretoria[]>(`/diretorias?${q}`)
      .then(setItems)
      .catch(() => toast.error('Erro ao carregar diretorias'))
  }, [search])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    api.get<Secretaria[]>('/secretarias?ativo=true')
      .then(setSecretarias)
      .catch(() => {})
  }, [])

  function openCreate() {
    setEditing(null)
    setForm(empty)
    setOpen(true)
  }

  function openEdit(d: Diretoria) {
    setEditing(d)
    setForm({ secretaria_id: '', nome: d.nome, sigla: d.sigla ?? '', responsavel: d.responsavel ?? '' })
    setOpen(true)
  }

  async function save() {
    setSaving(true)
    try {
      if (editing) {
        const { secretaria_id: _s, ...rest } = form
        const payload = Object.fromEntries(
          Object.entries(rest).filter(([, v]) => v !== '')
        )
        await api.patch(`/diretorias/${editing.id}`, payload)
        toast.success('Diretoria atualizada')
      } else {
        await api.post('/diretorias', form)
        toast.success('Diretoria criada')
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
      await api.delete(`/diretorias/${id}`)
      toast.success('Diretoria removida')
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Diretorias</h1>
          <p className="text-sm text-muted-foreground mt-1">{items.length} diretoria{items.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" />Nova diretoria
        </Button>
      </div>

      <Input
        placeholder="Buscar por nome..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-xs"
      />

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {['Nome', 'Secretaria', 'Responsável', 'Criado em', 'Ações'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((d) => (
              <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium">{d.nome}</td>
                <td className="px-4 py-3 text-muted-foreground">{d.secretaria?.nome ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{d.responsavel ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(d.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(d)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(d.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  Nenhuma diretoria encontrada
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Diretoria' : 'Nova Diretoria'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {!editing && (
              <div className="space-y-1.5">
                <Label>Secretaria *</Label>
                <Select
                  value={form.secretaria_id}
                  onValueChange={(v) => setForm({ ...form, secretaria_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a secretaria..." />
                  </SelectTrigger>
                  <SelectContent>
                    {secretarias.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nome} ({s.sigla})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Sigla</Label>
                <Input value={form.sigla} onChange={(e) => setForm({ ...form, sigla: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Responsável</Label>
              <Input value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              onClick={save}
              disabled={saving || !form.nome || (!editing && !form.secretaria_id)}
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
