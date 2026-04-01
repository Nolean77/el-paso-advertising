import { useState } from 'react'
import { Key } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LanguageToggle } from '@/components/LanguageToggle'
import { translations, type Language } from '@/lib/translations'
import type { User } from '@/lib/types'

interface LoginPageProps {
  onLogin: (user: User) => void
  language: Language
  onLanguageToggle: () => void
}

export function LoginPage({ onLogin, language, onLanguageToggle }: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const t = translations[language].login

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    await new Promise(resolve => setTimeout(resolve, 800))

    if (email && password === 'demo123') {
      onLogin({
        email,
        name: email.split('@')[0],
      })
    } else {
      setError(t.error)
    }
    
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(245,158,11,0.1),transparent_50%)]" />
      
      <div className="absolute top-4 right-4">
        <LanguageToggle language={language} onToggle={onLanguageToggle} />
      </div>

      <Card className="w-full max-w-md relative border-border/50 shadow-2xl">
        <CardHeader className="space-y-1 text-center pb-8">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Key size={32} weight="bold" className="text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight">
            El Paso Advertising
          </CardTitle>
          <CardDescription className="text-lg">{t.subtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                {t.email}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="client@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                {t.password}
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button
              type="submit"
              className="w-full h-11 text-base font-semibold"
              disabled={isLoading}
            >
              {isLoading ? '...' : t.submit}
            </Button>
          </form>
          <p className="text-xs text-center text-muted-foreground mt-6">
            {language === 'en' ? 'Demo password: demo123' : 'Contraseña demo: demo123'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
