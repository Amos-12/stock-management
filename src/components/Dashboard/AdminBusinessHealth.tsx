import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Activity, TrendingUp, Package, Percent } from 'lucide-react';
import { formatNumber } from '@/lib/utils';

interface AdminBusinessHealthProps {
  revenue: number;
  revenueTarget: number;
  profitMargin: number;
  stockTurnover: number;
  lowStockCount: number;
  totalProducts: number;
}

export const AdminBusinessHealth = ({
  revenue,
  revenueTarget,
  profitMargin,
  stockTurnover,
  lowStockCount,
  totalProducts
}: AdminBusinessHealthProps) => {
  // Calculate health score (0-100)
  const revenueScore = Math.min((revenue / revenueTarget) * 100, 100) * 0.4;
  const marginScore = Math.min(profitMargin * 2, 40); // Max 40 points for 20%+ margin
  const stockHealthScore = Math.max(0, (1 - lowStockCount / totalProducts) * 20); // Max 20 points
  
  const healthScore = Math.round(revenueScore + marginScore + stockHealthScore);
  
  const getHealthStatus = () => {
    if (healthScore >= 80) return { label: 'Excellent', color: 'bg-admin-profit text-white', textColor: 'text-admin-profit' };
    if (healthScore >= 60) return { label: 'Bon', color: 'bg-admin-revenue text-white', textColor: 'text-admin-revenue' };
    if (healthScore >= 40) return { label: 'À surveiller', color: 'bg-admin-target text-white', textColor: 'text-admin-target' };
    return { label: 'Critique', color: 'bg-destructive text-white', textColor: 'text-destructive' };
  };

  const status = getHealthStatus();
  
  // Calculate circumference and offset for circular progress
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (healthScore / 100) * circumference;

  return (
    <Card className="dark:admin-card-profit overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-admin-profit" />
            Santé Business
          </CardTitle>
          <Badge className={status.color}>{status.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Circular Progress */}
        <div className="flex items-center justify-center">
          <div className="relative">
            <svg className="w-44 h-44 transform -rotate-90">
              {/* Background circle */}
              <circle
                cx="88"
                cy="88"
                r={radius}
                stroke="currentColor"
                strokeWidth="12"
                fill="none"
                className="text-muted/30"
              />
              {/* Progress circle */}
              <circle
                cx="88"
                cy="88"
                r={radius}
                stroke="url(#healthGradient)"
                strokeWidth="12"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-1000 ease-out"
              />
              <defs>
                <linearGradient id="healthGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="hsl(var(--admin-profit))" />
                  <stop offset="100%" stopColor="hsl(var(--admin-revenue))" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-4xl font-bold ${status.textColor}`}>{healthScore}</span>
              <span className="text-sm text-muted-foreground">/ 100</span>
            </div>
          </div>
        </div>

        {/* Mini Metrics */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-muted/50 dark:bg-muted/20">
            <div className="flex justify-center mb-1">
              <Percent className="h-4 w-4 text-admin-profit" />
            </div>
            <div className="text-lg font-bold text-admin-profit">{profitMargin.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground">Marge brute</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50 dark:bg-muted/20">
            <div className="flex justify-center mb-1">
              <TrendingUp className="h-4 w-4 text-admin-revenue" />
            </div>
            <div className="text-lg font-bold text-admin-revenue">{stockTurnover.toFixed(1)}x</div>
            <div className="text-xs text-muted-foreground">Rotation stock</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50 dark:bg-muted/20">
            <div className="flex justify-center mb-1">
              <Package className="h-4 w-4 text-admin-target" />
            </div>
            <div className="text-lg font-bold text-admin-target">{lowStockCount}</div>
            <div className="text-xs text-muted-foreground">Stock bas</div>
          </div>
        </div>

        {/* Revenue Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Objectif revenus</span>
            <span className="font-medium">{Math.round((revenue / revenueTarget) * 100)}%</span>
          </div>
          <Progress 
            value={Math.min((revenue / revenueTarget) * 100, 100)} 
            className="h-2 bg-muted/30"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatNumber(revenue)} HTG</span>
            <span>{formatNumber(revenueTarget)} HTG</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
