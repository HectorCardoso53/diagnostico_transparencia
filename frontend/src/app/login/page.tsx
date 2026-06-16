'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, senha)
      const stored = localStorage.getItem('user')
      const u = stored ? (JSON.parse(stored) as { role: string }) : null
      router.push(u?.role === 'SECRETARIO' ? '/formularios' : '/dashboard')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao fazer login')
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

          {/* Título */}
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Bem-vindo</h1>
          <p className="text-gray-500 text-sm mb-6">Entre com suas credenciais para acessar o sistema</p>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-gray-700">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.gov.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="senha" className="text-gray-700">Senha</Label>
              <Input
                id="senha"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-[#0f1b2d] hover:bg-[#1c2e45] text-white mt-2"
              disabled={loading}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-4">
            Não tem conta?{' '}
            <a href="/cadastro" className="text-[#2563eb] hover:underline font-medium">
              Criar conta
            </a>
          </p>
        </CardContent>
      </Card>

      {/* Rodapé */}
      <p className="text-gray-400 text-xs mt-4">Sistema de Diagnóstico das Secretarias © 2026</p>
    </div>
  )
}