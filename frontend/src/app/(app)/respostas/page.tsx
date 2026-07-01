'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Eye, Plus, Trash2, ChevronDown, ChevronRight, Building2, FolderOpen } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Secretaria {
  id: string
  nome: string
  sigla: string
}

interface Diretoria {
  id: string
  nome: string
  secretaria?: Secretaria
}

interface Resposta {
  id: string
  status: string
  enviado_em: string | null
  created_at: string
  formulario: { titulo: string } | null
  diretoria: (Diretoria & { secretaria?: Secretaria }) | null
  usuario: { nome: string } | null
  revisado_por_usuario: { nome: string } | null
}

interface Formulario {
  id: string
  titulo: string
  status: string
}

interface DiretoriaOpcao {
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

/* Agrupa respostas: secretaria → diretoria → respostas */
function agrupar(items: Resposta[]) {
  const mapa = new Map<string, {
    secretaria: { id: string; nome: string; sigla: string }
    diretorias: Map<string, { diretoria: { id: string; nome: string }; respostas: Resposta[] }>
  }>()

  const SEM_SECRETARIA = '__sem_secretaria__'
  const SEM_DIRETORIA  = '__sem_diretoria__'

  for (const r of items) {
    const secId   = r.diretoria?.secretaria?.id   ?? SEM_SECRETARIA
    const secNome = r.diretoria?.secretaria?.nome  ?? '(sem secretaria)'
    const secSigla= r.diretoria?.secretaria?.sigla ?? ''
    const dirId   = r.diretoria?.id   ?? SEM_DIRETORIA
    const dirNome = r.diretoria?.nome ?? '(sem diretoria)'

    if (!mapa.has(secId)) {
      mapa.set(secId, { secretaria: { id: secId, nome: secNome, sigla: secSigla }, diretorias: new Map() })
    }
    const secEntry = mapa.get(secId)!
    if (!secEntry.diretorias.has(dirId)) {
      secEntry.diretorias.set(dirId, { diretoria: { id: dirId, nome: dirNome }, respostas: [] })
    }
    secEntry.diretorias.get(dirId)!.respostas.push(r)
  }

  return Array.from(mapa.values()).map(sec => ({
    ...sec,
    diretorias: Array.from(sec.diretorias.values()),
  }))
}

export default function RespostasPage() {
  const { user } = useAuth()
  const [items, setItems]       = useState<Resposta[]>([])
  const [formularios, setFormularios] = useState<Formulario[]>([])
  const [diretorias, setDiretorias]   = useState<DiretoriaOpcao[]>([])
  const [open, setOpen]         = useState(false)
  const [form, setForm]         = useState({ form_id: '', diretoria_id: '' })
  const [saving, setSaving]     = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Resposta | null>(null)
  const [deleting, setDeleting] = useState(false)

  // controle de seções abertas: secretaria e diretoria
  const [openSecs, setOpenSecs] = useState<Set<string>>(new Set())
  const [openDirs, setOpenDirs] = useState<Set<string>>(new Set())

  const load = useCallback(() => {
    api.get<Resposta[]>('/respostas').then(data => {
      setItems(data)
      // abre todas as seções por padrão na primeira carga
      const secs = new Set<string>()
      const dirs = new Set<string>()
      for (const r of data) {
        const secId = r.diretoria?.secretaria?.id ?? '__sem_secretaria__'
        const dirId = r.diretoria?.id ?? '__sem_diretoria__'
        secs.add(secId)
        dirs.add(`${secId}__${dirId}`)
      }
      setOpenSecs(secs)
      setOpenDirs(dirs)
    }).catch(() => toast.error('Erro ao carregar respostas'))
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    api.get<Formulario[]>('/formularios').then((list) =>
      setFormularios(list.filter((f) => f.status === 'PUBLICADO'))
    ).catch(() => {})
    api.get<DiretoriaOpcao[]>('/diretorias').then(setDiretorias).catch(() => {})
  }, [])

  function toggleSec(id: string) {
    setOpenSecs(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleDir(key: string) {
    setOpenDirs(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

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

  const grupos = agrupar(items)

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

      {grupos.length === 0 && (
        <div className="rounded-lg border px-4 py-10 text-center text-muted-foreground text-sm">
          Nenhuma resposta encontrada
        </div>
      )}

      <div className="space-y-3">
        {grupos.map(({ secretaria, diretorias: dirs }) => {
          const secOpen = openSecs.has(secretaria.id)
          const totalSec = dirs.reduce((s, d) => s + d.respostas.length, 0)

          return (
            <div key={secretaria.id} className="rounded-lg border overflow-hidden">
              {/* Cabeçalho da Secretaria */}
              <button
                onClick={() => toggleSec(secretaria.id)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-[#1a3a5c] text-white hover:bg-[#22496e] transition-colors text-left"
              >
                {secOpen
                  ? <ChevronDown className="h-4 w-4 shrink-0" />
                  : <ChevronRight className="h-4 w-4 shrink-0" />}
                <Building2 className="h-4 w-4 shrink-0 opacity-70" />
                <span className="font-semibold text-sm flex-1">{secretaria.nome}</span>
                <span className="text-xs text-white/60 shrink-0">
                  {totalSec} resposta{totalSec !== 1 ? 's' : ''}
                </span>
              </button>

              {/* Diretorias */}
              {secOpen && (
                <div className="divide-y">
                  {dirs.map(({ diretoria, respostas }) => {
                    const dirKey = `${secretaria.id}__${diretoria.id}`
                    const dirOpen = openDirs.has(dirKey)

                    return (
                      <div key={diretoria.id}>
                        {/* Cabeçalho da Diretoria */}
                        <button
                          onClick={() => toggleDir(dirKey)}
                          className="w-full flex items-center gap-3 px-5 py-2.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
                        >
                          {dirOpen
                            ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="text-sm font-medium flex-1">{diretoria.nome}</span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {respostas.length} resposta{respostas.length !== 1 ? 's' : ''}
                          </span>
                        </button>

                        {/* Tabela de Respostas */}
                        {dirOpen && (
                          <table className="w-full text-sm">
                            <thead className="bg-muted/20">
                              <tr>
                                {['Formulário', 'Usuário', 'Status', 'Enviado em', 'Criado em', ''].map((h) => (
                                  <th key={h} className="px-4 py-2 text-left font-medium text-muted-foreground text-xs">
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {respostas.map((r) => (
                                <tr key={r.id} className="hover:bg-muted/20">
                                  <td className="px-4 py-2.5 font-medium">{r.formulario?.titulo ?? '—'}</td>
                                  <td className="px-4 py-2.5 text-muted-foreground">{user?.nome ?? '—'}</td>
                                  <td className="px-4 py-2.5">
                                    <Badge variant={STATUS_VARIANT[r.status] ?? 'secondary'} className="text-[11px]">
                                      {STATUS_LABEL[r.status] ?? r.status}
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-2.5 text-muted-foreground text-xs">
                                    {r.enviado_em ? formatDate(r.enviado_em) : '—'}
                                  </td>
                                  <td className="px-4 py-2.5 text-muted-foreground text-xs">
                                    {formatDate(r.created_at)}
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <div className="flex gap-1 justify-end">
                                      <Button size="icon" variant="ghost" asChild className="h-7 w-7">
                                        <Link href={`/respostas/${r.id}`}><Eye className="h-3.5 w-3.5" /></Link>
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-destructive hover:text-destructive"
                                        onClick={() => setConfirmDelete(r)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
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
