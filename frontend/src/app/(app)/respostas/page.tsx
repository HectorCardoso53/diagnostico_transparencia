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

interface Resposta {
  id: string
  status: string
  enviado_em: string | null
  revisado_em: string | null
  created_at: string
  formulario: { titulo: string } | null
  diretoria: { nome: string } | null
  usuario: { nome: string } | null
  revisado_por_usuario: { nome: string } | null
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'destructive'> = {
  RASCUNHO: 'secondary', ENVIADO: 'default', APROVADO: 'success', REPROVADO: 'destructive', EM_REVISAO: 'default',
}

export default function RespostasPage() {
  const [items, setItems] = useState<Resposta[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ form_id: '', diretoria_id: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    api.get<Resposta[]>('/respostas').then(setItems).catch(() => toast.error('Erro ao carregar respostas'))
  }, [])

  useEffect(() => { load() }, [load])

  async function create() {
    setSaving(true)
    try {
      await api.post('/respostas', { form_id: form.form_id, diretoria_id: form.diretoria_id, dados_json: {} })
      toast.success('Rascunho criado')
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
          <h1 className="text-2xl font-bold">Respostas</h1>
          <p className="text-sm text-muted-foreground mt-1">{items.length} registros</p>
        </div>
        <Button onClick={() => { setForm({ form_id: '', diretoria_id: '' }); setOpen(true) }} size="sm">
          <Plus className="h-4 w-4 mr-1" />Nova
        </Button>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {['Formulário', 'Diretoria', 'Usuário', 'Status', 'Enviado em', 'Revisado por', 'Criado em', 'Ações'].map((h) => (
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
                <td className="px-4 py-3"><Badge variant={STATUS_VARIANT[r.status] ?? 'secondary'}>{r.status}</Badge></td>
                <td className="px-4 py-3 text-muted-foreground">{r.enviado_em ? formatDate(r.enviado_em) : '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.revisado_por_usuario?.nome ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(r.created_at)}</td>
                <td className="px-4 py-3">
                  <Button size="icon" variant="ghost" asChild>
                    <Link href={`/respostas/${r.id}`}><Eye className="h-3.5 w-3.5" /></Link>
                  </Button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Nenhuma resposta encontrada</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Resposta</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>ID do Formulário *</Label>
              <Input value={form.form_id} onChange={(e) => setForm({ ...form, form_id: e.target.value })} placeholder="UUID do formulário publicado" />
            </div>
            <div className="space-y-1.5">
              <Label>ID da Diretoria *</Label>
              <Input value={form.diretoria_id} onChange={(e) => setForm({ ...form, diretoria_id: e.target.value })} placeholder="UUID da diretoria" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={create} disabled={saving}>{saving ? 'Criando...' : 'Criar Rascunho'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
