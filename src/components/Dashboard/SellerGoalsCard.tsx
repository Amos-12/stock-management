import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Trophy, Target, TrendingUp } from 'lucide-react';
import { formatNumber } from '@/lib/utils';

interface SellerGoalsCardProps {
  todaySales: number;
  todayRevenue: number;
  averageDailySales: number;
  averageDailyRevenue: number;
}

export const SellerGoalsCard = ({
  todaySales,
  todayRevenue,
  averageDailySales,
  averageDailyRevenue,
}: SellerGoalsCardProps) => {
  // Goals based on average + 20% stretch target
  const salesGoal = Math.max(Math.ceil(averageDailySales * 1.2), 1);
  const revenueGoal = Math.max(averageDailyRevenue * 1.2, 1000);
  
  const salesProgress = Math.min((todaySales / salesGoal) * 100, 100);
  const revenueProgress = Math.min((todayRevenue / revenueGoal) * 100, 100);
  
  const salesAchieved = todaySales >= salesGoal;
  const revenueAchieved = todayRevenue >= revenueGoal;

  return (
    <Card className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="w-5 h-5 text-primary" />
          Objectifs du Jour
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Sales Goal */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Ventes</span>
            <div className="flex items-center gap-2">
              {salesAchieved && (
                <Trophy className="w-4 h-4 text-yellow-500 animate-pulse" />
              )}
              <span className="text-sm font-bold">
                {todaySales} / {salesGoal}
              </span>
            </div>
          </div>
          <Progress 
            value={salesProgress} 
            className={`h-2 transition-all duration-500 ${salesAchieved ? '[&>div]:bg-yellow-500' : ''}`}
          />
          <p className="text-xs text-muted-foreground">
            {salesAchieved 
              ? '🎉 Objectif atteint !' 
              : `${salesGoal - todaySales} vente${salesGoal - todaySales > 1 ? 's' : ''} restante${salesGoal - todaySales > 1 ? 's' : ''}`
            }
          </p>
        </div>

        {/* Revenue Goal */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Revenu</span>
            <div className="flex items-center gap-2">
              {revenueAchieved && (
                <Trophy className="w-4 h-4 text-yellow-500 animate-pulse" />
              )}
              <span className="text-sm font-bold">
                {formatNumber(todayRevenue)} / {formatNumber(revenueGoal)} HTG
              </span>
            </div>
          </div>
          <Progress 
            value={revenueProgress} 
            className={`h-2 transition-all duration-500 ${revenueAchieved ? '[&>div]:bg-yellow-500' : ''}`}
          />
          <p className="text-xs text-muted-foreground">
            {revenueAchieved 
              ? '🎉 Objectif atteint !' 
              : `${formatNumber(revenueGoal - todayRevenue)} HTG restants`
            }
          </p>
        </div>

        {/* Motivation */}
        <div className="pt-2 border-t">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp className="w-3 h-3" />
            <span>Objectifs basés sur votre moyenne +20%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
