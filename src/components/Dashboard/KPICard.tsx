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
  colorScheme?: 'default' | 'success' | 'warning' | 'danger' | 'accent' | 'seller-revenue' | 'seller-profit' | 'seller-sales' | 'seller-average';
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
      case 'seller-profit':
        return 'text-success bg-success/10 dark:text-[hsl(160,84%,45%)] dark:bg-[hsl(160,84%,45%)]/20';
      case 'warning':
      case 'seller-average':
        return 'text-warning bg-warning/10 dark:text-[hsl(45,100%,55%)] dark:bg-[hsl(45,100%,55%)]/20';
      case 'danger':
        return 'text-destructive bg-destructive/10 dark:text-[hsl(350,89%,60%)] dark:bg-[hsl(350,89%,60%)]/20';
      case 'accent':
      case 'seller-sales':
        return 'text-accent dark:text-[hsl(262,83%,58%)] bg-accent/10 dark:bg-[hsl(262,83%,58%)]/20';
      case 'seller-revenue':
        return 'text-primary bg-primary/10 dark:text-[hsl(217.2,91.2%,59.8%)] dark:bg-[hsl(217.2,91.2%,59.8%)]/20';
      default:
        return 'text-primary bg-primary/10';
    }
  };

  const getCardAccentClass = () => {
    switch (colorScheme) {
      case 'seller-revenue':
        return 'seller-card-revenue';
      case 'seller-profit':
      case 'success':
        return 'seller-card-profit';
      case 'seller-sales':
      case 'accent':
        return 'seller-card-sales';
      case 'seller-average':
      case 'warning':
        return 'seller-card-average';
      default:
        return '';
    }
  };

  const getSparklineColor = () => {
    switch (colorScheme) {
      case 'seller-profit':
      case 'success':
        return 'hsl(160, 84%, 45%)';
      case 'seller-average':
      case 'warning':
        return 'hsl(45, 100%, 55%)';
      case 'seller-sales':
      case 'accent':
        return 'hsl(262, 83%, 58%)';
      case 'seller-revenue':
        return 'hsl(217.2, 91.2%, 59.8%)';
      case 'danger':
        return 'hsl(350, 89%, 60%)';
      default:
        return 'hsl(var(--primary))';
    }
  };

  const sparklineColor = getSparklineColor();

  return (
    <Card className={`relative overflow-hidden bg-card transition-all duration-300 hover:shadow-lg hover:scale-[1.02] dark:border-border/50 ${getCardAccentClass()}`}>
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
                  <TrendingUp className="w-3 h-3 text-success dark:text-[hsl(160,84%,45%)]" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-destructive dark:text-[hsl(350,89%,60%)]" />
                )}
                <span className={`text-xs font-medium ${
                  isNeutral 
                    ? 'text-muted-foreground' 
                    : isPositive 
                      ? 'text-success dark:text-[hsl(160,84%,45%)]' 
                      : 'text-destructive dark:text-[hsl(350,89%,60%)]'
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
                    <stop offset="0%" stopColor={sparklineColor} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={sparklineColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={sparklineColor}
                  strokeWidth={2}
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
