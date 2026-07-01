'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'
const TOKEN_KEY = 'pesquisa_token'

type TipoCampo = 'texto' | 'paragrafo' | 'multipla_escolha' | 'caixa_selecao' | 'lista_suspensa' | 'numero' | 'data' | 'moeda'

interface Campo {
  id: string
  tipo: TipoCampo
  label: string
  obrigatorio: boolean
  opcoes?: string[]
}

interface Pesquisa {
  id: string
  titulo: string
  descricao: string | null
  schema_json: { campos?: Campo[] } | null
  status: string
}

function getToken(): string {
  if (typeof window === 'undefined') return ''
  let t = localStorage.getItem(TOKEN_KEY)
  if (!t) { t = Math.random().toString(36).slice(2) + Date.now(); localStorage.setItem(TOKEN_KEY, t) }
  return t
}

function CampoInput({
  campo, value, onChange,
}: {
  campo: Campo
  value: string | string[]
  onChange: (v: string | string[]) => void
}) {
  const opcoes = campo.opcoes ?? []

  if (campo.tipo === 'multipla_escolha') {
    return (
      <div className="space-y-2">
        {opcoes.map(op => (
          <label key={op} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={campo.id}
              value={op}
              checked={value === op}
              onChange={() => onChange(op)}
              className="accent-[#1a3a5c]"
            />
            <span className="text-sm">{op}</span>
          </label>
        ))}
      </div>
    )
  }

  if (campo.tipo === 'caixa_selecao') {
    const selected = Array.isArray(value) ? value : []
    return (
      <div className="space-y-2">
        {opcoes.map(op => (
          <label key={op} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.includes(op)}
              onChange={e => {
                if (e.target.checked) onChange([...selected, op])
                else onChange(selected.filter(x => x !== op))
              }}
              className="accent-[#1a3a5c] rounded"
            />
            <span className="text-sm">{op}</span>
          </label>
        ))}
      </div>
    )
  }

  if (campo.tipo === 'lista_suspensa') {
    return (
      <select
        className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a5c]"
        value={value as string}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">Selecione...</option>
        {opcoes.map(op => <option key={op} value={op}>{op}</option>)}
      </select>
    )
  }

  if (campo.tipo === 'paragrafo') {
    return (
      <Textarea
        value={value as string}
        onChange={e => onChange(e.target.value)}
        rows={3}
        placeholder="Sua resposta..."
      />
    )
  }

  if (campo.tipo === 'numero') {
    return (
      <Input
        type="number"
        value={value as string}
        onChange={e => onChange(e.target.value)}
        placeholder="0"
      />
    )
  }

  if (campo.tipo === 'data') {
    return (
      <Input
        type="date"
        value={value as string}
        onChange={e => onChange(e.target.value)}
      />
    )
  }

  if (campo.tipo === 'moeda') {
    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
        <Input
          type="number"
          step="0.01"
          className="pl-9"
          value={value as string}
          onChange={e => onChange(e.target.value)}
          placeholder="0,00"
        />
      </div>
    )
  }

  return (
    <Input
      value={value as string}
      onChange={e => onChange(e.target.value)}
      placeholder="Sua resposta..."
    />
  )
}

export default function PesquisaPublicaPage() {
  const { id } = useParams<{ id: string }>()
  const [pesquisa, setPesquisa] = useState<Pesquisa | null>(null)
  const [erro, setErro]         = useState('')
  const [enviado, setEnviado]   = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Dados do respondente
  const [nome, setNome]         = useState('')
  const [secretaria, setSecretaria] = useState('')
  const [diretoria, setDiretoria]   = useState('')
  const [cargo, setCargo]       = useState('')

  // Respostas das perguntas: { [campo.id]: string | string[] }
  const [respostas, setRespostas] = useState<Record<string, string | string[]>>({})

  const tokenRef = useRef('')

  useEffect(() => {
    tokenRef.current = getToken()
    fetch(`${API}/pesquisas/publica/${id}`)
      .then(r => {
        if (!r.ok) throw new Error()
        return r.json() as Promise<Pesquisa>
      })
      .then(p => {
        setPesquisa(p)
        // Inicializa respostas vazias
        const init: Record<string, string | string[]> = {}
        for (const c of p.schema_json?.campos ?? []) {
          init[c.id] = c.tipo === 'caixa_selecao' ? [] : ''
        }
        setRespostas(init)
      })
      .catch(() => setErro('Pesquisa não encontrada ou não disponível.'))
  }, [id])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) { toast.error('Informe seu nome'); return }

    // Valida obrigatórios
    for (const c of pesquisa?.schema_json?.campos ?? []) {
      if (!c.obrigatorio) continue
      const v = respostas[c.id]
      if (!v || (Array.isArray(v) && v.length === 0) || v === '') {
        toast.error(`A pergunta "${c.label}" é obrigatória`)
        return
      }
    }

    setSubmitting(true)
    try {
      const body = {
        nome: nome.trim(),
        secretaria: secretaria.trim() || undefined,
        diretoria: diretoria.trim() || undefined,
        cargo: cargo.trim() || undefined,
        dados_json: respostas,
        token_browser: tokenRef.current,
      }
      const res = await fetch(`${API}/pesquisas/${id}/responder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string }
        throw new Error(err.message ?? 'Erro ao enviar')
      }
      setEnviado(true)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar resposta')
    } finally {
      setSubmitting(false)
    }
  }

  /* ── Estados de tela ── */

  if (erro) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold text-gray-700">{erro}</p>
          <p className="text-sm text-gray-400">Verifique o link ou entre em contato com o responsável.</p>
        </div>
      </div>
    )
  }

  if (!pesquisa) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-[#1a3a5c]" />
      </div>
    )
  }

  if (enviado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center space-y-3">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
          <h2 className="text-xl font-bold text-gray-800">Resposta enviada!</h2>
          <p className="text-gray-500 text-sm">Obrigado por participar da pesquisa.</p>
        </div>
      </div>
    )
  }

  const campos = pesquisa.schema_json?.campos ?? []

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Cabeçalho */}
      <div className="bg-[#1a3a5c] text-white py-8 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <img
            src="/img/prefeitura.png"
            alt="Logo Prefeitura"
            width={56} height={56}
            className="rounded mx-auto mb-4"
          />
          <p className="text-sm text-blue-200 uppercase tracking-wide mb-1">Prefeitura de Oriximiná</p>
          <h1 className="text-2xl font-bold">{pesquisa.titulo}</h1>
          {pesquisa.descricao && (
            <p className="text-blue-200 text-sm mt-2 max-w-lg mx-auto">{pesquisa.descricao}</p>
          )}
        </div>
      </div>

      {/* Formulário */}
      <form onSubmit={enviar} className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Dados do respondente */}
        <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
          <h2 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">Seus dados</h2>
          <div className="space-y-1.5">
            <Label>Nome completo <span className="text-red-500">*</span></Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Secretaria</Label>
              <Input value={secretaria} onChange={e => setSecretaria(e.target.value)} placeholder="Ex: SEMSA" />
            </div>
            <div className="space-y-1.5">
              <Label>Diretoria</Label>
              <Input value={diretoria} onChange={e => setDiretoria(e.target.value)} placeholder="Ex: Diretoria de TI" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Cargo ou Função</Label>
            <Input value={cargo} onChange={e => setCargo(e.target.value)} placeholder="Ex: Técnico Administrativo" />
          </div>
        </div>

        {/* Perguntas */}
        {campos.map((c, i) => (
          <div key={c.id} className="bg-white rounded-xl shadow-sm border p-6 space-y-3">
            <p className="text-sm font-medium text-gray-800">
              <span className="text-gray-400 mr-2">{i + 1}.</span>
              {c.label}
              {c.obrigatorio && <span className="text-red-500 ml-1">*</span>}
            </p>
            <CampoInput
              campo={c}
              value={respostas[c.id] ?? ''}
              onChange={v => setRespostas(prev => ({ ...prev, [c.id]: v }))}
            />
          </div>
        ))}

        {campos.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border p-8 text-center text-gray-400 text-sm">
            Esta pesquisa ainda não possui perguntas.
          </div>
        )}

        <Button
          type="submit"
          disabled={submitting}
          className="w-full bg-[#1a3a5c] hover:bg-[#22496e] text-white h-12 text-base"
        >
          {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Enviando...</> : 'Enviar resposta'}
        </Button>

        <p className="text-center text-xs text-gray-400">
          Prefeitura Municipal de Oriximiná — suas respostas são confidenciais.
        </p>
      </form>
    </div>
  )
}
