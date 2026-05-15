'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Send } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'

interface Campo {
  nome: string
  tipo: 'texto' | 'numero' | 'data' | 'booleano' | 'textarea' | 'select'
  label: string
  obrigatorio?: boolean
  opcoes?: string[]
}

interface Resposta {
  id: string
  status: string
  dados_json: Record<string, unknown>
  observacoes: string | null
  enviado_em: string | null
  revisado_em: string | null
  created_at: string
  formulario: { id: string; titulo: string; schema_json: { campos?: Campo[] } } | null
  diretoria: { nome: string } | null
  usuario: { nome: string } | null
  revisado_por_usuario: { nome: string } | null
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'destructive'> = {
  RASCUNHO: 'secondary', ENVIADO: 'default', APROVADO: 'success', REPROVADO: 'destructive', EM_REVISAO: 'default',
}

const REVIEW_STATUS = ['APROVADO', 'REPROVADO', 'EM_REVISAO']

export default function RespostaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [id, setId] = useState('')
  const [resposta, setResposta] = useState<Resposta | null>(null)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)
  const [reviewStatus, setReviewStatus] = useState('APROVADO')
  const [observacoes, setObservacoes] = useState('')
  const [reviewing, setReviewing] = useState(false)

  useEffect(() => {
    params.then((p) => setId(p.id))
  }, [params])

  const load = useCallback(() => {
    if (!id) return
    api.get<Resposta>(`/respostas/${id}`)
      .then((r) => {
        setResposta(r)
        setAnswers(r.dados_json ?? {})
        setObservacoes(r.observacoes ?? '')
      })
      .catch(() => toast.error('Erro ao carregar resposta'))
  }, [id])

  useEffect(() => { load() }, [load])

  async function salvarRascunho() {
    if (!resposta) return
    setSaving(true)
    try {
      await api.patch(`/respostas/${resposta.id}`, { dados_json: answers })
      toast.success('Rascunho salvo')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    } finally {
      setSaving(false)
    }
  }

  async function enviar() {
    if (!resposta) return
    setSaving(true)
    try {
      await api.patch(`/respostas/${resposta.id}`, { dados_json: answers })
      await api.post(`/respostas/${resposta.id}/enviar`, {})
      toast.success('Resposta enviada')
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    } finally {
      setSaving(false)
    }
  }

  async function revisar() {
    if (!resposta) return
    setReviewing(true)
    try {
      await api.post(`/respostas/${resposta.id}/revisar`, { status: reviewStatus, observacoes: observacoes || undefined })
      toast.success('Revisão registrada')
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    } finally {
      setReviewing(false)
    }
  }

  function setAnswer(nome: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [nome]: value }))
  }

  if (!resposta) return <div className="p-6 text-muted-foreground">Carregando...</div>

  const campos: Campo[] = resposta.formulario?.schema_json?.campos ?? []
  const isRascunho = resposta.status === 'RASCUNHO'
  const isEnviado = resposta.status === 'ENVIADO' || resposta.status === 'EM_REVISAO'

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/respostas')}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{resposta.formulario?.titulo ?? 'Resposta'}</h1>
            <Badge variant={STATUS_VARIANT[resposta.status] ?? 'secondary'}>{resposta.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {resposta.diretoria?.nome ?? '—'} · {resposta.usuario?.nome ?? '—'} · {formatDate(resposta.created_at)}
          </p>
        </div>
        {isRascunho && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={salvarRascunho} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
            <Button onClick={enviar} disabled={saving}><Send className="h-4 w-4 mr-1" />Enviar</Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold">Campos</h2>
          {campos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem campos definidos no schema</p>
          ) : (
            campos.map((campo) => (
              <div key={campo.nome} className="space-y-1.5">
                <Label>{campo.label}{campo.obrigatorio && ' *'}</Label>
                {campo.tipo === 'textarea' ? (
                  <Textarea
                    value={String(answers[campo.nome] ?? '')}
                    onChange={(e) => setAnswer(campo.nome, e.target.value)}
                    disabled={!isRascunho}
                    rows={3}
                  />
                ) : campo.tipo === 'select' && campo.opcoes ? (
                  <Select value={String(answers[campo.nome] ?? '')} onValueChange={(v) => setAnswer(campo.nome, v)} disabled={!isRascunho}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{campo.opcoes.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                  </Select>
                ) : campo.tipo === 'booleano' ? (
                  <Select value={String(answers[campo.nome] ?? '')} onValueChange={(v) => setAnswer(campo.nome, v === 'true')} disabled={!isRascunho}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Sim</SelectItem>
                      <SelectItem value="false">Não</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type={campo.tipo === 'numero' ? 'number' : campo.tipo === 'data' ? 'date' : 'text'}
                    value={String(answers[campo.nome] ?? '')}
                    onChange={(e) => setAnswer(campo.nome, campo.tipo === 'numero' ? Number(e.target.value) : e.target.value)}
                    disabled={!isRascunho}
                  />
                )}
              </div>
            ))
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Revisão</h2>
          {isEnviado ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={reviewStatus} onValueChange={setReviewStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{REVIEW_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Observações</Label>
                <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={4} />
              </div>
              <Button className="w-full" onClick={revisar} disabled={reviewing}>{reviewing ? 'Registrando...' : 'Registrar Revisão'}</Button>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              {resposta.revisado_por_usuario && (
                <>
                  <p className="text-muted-foreground">Revisado por: <span className="text-foreground">{resposta.revisado_por_usuario.nome}</span></p>
                  {resposta.revisado_em && <p className="text-muted-foreground">Em: <span className="text-foreground">{formatDate(resposta.revisado_em)}</span></p>}
                </>
              )}
              {resposta.observacoes && (
                <>
                  <Separator />
                  <p className="text-muted-foreground font-medium">Observações:</p>
                  <p className="text-sm whitespace-pre-wrap">{resposta.observacoes}</p>
                </>
              )}
              {!resposta.revisado_por_usuario && <p className="text-muted-foreground">Sem revisão ainda</p>}
            </div>
          )}
          {resposta.enviado_em && (
            <p className="text-xs text-muted-foreground">Enviado em: {formatDate(resposta.enviado_em)}</p>
          )}
        </div>
      </div>
    </div>
  )
}
