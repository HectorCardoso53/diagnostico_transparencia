'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Secretaria { id: string; nome: string; sigla: string }
interface Diretoria  { id: string; nome: string; sigla: string; secretaria_id: string }

const NONE = '__none__'
const ROLES = ['SECRETARIO', 'DIRETOR', 'OPERADOR']
const ROLE_LABEL: Record<string, string> = { SECRETARIO: 'Secretário', DIRETOR: 'Diretor', OPERADOR: 'Operador' }
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost/api'

export default function LoginPage() {
  const [modo, setModo] = useState<'login' | 'cadastro'>('login')

  /* login */
  const [email, setEmail]         = useState('')
  const [senha, setSenha]         = useState('')
  const [showLogin, setShowLogin]       = useState(false)
  const [loadingLogin, setLoadingLogin]   = useState(false)
  const [showEsqueci, setShowEsqueci]     = useState(false)
  const [emailRecup, setEmailRecup]       = useState('')
  const [loadingRecup, setLoadingRecup]   = useState(false)
  const { login } = useAuth()
  const router = useRouter()

  async function handleRecuperarSenha(e: React.FormEvent) {
    e.preventDefault()
    setLoadingRecup(true)
    try {
      await fetch(`${API_URL}/auth/recuperar-senha`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailRecup }),
      })
      toast.success('Se o e-mail estiver cadastrado, você receberá a nova senha.')
      setShowEsqueci(false)
      setEmailRecup('')
    } catch {
      toast.error('Erro ao processar solicitação')
    } finally {
      setLoadingRecup(false)
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoadingLogin(true)
    try {
      await login(email, senha)
      const stored = localStorage.getItem('user')
      const u = stored ? (JSON.parse(stored) as { role: string }) : null
      router.push(u?.role === 'SECRETARIO' ? '/formularios' : '/dashboard')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao fazer login')
    } finally {
      setLoadingLogin(false)
    }
  }

  /* cadastro */
  const [nome, setNome]                 = useState('')
  const [cEmail, setCEmail]             = useState('')
  const [cSenha, setCSenha]             = useState('')
  const [showSenha, setShowSenha]       = useState(false)
  const [role, setRole]                 = useState('SECRETARIO')
  const [secretariaId, setSecretariaId] = useState(NONE)
  const [diretoriaId, setDiretoriaId]   = useState(NONE)
  const [secretarias, setSecretarias]   = useState<Secretaria[]>([])
  const [diretorias, setDiretorias]     = useState<Diretoria[]>([])
  const [loadingCad, setLoadingCad]     = useState(false)

  useEffect(() => {
    fetch(`${API_URL}/auth/opcoes`)
      .then((r) => r.ok ? r.json() : { secretarias: [], diretorias: [] })
      .then((data: { secretarias: Secretaria[]; diretorias: Diretoria[] }) => {
        setSecretarias(data.secretarias ?? [])
        setDiretorias(data.diretorias ?? [])
      })
      .catch(() => {})
  }, [])

  const isDiretor    = role === 'DIRETOR' || role === 'OPERADOR'
  const isSecretario = role === 'SECRETARIO'
  const diretoriasFiltradas = secretariaId !== NONE
    ? diretorias.filter((d) => d.secretaria_id === secretariaId)
    : diretorias

  function handleRoleChange(val: string) { setRole(val); setDiretoriaId(NONE) }
  function handleSecretariaChange(val: string) { setSecretariaId(val); setDiretoriaId(NONE) }

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault()
    if (cSenha.length < 6) { toast.error('A senha deve ter pelo menos 6 caracteres'); return }
    setLoadingCad(true)
    try {
      const payload: Record<string, unknown> = { nome, email: cEmail, senha: cSenha, role }
      if (secretariaId !== NONE) payload.secretaria_id = secretariaId
      if (diretoriaId  !== NONE) payload.diretoria_id  = diretoriaId
      const r = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({})) as { message?: string }
        throw new Error(err?.message ?? 'Erro ao cadastrar')
      }
      toast.success('Cadastro realizado! Verifique seu e-mail com login e senha.')
      setModo('login')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao cadastrar')
    } finally {
      setLoadingCad(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #1a3a5c 0%, #0d2540 100%)' }}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl px-10 py-10">

        {/* Logo + nome */}
        <div className="flex flex-col items-center mb-6">
          <img src="/img/prefeitura.png" alt="Logo" width={72} height={72} className="rounded mb-3" />
          <h1 className="text-xl font-bold text-gray-900">Sistema de Diagnóstico</h1>
          <p className="text-sm font-medium" style={{ color: '#1a3a5c' }}>Prefeitura Municipal</p>
        </div>

        {modo === 'login' ? (
          <>
            {/* Divisor */}
            <div className="flex items-center gap-3 mb-6">
              <span className="text-sm font-semibold" style={{ color: '#1a3a5c' }}>Acesso ao sistema</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  E-mail institucional <span className="text-red-500">*</span>
                </label>
                <Input
                  type="email"
                  placeholder="seu@email.gov.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-11"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Senha <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Input
                    type={showLogin ? 'text' : 'password'}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="h-11 pr-9"
                  />
                  <button type="button" onClick={() => setShowLogin((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                    {showLogin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="flex justify-end">
                  <button type="button" onClick={() => setShowEsqueci(true)}
                    className="text-xs text-gray-400 hover:underline bg-transparent border-0 p-0 cursor-pointer">
                    Esqueci a senha
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                className="w-full h-11 text-white font-semibold mt-2"
                style={{ background: '#1a3a5c' }}
                disabled={loadingLogin}
              >
                {loadingLogin ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-3">
              Não tem conta?{' '}
              <button type="button" onClick={() => setModo('cadastro')}
                className="font-semibold hover:underline bg-transparent border-0 p-0 cursor-pointer"
                style={{ color: '#1a3a5c' }}>
                Criar conta
              </button>
            </p>

            {/* Modal Esqueci a senha */}
            {showEsqueci && (
              <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
                <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-sm mx-4">
                  <h2 className="text-lg font-bold text-gray-900 mb-1">Esqueci a senha</h2>
                  <p className="text-sm text-gray-500 mb-5">Informe seu e-mail e enviaremos uma nova senha.</p>
                  <form onSubmit={handleRecuperarSenha} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700">E-mail <span className="text-red-500">*</span></label>
                      <Input type="email" placeholder="seu@email.gov.br" value={emailRecup}
                        onChange={(e) => setEmailRecup(e.target.value)} required autoFocus className="h-11" />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button type="button" onClick={() => { setShowEsqueci(false); setEmailRecup('') }}
                        className="flex-1 h-11 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 bg-white cursor-pointer">
                        Cancelar
                      </button>
                      <Button type="submit" className="flex-1 h-11 text-white font-semibold"
                        style={{ background: '#1a3a5c' }} disabled={loadingRecup}>
                        {loadingRecup ? 'Enviando...' : 'Enviar'}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Divisor */}
            <div className="flex items-center gap-3 mb-6">
              <span className="text-sm font-semibold" style={{ color: '#1a3a5c' }}>Criar conta</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <form onSubmit={handleCadastro} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Nome completo <span className="text-red-500">*</span></label>
                <Input placeholder="Seu nome completo" value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus className="h-11" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">E-mail <span className="text-red-500">*</span></label>
                <Input type="email" placeholder="seu@email.gov.br" value={cEmail} onChange={(e) => setCEmail(e.target.value)} required className="h-11" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Senha <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Input type={showSenha ? 'text' : 'password'} placeholder="Mínimo 6 caracteres"
                    value={cSenha} onChange={(e) => setCSenha(e.target.value)} required className="h-11 pr-9" />
                  <button type="button" onClick={() => setShowSenha((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                    {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Perfil <span className="text-red-500">*</span></label>
                <Select value={role} onValueChange={handleRoleChange}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {(isDiretor || isSecretario) && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Secretaria / Órgão <span className="text-red-500">*</span></label>
                  <Select value={secretariaId} onValueChange={handleSecretariaChange}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {secretarias.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome} ({s.sigla})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {isDiretor && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Diretoria <span className="text-red-500">*</span></label>
                  <Select value={diretoriaId === NONE ? undefined : diretoriaId} onValueChange={setDiretoriaId}
                    disabled={secretariaId === NONE}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder={secretariaId === NONE ? 'Selecione a secretaria primeiro' : 'Selecione a diretoria'} />
                    </SelectTrigger>
                    <SelectContent>
                      {diretoriasFiltradas.map((d) => <SelectItem key={d.id} value={d.id}>{d.nome} ({d.sigla})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button type="submit" className="w-full h-11 text-white font-semibold mt-2"
                style={{ background: '#1a3a5c' }} disabled={loadingCad}>
                {loadingCad ? 'Cadastrando...' : 'Criar conta'}
              </Button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-5">
              Já tem conta?{' '}
              <button type="button" onClick={() => setModo('login')}
                className="font-semibold hover:underline bg-transparent border-0 p-0 cursor-pointer"
                style={{ color: '#1a3a5c' }}>
                Entrar
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
