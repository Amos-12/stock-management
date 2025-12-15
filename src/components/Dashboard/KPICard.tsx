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
  colorScheme?: 'default' | 'success' | 'warning' | 'danger' | 'accent' | 'seller-revenue' | 'seller-profit' | 'seller-sales' | 'seller-average' | 'admin-revenue' | 'admin-profit' | 'admin-sales' | 'admin-target' | 'admin-inventory' | 'admin-sellers' | 'admin-orders' | 'admin-products';
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
      case 'admin-profit':
        return 'text-success bg-success/10 dark:text-[hsl(160,84%,45%)] dark:bg-[hsl(160,84%,45%)]/20';
      case 'warning':
      case 'seller-average':
      case 'admin-orders':
        return 'text-warning bg-warning/10 dark:text-[hsl(45,100%,55%)] dark:bg-[hsl(45,100%,55%)]/20';
      case 'danger':
        return 'text-destructive bg-destructive/10 dark:text-[hsl(350,89%,60%)] dark:bg-[hsl(350,89%,60%)]/20';
      case 'accent':
      case 'seller-sales':
      case 'admin-sales':
        return 'text-accent dark:text-[hsl(262,83%,58%)] bg-accent/10 dark:bg-[hsl(262,83%,58%)]/20';
      case 'seller-revenue':
      case 'admin-revenue':
        return 'text-primary bg-primary/10 dark:text-[hsl(217,91%,60%)] dark:bg-[hsl(217,91%,60%)]/20';
      case 'admin-target':
        return 'text-orange-500 bg-orange-500/10 dark:text-[hsl(32,95%,44%)] dark:bg-[hsl(32,95%,44%)]/20';
      case 'admin-inventory':
        return 'text-cyan-500 bg-cyan-500/10 dark:text-[hsl(187,92%,50%)] dark:bg-[hsl(187,92%,50%)]/20';
      case 'admin-sellers':
        return 'text-pink-500 bg-pink-500/10 dark:text-[hsl(330,81%,60%)] dark:bg-[hsl(330,81%,60%)]/20';
      case 'admin-products':
        return 'text-sky-500 bg-sky-500/10 dark:text-[hsl(199,89%,48%)] dark:bg-[hsl(199,89%,48%)]/20';
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
      case 'admin-revenue':
        return 'admin-card-revenue';
      case 'admin-profit':
        return 'admin-card-profit';
      case 'admin-sales':
        return 'admin-card-sales';
      case 'admin-target':
        return 'admin-card-target';
      case 'admin-inventory':
        return 'admin-card-inventory';
      case 'admin-sellers':
        return 'admin-card-sellers';
      case 'admin-orders':
        return 'admin-card-orders';
      case 'admin-products':
        return 'admin-card-products';
      default:
        return '';
    }
  };

  const getSparklineColor = () => {
    switch (colorScheme) {
      case 'seller-profit':
      case 'admin-profit':
      case 'success':
        return 'hsl(160, 84%, 45%)';
      case 'seller-average':
      case 'admin-orders':
      case 'warning':
        return 'hsl(45, 100%, 55%)';
      case 'seller-sales':
      case 'admin-sales':
      case 'accent':
        return 'hsl(262, 83%, 58%)';
      case 'seller-revenue':
      case 'admin-revenue':
        return 'hsl(217, 91%, 60%)';
      case 'admin-target':
        return 'hsl(32, 95%, 44%)';
      case 'admin-inventory':
        return 'hsl(187, 92%, 50%)';
      case 'admin-sellers':
        return 'hsl(330, 81%, 60%)';
      case 'admin-products':
        return 'hsl(199, 89%, 48%)';
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
