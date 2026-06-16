'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Eye, EyeOff } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

export default function CadastroPage() {
  const [nome, setNome]   = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (senha.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres')
      return
    }
    setLoading(true)
    try {
      await api.post('/auth/register', { nome, email, senha })
      toast.success('Cadastro realizado! Aguarde a liberação do seu acesso.')
      setTimeout(() => router.push('/login'), 2000)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao cadastrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-md shadow-md">
        <CardContent className="pt-8 pb-8 px-8">

          {/* Logo + nome */}
          <div className="flex items-center gap-3 mb-8">
            <img
              src="/img/prefeitura.png"
              alt="Logo da Prefeitura"
              width={56}
              height={56}
              className="rounded"
            />
            <div>
              <p className="font-bold text-gray-800 text-base leading-tight">Prefeitura Municipal</p>
              <p className="text-[#7eb3e8] font-semibold text-sm">Sistema de Diagnóstico</p>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-gray-800 mb-1">Criar conta</h1>
          <p className="text-gray-500 text-sm mb-6">Preencha os dados para solicitar acesso ao sistema</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nome" className="text-gray-700">Nome completo *</Label>
              <Input
                id="nome"
                placeholder="Seu nome completo"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-gray-700">E-mail *</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.gov.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="senha" className="text-gray-700">Senha *</Label>
              <div className="relative">
                <Input
                  id="senha"
                  type={showSenha ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowSenha((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-[#0f1b2d] hover:bg-[#1c2e45] text-white mt-2"
              disabled={loading}
            >
              {loading ? 'Cadastrando...' : 'Criar conta'}
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Já tem conta?{' '}
            <Link href="/login" className="text-[#2563eb] hover:underline font-medium">
              Entrar
            </Link>
          </p>
        </CardContent>
      </Card>

      <p className="text-gray-400 text-xs mt-6">Sistema de Diagnóstico das Secretarias © 2026</p>
    </div>
  )
}
