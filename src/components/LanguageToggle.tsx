import { Globe } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import type { Language } from '@/lib/translations'

interface LanguageToggleProps {
  language: Language
  onToggle: () => void
}

export function LanguageToggle({ language, onToggle }: LanguageToggleProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onToggle}
      className="gap-2 text-muted-foreground hover:text-foreground transition-colors"
    >
      <Globe size={18} weight="bold" />
      <span className="font-medium">{language === 'en' ? 'ES' : 'EN'}</span>
    </Button>
  )
}
