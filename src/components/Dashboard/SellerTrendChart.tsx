import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { formatNumber } from '@/lib/utils';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

interface TrendDataPoint {
  date: string;
  revenue: number;
  sales: number;
}

interface SellerTrendChartProps {
  data: TrendDataPoint[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg shadow-lg p-3">
        <p className="text-sm font-medium text-foreground mb-2">{label}</p>
        <div className="space-y-1">
          <p className="text-xs">
            <span className="text-primary">●</span> Revenu:{' '}
            <span className="font-semibold">{formatNumber(payload[0]?.value)} HTG</span>
          </p>
          <p className="text-xs">
            <span className="text-green-500">●</span> Ventes:{' '}
            <span className="font-semibold">{payload[1]?.value}</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

export const SellerTrendChart = ({ data }: SellerTrendChartProps) => {
  const maxRevenue = Math.max(...data.map(d => d.revenue), 1);

  return (
    <Card className="animate-fade-in-up" style={{ animationDelay: '50ms' }}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="w-5 h-5 text-primary" />
          Tendance des 7 derniers jours
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
              />
              <YAxis 
                yAxisId="revenue"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                width={40}
              />
              <YAxis 
                yAxisId="sales"
                orientation="right"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                width={30}
                domain={[0, 'auto']}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                yAxisId="revenue"
                type="monotone"
                dataKey="revenue"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#revenueGradient)"
                animationDuration={1000}
              />
              <Area
                yAxisId="sales"
                type="monotone"
                dataKey="sales"
                stroke="hsl(142, 76%, 36%)"
                strokeWidth={2}
                fill="url(#salesGradient)"
                animationDuration={1200}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-6 mt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span>Revenu (HTG)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>Ventes</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
