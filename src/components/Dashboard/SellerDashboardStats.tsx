import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatsCard } from '@/components/Dashboard/StatsCard';
import { 
  TrendingUp,
  Receipt,
  Package,
  DollarSign
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const SellerDashboardStats = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalSales: 0,
    todaySales: 0,
    totalRevenue: 0,
    todayRevenue: 0
  });
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    fetchRecentSales();
  }, []);

  const fetchStats = async () => {
    if (!user) return;

    try {
      // Total sales count and revenue
      const { data: allSales, error: allError } = await supabase
        .from('sales')
        .select('total_amount')
        .eq('seller_id', user.id);

      if (allError) throw allError;

      // Today's sales
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data: todaySales, error: todayError } = await supabase
        .from('sales')
        .select('total_amount')
        .eq('seller_id', user.id)
        .gte('created_at', today.toISOString());

      if (todayError) throw todayError;

      setStats({
        totalSales: allSales?.length || 0,
        todaySales: todaySales?.length || 0,
        totalRevenue: allSales?.reduce((sum, sale) => sum + Number(sale.total_amount), 0) || 0,
        todayRevenue: todaySales?.reduce((sum, sale) => sum + Number(sale.total_amount), 0) || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentSales = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setRecentSales(data || []);
    } catch (error) {
      console.error('Error fetching recent sales:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Package className="w-8 h-8 text-primary animate-pulse" />
        <span className="ml-2 text-muted-foreground">Chargement...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Ventes Aujourd'hui"
          value={stats.todaySales.toString()}
          icon={Receipt}
        />
        <StatsCard
          title="Revenu Aujourd'hui"
          value={`${stats.todayRevenue.toFixed(2)} €`}
          icon={DollarSign}
        />
        <StatsCard
          title="Total Ventes"
          value={stats.totalSales.toString()}
          icon={TrendingUp}
        />
        <StatsCard
          title="Revenu Total"
          value={`${stats.totalRevenue.toFixed(2)} €`}
          icon={DollarSign}
        />
      </div>

      {/* Recent Sales */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Ventes Récentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentSales.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Aucune vente récente</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-smooth">
                  <div>
                    <div className="font-medium">
                      {sale.customer_name || 'Client non renseigné'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(sale.created_at).toLocaleString('fr-FR')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-success">{Number(sale.total_amount).toFixed(2)} €</div>
                    <div className="text-xs text-muted-foreground">{sale.payment_method}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
