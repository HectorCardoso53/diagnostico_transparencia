'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { ArrowLeft, Paperclip, Send } from 'lucide-react'
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

// ─── Types ────────────────────────────────────────────────────────────────────

type TipoCampo =
  | 'texto' | 'paragrafo' | 'textarea'        // texto
  | 'multipla_escolha'                          // radio
  | 'caixa_selecao'                             // checkbox (resposta = string[])
  | 'lista_suspensa' | 'select'                 // dropdown
  | 'numero' | 'data' | 'booleano'              // outros
  | 'moeda'                                     // valor em R$

interface Campo {
  id?: string
  nome?: string
  tipo: TipoCampo
  label: string
  obrigatorio?: boolean
  opcoes?: string[]
  permite_anexo?: boolean
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'

interface Resposta {
  id: string
  status: string
  dados_json: Record<string, unknown>
  observacoes: string | null
  enviado_em: string | null
  revisado_em: string | null
  created_at: string
  formulario: { id: string; titulo: string; descricao?: string | null; schema_json: { campos?: Campo[] } } | null
  diretoria: { nome: string } | null
  usuario: { nome: string } | null
  revisado_por_usuario: { nome: string } | null
}

function formatMoeda(val: unknown): string {
  if (val === undefined || val === null || val === '') return ''
  const str = String(val).replace(/\./g, ',')
  return str
}

function parseMoeda(input: string): string {
  // Mantém apenas dígitos e vírgula
  return input.replace(/[^\d,]/g, '')
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'destructive'> = {
  RASCUNHO: 'secondary', ENVIADO: 'default', APROVADO: 'success',
  REPROVADO: 'destructive', EM_REVISAO: 'default',
}

const REVIEW_OPTIONS = [
  { value: 'APROVADO', label: 'Aprovado' },
  { value: 'REPROVADO', label: 'Reprovado' },
  { value: 'EM_REVISAO', label: 'Em revisão' },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function RespostaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { user } = useAuth()
  const [id, setId] = useState('')
  const [resposta, setResposta] = useState<Resposta | null>(null)
  // secretário preenche quando a resposta é dele próprio (sem diretoria)
  const isSecretarioPreenchendo = user?.role === 'SECRETARIO' && resposta?.diretoria === null
  const canFill   = user?.role === 'DIRETOR' || user?.role === 'OPERADOR' || isSecretarioPreenchendo
  const canReview = (user?.role === 'SECRETARIO' && !isSecretarioPreenchendo) || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<Record<string, boolean>>({})
  const [reviewStatus, setReviewStatus] = useState('APROVADO')
  const [observacoes, setObservacoes] = useState('')
  const [reviewing, setReviewing] = useState(false)

  useEffect(() => { params.then((p) => setId(p.id)) }, [params])

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
      toast.success('Resposta enviada com sucesso!')
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
      await api.post(`/respostas/${resposta.id}/revisar`, {
        status: reviewStatus,
        observacoes: observacoes || undefined,
      })
      toast.success('Revisão registrada')
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    } finally {
      setReviewing(false)
    }
  }

  // Cada campo é identificado pelo id (novo schema) ou nome (schema antigo)
  function campoKey(campo: Campo): string {
    return campo.id ?? campo.nome ?? campo.label
  }

  function setAnswer(key: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [key]: value }))
  }

  function toggleCheckbox(key: string, opcao: string, checked: boolean) {
    const current = Array.isArray(answers[key]) ? (answers[key] as string[]) : []
    setAnswer(key, checked ? [...current, opcao] : current.filter((v) => v !== opcao))
  }

  async function handleUpload(campoKey: string, file?: File) {
    if (!file || !resposta) return
    setUploading((prev) => ({ ...prev, [campoKey]: true }))
    try {
      const fd = new FormData()
      fd.append('file', file)
      const result = await api.upload<{ url: string }>(`/respostas/${resposta.id}/upload`, fd)
      setAnswer(campoKey, result.url)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao enviar arquivo')
    } finally {
      setUploading((prev) => ({ ...prev, [campoKey]: false }))
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (!resposta) return <div className="p-6 text-muted-foreground">Carregando...</div>

  const campos: Campo[] = resposta.formulario?.schema_json?.campos ?? []
  const isRascunho = resposta.status === 'RASCUNHO'
  const isEnviado  = resposta.status === 'ENVIADO' || resposta.status === 'EM_REVISAO'

  return (
    <div className="p-6 pb-12 space-y-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push(isSecretarioPreenchendo ? '/formularios' : '/respostas')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{resposta.formulario?.titulo ?? 'Resposta'}</h1>
            <Badge variant={STATUS_VARIANT[resposta.status] ?? 'secondary'}>{resposta.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {resposta.diretoria?.nome ?? '—'} · {resposta.usuario?.nome ?? '—'} · {formatDate(resposta.created_at)}
          </p>
        </div>
        {isRascunho && canFill && (
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" onClick={salvarRascunho} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar rascunho'}
            </Button>
            <Button onClick={enviar} disabled={saving}>
              <Send className="h-4 w-4 mr-1" />Enviar
            </Button>
          </div>
        )}
      </div>

      <div className={`grid grid-cols-1 gap-6 ${canReview ? 'lg:grid-cols-3' : ''}`}>

        {/* Perguntas */}
        <div className={canReview ? 'lg:col-span-2 space-y-4' : 'space-y-4'}>

          {/* Cabeçalho do formulário */}
          {resposta.formulario && (
            <div className="rounded-xl border bg-card p-5 border-l-4 border-l-[#0f1b2d]">
              <h2 className="text-lg font-semibold">{resposta.formulario.titulo}</h2>
              {resposta.formulario.descricao && (
                <p className="text-sm text-muted-foreground mt-1">{resposta.formulario.descricao}</p>
              )}
            </div>
          )}

          {campos.length === 0 ? (
            <div className="rounded-xl border p-10 text-center text-sm text-muted-foreground">
              Este formulário não possui perguntas
            </div>
          ) : (
            campos.map((campo) => {
              const key = campoKey(campo)
              const disabled = !isRascunho || !canFill

              return (
                <div key={key} className="rounded-xl border bg-card p-5 space-y-3 shadow-sm">
                  <Label className="text-base font-medium leading-snug">
                    {campo.label}
                    {campo.obrigatorio && <span className="text-destructive ml-1">*</span>}
                  </Label>

                  {/* Resposta curta */}
                  {campo.tipo === 'texto' && (
                    <Input
                      value={String(answers[key] ?? '')}
                      onChange={(e) => setAnswer(key, e.target.value)}
                      disabled={disabled}
                      placeholder="Sua resposta"
                    />
                  )}

                  {/* Parágrafo / textarea */}
                  {(campo.tipo === 'paragrafo' || campo.tipo === 'textarea') && (
                    <Textarea
                      value={String(answers[key] ?? '')}
                      onChange={(e) => setAnswer(key, e.target.value)}
                      disabled={disabled}
                      rows={4}
                      placeholder="Sua resposta"
                    />
                  )}

                  {/* Número */}
                  {campo.tipo === 'numero' && (
                    <Input
                      type="number"
                      value={String(answers[key] ?? '')}
                      onChange={(e) => setAnswer(key, e.target.value === '' ? '' : Number(e.target.value))}
                      disabled={disabled}
                      className="max-w-[180px]"
                    />
                  )}

                  {/* Data */}
                  {campo.tipo === 'data' && (
                    <Input
                      type="date"
                      value={String(answers[key] ?? '')}
                      onChange={(e) => setAnswer(key, e.target.value)}
                      disabled={disabled}
                      className="max-w-[200px]"
                    />
                  )}

                  {/* Múltipla escolha — radio */}
                  {campo.tipo === 'multipla_escolha' && campo.opcoes && (
                    <div className="space-y-2 pt-1">
                      {campo.opcoes.map((opcao) => (
                        <label key={opcao} className={`flex items-center gap-3 ${disabled ? 'cursor-default' : 'cursor-pointer'}`}>
                          <input
                            type="radio"
                            name={key}
                            value={opcao}
                            checked={answers[key] === opcao}
                            onChange={() => setAnswer(key, opcao)}
                            disabled={disabled}
                            className="h-4 w-4 accent-[#0f1b2d]"
                          />
                          <span className="text-sm">{opcao}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* Caixas de seleção — checkbox */}
                  {campo.tipo === 'caixa_selecao' && campo.opcoes && (
                    <div className="space-y-2 pt-1">
                      {campo.opcoes.map((opcao) => {
                        const selected = Array.isArray(answers[key])
                          ? (answers[key] as string[]).includes(opcao)
                          : false
                        return (
                          <label key={opcao} className={`flex items-center gap-3 ${disabled ? 'cursor-default' : 'cursor-pointer'}`}>
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={(e) => toggleCheckbox(key, opcao, e.target.checked)}
                              disabled={disabled}
                              className="h-4 w-4 rounded accent-[#0f1b2d]"
                            />
                            <span className="text-sm">{opcao}</span>
                          </label>
                        )
                      })}
                    </div>
                  )}

                  {/* Lista suspensa — select */}
                  {(campo.tipo === 'lista_suspensa' || campo.tipo === 'select') && campo.opcoes && (
                    <Select
                      value={String(answers[key] ?? '')}
                      onValueChange={(v) => setAnswer(key, v)}
                      disabled={disabled}
                    >
                      <SelectTrigger className="max-w-xs">
                        <SelectValue placeholder="Selecione uma opção..." />
                      </SelectTrigger>
                      <SelectContent>
                        {campo.opcoes.map((o) => (
                          <SelectItem key={o} value={o}>{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {/* Valor em R$ */}
                  {campo.tipo === 'moeda' && (
                    <div className="flex items-center border rounded-md max-w-[220px] focus-within:ring-2 focus-within:ring-ring overflow-hidden">
                      <span className="px-3 py-2 text-sm font-medium bg-muted text-muted-foreground border-r select-none">R$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={formatMoeda(answers[key])}
                        onChange={(e) => setAnswer(key, parseMoeda(e.target.value))}
                        disabled={disabled}
                        placeholder="0,00"
                        className="flex-1 px-3 py-2 text-sm bg-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                  )}

                  {/* Booleano (tipo legado) */}
                  {campo.tipo === 'booleano' && (
                    <Select
                      value={answers[key] === undefined ? '' : String(answers[key])}
                      onValueChange={(v) => setAnswer(key, v === 'true')}
                      disabled={disabled}
                    >
                      <SelectTrigger className="max-w-[160px]">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Sim</SelectItem>
                        <SelectItem value="false">Não</SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  {/* Anexo de arquivo */}
                  {campo.permite_anexo && (
                    <div className="space-y-2 pt-1">
                      {Boolean(answers[key]) && (
                        <a
                          href={`${API_BASE}${answers[key] as string}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                        >
                          <Paperclip className="h-4 w-4 shrink-0" />
                          Arquivo anexado — clique para visualizar
                        </a>
                      )}
                      {!disabled && (
                        <label className="flex items-center gap-2 rounded-md border border-dashed border-muted-foreground/40 px-3 py-2 max-w-sm bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors">
                          <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-sm text-muted-foreground">
                            {uploading[key] ? 'Enviando...' : answers[key] ? 'Substituir arquivo' : 'Anexar arquivo (PDF, JPG, PNG)'}
                          </span>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            disabled={uploading[key]}
                            onChange={(e) => handleUpload(key, e.target.files?.[0])}
                          />
                        </label>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Painel de revisão — só para admin */}
        {canReview && <div className="space-y-4">
          <h2 className="text-lg font-semibold">Revisão</h2>

          {isEnviado ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={reviewStatus} onValueChange={setReviewStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REVIEW_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Observações</Label>
                <Textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={4}
                  placeholder="Comentários sobre a resposta..."
                />
              </div>
              <Button className="w-full" onClick={revisar} disabled={reviewing}>
                {reviewing ? 'Registrando...' : 'Registrar revisão'}
              </Button>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              {resposta.revisado_por_usuario ? (
                <>
                  <p className="text-muted-foreground">
                    Revisado por: <span className="text-foreground font-medium">{resposta.revisado_por_usuario.nome}</span>
                  </p>
                  {resposta.revisado_em && (
                    <p className="text-muted-foreground">Em: <span className="text-foreground">{formatDate(resposta.revisado_em)}</span></p>
                  )}
                  {resposta.observacoes && (
                    <>
                      <Separator className="my-2" />
                      <p className="font-medium text-muted-foreground">Observações:</p>
                      <p className="whitespace-pre-wrap">{resposta.observacoes}</p>
                    </>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">Sem revisão registrada</p>
              )}
            </div>
          )}

          {resposta.enviado_em && (
            <p className="text-xs text-muted-foreground pt-2">
              Enviado em: {formatDate(resposta.enviado_em)}
            </p>
          )}
        </div>}
      </div>
    </div>
  )
}
