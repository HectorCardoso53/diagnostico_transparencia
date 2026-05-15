'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Eye, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

interface Formulario {
  id: string
  titulo: string
  descricao: string | null
  status: string
  versao: number
  publicado_em: string | null
  created_at: string
  criador: { nome: string } | null
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'destructive'> = {
  RASCUNHO: 'secondary', PUBLICADO: 'success', ARQUIVADO: 'destructive',
}

const empty = { titulo: '', descricao: '', schema_json: '{}' }

export default function FormulariosPage() {
  const [items, setItems] = useState<Formulario[]>([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    api.get<Formulario[]>(`/formularios${search ? `?titulo=${search}` : ''}`)
      .then(setItems).catch(() => toast.error('Erro ao carregar formulários'))
  }, [search])

  useEffect(() => { load() }, [load])

  async function create() {
    setSaving(true)
    try {
      let schema: unknown
      try { schema = JSON.parse(form.schema_json) } catch { toast.error('Schema JSON inválido'); setSaving(false); return }
      await api.post('/formularios', { titulo: form.titulo, descricao: form.descricao || undefined, schema_json: schema })
      toast.success('Formulário criado')
      setOpen(false)
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
          <h1 className="text-2xl font-bold">Formulários</h1>
          <p className="text-sm text-muted-foreground mt-1">{items.length} registros</p>
        </div>
        <Button onClick={() => { setForm(empty); setOpen(true) }} size="sm">
          <Plus className="h-4 w-4 mr-1" />Novo
        </Button>
      </div>

      <Input placeholder="Buscar por título..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {['Título', 'Status', 'Versão', 'Criador', 'Publicado em', 'Criado em', 'Ações'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((f) => (
              <tr key={f.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{f.titulo}</td>
                <td className="px-4 py-3"><Badge variant={STATUS_VARIANT[f.status] ?? 'secondary'}>{f.status}</Badge></td>
                <td className="px-4 py-3 text-muted-foreground">v{f.versao}</td>
                <td className="px-4 py-3 text-muted-foreground">{f.criador?.nome ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{f.publicado_em ? formatDate(f.publicado_em) : '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(f.created_at)}</td>
                <td className="px-4 py-3">
                  <Button size="icon" variant="ghost" asChild>
                    <Link href={`/formularios/${f.id}`}><Eye className="h-3.5 w-3.5" /></Link>
                  </Button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nenhum formulário encontrado</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo Formulário</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5"><Label>Título *</Label><Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Descrição</Label><Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={2} /></div>
            <div className="space-y-1.5">
              <Label>Schema JSON *</Label>
              <Textarea
                value={form.schema_json}
                onChange={(e) => setForm({ ...form, schema_json: e.target.value })}
                rows={6}
                className="font-mono text-xs"
                placeholder='{"campos": [{"nome": "campo1", "tipo": "texto", "label": "Campo 1"}]}'
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={create} disabled={saving}>{saving ? 'Salvando...' : 'Criar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
