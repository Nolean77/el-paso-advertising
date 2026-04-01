import { ChartBar, Eye, Heart, TrendUp } from '@phosphor-icons/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { translations, type Language } from '@/lib/translations'
import type { PerformanceMetric } from '@/lib/types'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'

interface PerformanceProps {
  metrics: PerformanceMetric[]
  language: Language
}

export function Performance({ metrics, language }: PerformanceProps) {
  const t = translations[language].performance

  const totalReach = metrics.reduce((sum, m) => sum + m.reach, 0)
  const totalLikes = metrics.reduce((sum, m) => sum + m.likes, 0)
  const avgEngagement = metrics.length > 0 
    ? metrics.reduce((sum, m) => sum + m.engagementRate, 0) / metrics.length 
    : 0

  const chartData = metrics.map(m => ({
    name: m.caption.slice(0, 20) + '...',
    reach: m.reach,
    likes: m.likes,
    engagement: m.engagementRate,
  }))

  if (metrics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ChartBar size={64} weight="thin" className="text-muted-foreground mb-4" />
        <p className="text-muted-foreground text-lg">{t.empty}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">{t.title}</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t.reach}
            </CardTitle>
            <Eye size={20} weight="bold" className="text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {totalReach.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.length} {t.posts}
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t.likes}
            </CardTitle>
            <Heart size={20} weight="fill" className="text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {totalLikes.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.length} {t.posts}
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t.engagement}
            </CardTitle>
            <TrendUp size={20} weight="bold" className="text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {avgEngagement.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {language === 'en' ? 'Average' : 'Promedio'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t.recentPosts}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis 
                dataKey="name" 
                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                stroke="rgba(255,255,255,0.2)"
              />
              <YAxis 
                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                stroke="rgba(255,255,255,0.2)"
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'oklch(0.15 0 0)', 
                  border: '1px solid oklch(0.20 0 0)',
                  borderRadius: '8px',
                  color: '#fff'
                }}
              />
              <Bar dataKey="reach" fill="oklch(0.75 0.15 70)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="likes" fill="oklch(0.60 0.12 70)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t.engagement}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis 
                dataKey="name" 
                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                stroke="rgba(255,255,255,0.2)"
              />
              <YAxis 
                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                stroke="rgba(255,255,255,0.2)"
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'oklch(0.15 0 0)', 
                  border: '1px solid oklch(0.20 0 0)',
                  borderRadius: '8px',
                  color: '#fff'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="engagement" 
                stroke="oklch(0.75 0.15 70)" 
                strokeWidth={3}
                dot={{ fill: 'oklch(0.75 0.15 70)', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
