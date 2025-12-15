import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users, Trophy, Medal, Award } from 'lucide-react';
import { formatNumber } from '@/lib/utils';

interface SellerData {
  name: string;
  sales: number;
  revenue: number;
}

interface AdminTopSellersChartProps {
  sellers: SellerData[];
  maxRevenue?: number;
}

export const AdminTopSellersChart = ({ sellers, maxRevenue }: AdminTopSellersChartProps) => {
  const max = maxRevenue || (sellers.length > 0 ? Math.max(...sellers.map(s => s.revenue)) : 1);
  
  const getMedalIcon = (index: number) => {
    switch (index) {
      case 0: return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 1: return <Medal className="h-5 w-5 text-gray-400" />;
      case 2: return <Award className="h-5 w-5 text-amber-700" />;
      default: return null;
    }
  };

  const getRankBadgeColor = (index: number) => {
    switch (index) {
      case 0: return 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white border-0';
      case 1: return 'bg-gradient-to-r from-gray-300 to-gray-500 text-white border-0';
      case 2: return 'bg-gradient-to-r from-amber-500 to-amber-700 text-white border-0';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getProgressColor = (index: number) => {
    switch (index) {
      case 0: return 'bg-yellow-500';
      case 1: return 'bg-gray-400';
      case 2: return 'bg-amber-600';
      default: return 'bg-admin-sellers';
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getAvatarColor = (index: number) => {
    const colors = [
      'bg-gradient-to-br from-yellow-400 to-yellow-600',
      'bg-gradient-to-br from-gray-300 to-gray-500',
      'bg-gradient-to-br from-amber-500 to-amber-700',
      'bg-gradient-to-br from-admin-sellers/70 to-admin-sellers',
      'bg-gradient-to-br from-admin-revenue/70 to-admin-revenue',
    ];
    return colors[index] || colors[colors.length - 1];
  };

  return (
    <Card className="dark:admin-card-sellers h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5 text-admin-sellers" />
          Top 5 Vendeurs
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {sellers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Aucune donnée disponible</p>
          </div>
        ) : (
          sellers.map((seller, index) => (
            <div 
              key={index} 
              className="group relative p-3 rounded-xl bg-muted/30 dark:bg-muted/10 hover:bg-muted/50 dark:hover:bg-muted/20 transition-all duration-300 animate-fade-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-center gap-3">
                {/* Avatar with initials */}
                <div className={`relative flex-shrink-0 w-12 h-12 rounded-full ${getAvatarColor(index)} flex items-center justify-center text-white font-bold shadow-lg`}>
                  {getInitials(seller.name)}
                  {/* Medal overlay for top 3 */}
                  {index < 3 && (
                    <div className="absolute -top-1 -right-1">
                      {getMedalIcon(index)}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={`${getRankBadgeColor(index)} text-xs px-2`}>
                      #{index + 1}
                    </Badge>
                    <span className="font-semibold text-foreground truncate">{seller.name}</span>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="relative h-2 bg-muted/50 rounded-full overflow-hidden">
                    <div 
                      className={`absolute inset-y-0 left-0 ${getProgressColor(index)} rounded-full transition-all duration-700`}
                      style={{ width: `${(seller.revenue / max) * 100}%` }}
                    />
                  </div>
                  
                  <div className="flex justify-between mt-1 text-xs">
                    <span className="text-muted-foreground">{seller.sales} vente{seller.sales > 1 ? 's' : ''}</span>
                    <span className="font-bold text-admin-profit">{formatNumber(seller.revenue)} HTG</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};
