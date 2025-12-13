import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, LucideIcon } from 'lucide-react';
import { formatNumber } from '@/lib/utils';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';

interface KPICardProps {
  title: string;
  value: number;
  previousValue?: number;
  icon: LucideIcon;
  currency?: string;
  sparklineData?: { value: number }[];
  format?: 'currency' | 'number' | 'percent';
  colorScheme?: 'default' | 'success' | 'warning' | 'danger';
}

export const KPICard = ({
  title,
  value,
  previousValue,
  icon: Icon,
  currency = 'HTG',
  sparklineData,
  format = 'currency',
  colorScheme = 'default',
}: KPICardProps) => {
  const trend = previousValue && previousValue > 0 
    ? ((value - previousValue) / previousValue) * 100 
    : 0;
  
  const isPositive = trend > 0;
  const isNeutral = Math.abs(trend) < 0.1;

  const formatValue = () => {
    switch (format) {
      case 'currency':
        return `${formatNumber(value)} ${currency}`;
      case 'percent':
        return `${formatNumber(value)}%`;
      case 'number':
      default:
        return formatNumber(value, 0);
    }
  };

  const getColorClasses = () => {
    switch (colorScheme) {
      case 'success':
        return 'text-green-500 bg-green-500/10';
      case 'warning':
        return 'text-yellow-500 bg-yellow-500/10';
      case 'danger':
        return 'text-red-500 bg-red-500/10';
      default:
        return 'text-primary bg-primary/10';
    }
  };

  const sparklineColor = colorScheme === 'danger' 
    ? 'hsl(var(--destructive))' 
    : colorScheme === 'success' 
      ? 'hsl(142, 76%, 36%)' 
      : 'hsl(var(--primary))';

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-muted-foreground truncate">
              {title}
            </p>
            <p className="text-xl font-bold text-foreground mt-1 truncate">
              {formatValue()}
            </p>
            
            {previousValue !== undefined && (
              <div className="flex items-center gap-1 mt-2">
                {isNeutral ? (
                  <Minus className="w-3 h-3 text-muted-foreground" />
                ) : isPositive ? (
                  <TrendingUp className="w-3 h-3 text-green-500" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-red-500" />
                )}
                <span className={`text-xs font-medium ${
                  isNeutral 
                    ? 'text-muted-foreground' 
                    : isPositive 
                      ? 'text-green-500' 
                      : 'text-red-500'
                }`}>
                  {isPositive ? '+' : ''}{trend.toFixed(1)}%
                </span>
                <span className="text-xs text-muted-foreground">
                  vs précédent
                </span>
              </div>
            )}
          </div>
          
          <div className={`p-2 rounded-lg ${getColorClasses()}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>

        {sparklineData && sparklineData.length > 0 && (
          <div className="mt-3 h-12 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineData}>
                <defs>
                  <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={sparklineColor} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={sparklineColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={sparklineColor}
                  strokeWidth={1.5}
                  fill={`url(#gradient-${title})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
