import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';
import { formatNumber } from '@/lib/utils';

interface ComparisonData {
  label: string;
  current: number;
  previous: number;
  suffix?: string;
}

interface SellerPerformanceComparisonProps {
  comparisons: ComparisonData[];
}

export const SellerPerformanceComparison = ({ comparisons }: SellerPerformanceComparisonProps) => {
  const getChangePercent = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  return (
    <Card className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="w-5 h-5 text-primary" />
          Comparaison de Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {comparisons.map((item, index) => {
          const change = getChangePercent(item.current, item.previous);
          const isPositive = change > 0;
          const isNeutral = Math.abs(change) < 0.1;

          return (
            <div 
              key={item.label} 
              className="flex items-center justify-between p-3 rounded-lg bg-accent/50 hover:bg-accent transition-colors"
              style={{ animationDelay: `${(index + 1) * 100}ms` }}
            >
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="font-semibold">
                  {formatNumber(item.current)}{item.suffix || ' HTG'}
                </p>
              </div>
              <div className="text-right space-y-1">
                <div className="flex items-center gap-1 justify-end">
                  {isNeutral ? (
                    <Minus className="w-4 h-4 text-muted-foreground" />
                  ) : isPositive ? (
                    <TrendingUp className="w-4 h-4 text-green-500" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-500" />
                  )}
                  <span className={`text-sm font-bold ${
                    isNeutral 
                      ? 'text-muted-foreground' 
                      : isPositive 
                        ? 'text-green-500' 
                        : 'text-red-500'
                  }`}>
                    {isPositive ? '+' : ''}{change.toFixed(1)}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  vs {formatNumber(item.previous)}{item.suffix || ' HTG'}
                </p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
