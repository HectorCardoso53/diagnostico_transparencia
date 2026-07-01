'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Plus, Trash2, BarChart2, Eye, Copy, CheckCheck,
  Clock, CheckCircle2, XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface Pesquisa {
  id: string
  titulo: string
  descricao: string | null
  status: 'RASCUNHO' | 'PUBLICADA' | 'ENCERRADA'
  publicado_em: string | null
  encerrado_em: string | null
  created_at: string
  criador: { nome: string } | null
  _count: { respostas: number }
}

const STATUS_LABEL: Record<string, string> = {
  RASCUNHO: 'Rascunho', PUBLICADA: 'Publicada', ENCERRADA: 'Encerrada',
}
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'destructive'> = {
  RASCUNHO: 'secondary', PUBLICADA: 'success', ENCERRADA: 'destructive',
}
function StatusIcon({ status }: { status: string }) {
  if (status === 'PUBLICADA') return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
  if (status === 'ENCERRADA') return <XCircle className="h-3.5 w-3.5 text-red-500" />
  return <Clock className="h-3.5 w-3.5 text-muted-foreground" />
}

export default function PesquisasPage() {
  const router = useRouter()
  const [items, setItems]       = useState<Pesquisa[]>([])
  const [open, setOpen]         = useState(false)
  const [titulo, setTitulo]     = useState('')
  const [descricao, setDescricao] = useState('')
  const [saving, setSaving]     = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Pesquisa | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const load = useCallback(() => {
    api.get<Pesquisa[]>('/pesquisas')
      .then(setItems)
      .catch(() => toast.error('Erro ao carregar pesquisas'))
  }, [])

  useEffect(() => { load() }, [load])

  async function create() {
    if (!titulo.trim()) return
    setSaving(true)
    try {
      const nova = await api.post<{ id: string }>('/pesquisas', {
        titulo: titulo.trim(),
        descricao: descricao.trim() || undefined,
      })
      toast.success('Pesquisa criada')
      setOpen(false)
      setTitulo('')
      setDescricao('')
      router.push(`/pesquisas/${nova.id}`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao criar pesquisa')
    } finally { setSaving(false) }
  }

  async function publicar(p: Pesquisa) {
    try {
      await api.post(`/pesquisas/${p.id}/publicar`, {})
      toast.success('Pesquisa publicada! O link público está disponível.')
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    }
  }

  async function encerrar(p: Pesquisa) {
    if (!confirm(`Encerrar a pesquisa "${p.titulo}"? Não será possível receber novas respostas.`)) return
    try {
      await api.post(`/pesquisas/${p.id}/encerrar`, {})
      toast.success('Pesquisa encerrada')
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    }
  }

  async function excluir() {
    if (!confirmDelete) return
    setDeleting(true)
    try {
      await api.delete(`/pesquisas/${confirmDelete.id}`)
      toast.success('Pesquisa excluída')
      setConfirmDelete(null)
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    } finally { setDeleting(false) }
  }

  function copiarLink(id: string) {
    const url = `${window.location.origin}/pesquisa/${id}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id)
      toast.success('Link copiado!')
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pesquisas de Opinião</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {items.length} pesquisa{items.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" />Nova pesquisa
        </Button>
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {items.length === 0 && (
          <div className="rounded-lg border px-4 py-12 text-center text-muted-foreground">
            <BarChart2 className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Nenhuma pesquisa criada</p>
            <p className="text-sm mt-1">Crie uma pesquisa de opinião para coletar respostas públicas.</p>
          </div>
        )}

        {items.map(p => (
          <div key={p.id} className="rounded-lg border bg-background p-4 flex items-start gap-4">
            <StatusIcon status={p.status} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">{p.titulo}</span>
                <Badge variant={STATUS_VARIANT[p.status] ?? 'secondary'} className="text-[11px]">
                  {STATUS_LABEL[p.status]}
                </Badge>
              </div>
              {p.descricao && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{p.descricao}</p>
              )}
              <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground flex-wrap">
                <span>{p._count.respostas} resposta{p._count.respostas !== 1 ? 's' : ''}</span>
                {p.publicado_em && <span>Publicada em {formatDate(p.publicado_em)}</span>}
                {p.encerrado_em && <span>Encerrada em {formatDate(p.encerrado_em)}</span>}
                {!p.publicado_em && <span>Criada em {formatDate(p.created_at)}</span>}
                {p.criador && <span>por {p.criador.nome}</span>}
              </div>
            </div>

            {/* Ações */}
            <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
              {p.status === 'PUBLICADA' && (
                <Button
                  size="sm" variant="outline"
                  className="h-8 text-xs gap-1"
                  onClick={() => copiarLink(p.id)}
                >
                  {copiedId === p.id
                    ? <><CheckCheck className="h-3.5 w-3.5 text-green-500" />Copiado</>
                    : <><Copy className="h-3.5 w-3.5" />Copiar link</>}
                </Button>
              )}
              {p._count.respostas > 0 && (
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1" asChild>
                  <Link href={`/pesquisas/${p.id}/resultados`}>
                    <BarChart2 className="h-3.5 w-3.5" />Resultados
                  </Link>
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1" asChild>
                <Link href={`/pesquisas/${p.id}`}>
                  <Eye className="h-3.5 w-3.5" />Editar
                </Link>
              </Button>
              {p.status === 'RASCUNHO' && (
                <Button size="sm" className="h-8 text-xs" onClick={() => publicar(p)}>
                  Publicar
                </Button>
              )}
              {p.status === 'PUBLICADA' && (
                <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={() => encerrar(p)}>
                  Encerrar
                </Button>
              )}
              <Button
                size="icon" variant="ghost"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => setConfirmDelete(p)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal criar */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Pesquisa de Opinião</DialogTitle>
            <DialogDescription>
              Após criar, você poderá adicionar as perguntas e publicar o link público.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                placeholder="Ex: Pesquisa de Clima Organizacional 2026"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                rows={2}
                placeholder="Objetivo da pesquisa..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={create} disabled={saving || !titulo.trim()}>
              {saving ? 'Criando...' : 'Criar e editar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal excluir */}
      <Dialog open={!!confirmDelete} onOpenChange={v => { if (!v) setConfirmDelete(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir pesquisa</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir{' '}
            <span className="font-medium text-foreground">"{confirmDelete?.titulo}"</span>?
            Todas as {confirmDelete?._count.respostas} respostas serão removidas permanentemente.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={deleting}>Cancelar</Button>
            <Button variant="destructive" onClick={excluir} disabled={deleting}>
              {deleting ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
