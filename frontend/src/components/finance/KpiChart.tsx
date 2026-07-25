import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface KpiChartProps {
  title: string
  type: 'bar' | 'line' | 'area'
  data: { date: string; value: number }[]
  color?: string
  format?: 'currency' | 'number'
}

function formatVal(v: number, fmt?: string) {
  if (fmt === 'currency') return `₱${v.toLocaleString()}`
  return `${v.toLocaleString()}`
}

export function KpiChart({ title, type, data, color = '#C9953E', format }: KpiChartProps) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="font-display text-sm font-semibold mb-3 text-foreground">{title}</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          {type === 'bar' ? (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} stroke="var(--color-muted-fg)" />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatVal(v, format)} stroke="var(--color-muted-fg)" />
              <Tooltip formatter={(v) => [formatVal(v as number, format), title]} labelFormatter={(l) => l} />
              <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : type === 'line' ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} stroke="var(--color-muted-fg)" />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatVal(v, format)} stroke="var(--color-muted-fg)" />
              <Tooltip formatter={(v) => [formatVal(v as number, format), title]} labelFormatter={(l) => l} />
              <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          ) : (
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} stroke="var(--color-muted-fg)" />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatVal(v, format)} stroke="var(--color-muted-fg)" />
              <Tooltip formatter={(v) => [formatVal(v as number, format), title]} labelFormatter={(l) => l} />
              <Area type="monotone" dataKey="value" stroke={color} fill={color} fillOpacity={0.15} strokeWidth={2} />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}