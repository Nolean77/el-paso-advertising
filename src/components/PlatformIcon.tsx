import { InstagramLogo, FacebookLogo, TwitterLogo, LinkedinLogo } from '@phosphor-icons/react'

interface PlatformIconProps {
  platform: 'instagram' | 'facebook' | 'twitter' | 'linkedin'
  size?: number
  className?: string
}

export function PlatformIcon({ platform, size = 20, className }: PlatformIconProps) {
  const icons = {
    instagram: InstagramLogo,
    facebook: FacebookLogo,
    twitter: TwitterLogo,
    linkedin: LinkedinLogo,
  }

  const Icon = icons[platform]
  
  return <Icon size={size} weight="fill" className={className} />
}
