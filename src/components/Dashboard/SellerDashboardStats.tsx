import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatsCard } from '@/components/Dashboard/StatsCard';
import { 
  TrendingUp,
  Receipt,
  Package,
  DollarSign,
  ShoppingCart,
  Calendar
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { formatNumber, calculateUnifiedTotal, calculateUnifiedProfit } from '@/lib/utils';

export const SellerDashboardStats = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalSales: 0,
    todaySales: 0,
    totalRevenue: 0,
    todayRevenue: 0,
    weekSales: 0,
    weekRevenue: 0,
    monthSales: 0,
    monthRevenue: 0,
    averageSale: 0,
    topProducts: [] as { product_name: string; quantity: number; revenue: number }[]
  });
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [usdHtgRate, setUsdHtgRate] = useState(132);

  useEffect(() => {
    if (user) {
      fetchCompanySettings();
      fetchStats();
      fetchRecentSales();
    }
  }, [user]);

  const fetchCompanySettings = async () => {
    const { data } = await supabase
      .from('company_settings')
      .select('usd_htg_rate')
      .single();
    if (data?.usd_htg_rate) {
      setUsdHtgRate(data.usd_htg_rate);
    }
  };

  const fetchStats = async () => {
    if (!user) return;

    try {
      // Get all sales for this seller
      const { data: allSales, error: allError } = await supabase
        .from('sales')
        .select('id, total_amount, created_at')
        .eq('seller_id', user.id);

      if (allError) throw allError;

      // Fetch company settings for rate
      const { data: settings } = await supabase
        .from('company_settings')
        .select('usd_htg_rate')
        .single();
      const rate = settings?.usd_htg_rate || 132;

      // Fetch ALL sale_items with currency for all sales
      const saleIds = allSales?.map(s => s.id) || [];
      let allSaleItems: any[] = [];
      if (saleIds.length > 0) {
        const { data: items } = await supabase
          .from('sale_items')
          .select('sale_id, product_name, quantity, subtotal, currency')
          .in('sale_id', saleIds);
        allSaleItems = items || [];
      }

      // Date calculations
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      weekAgo.setHours(0, 0, 0, 0);

      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);
      monthAgo.setHours(0, 0, 0, 0);

      // Filter sales by period
      const todaySales = allSales?.filter(s => new Date(s.created_at) >= today) || [];
      const weekSales = allSales?.filter(s => new Date(s.created_at) >= weekAgo) || [];
      const monthSales = allSales?.filter(s => new Date(s.created_at) >= monthAgo) || [];

      // Calculate revenue with proper currency conversion
      const calculateRevenue = (salesList: any[]) => {
        const itemsForSales = allSaleItems.filter(i => 
          salesList.some(s => s.id === i.sale_id)
        );
        return calculateUnifiedTotal(itemsForSales, rate).unified;
      };

      const totalRevenue = calculateRevenue(allSales || []);
      const todayRevenue = calculateRevenue(todaySales);
      const weekRevenue = calculateRevenue(weekSales);
      const monthRevenue = calculateRevenue(monthSales);

      // Top products with unified currency
      const productStats = allSaleItems.reduce((acc: any, item: any) => {
        if (!acc[item.product_name]) {
          acc[item.product_name] = { product_name: item.product_name, quantity: 0, revenue: 0 };
        }
        acc[item.product_name].quantity += Number(item.quantity);
        // Convert USD to HTG for unified total
        const itemRevenue = item.currency === 'USD' 
          ? item.subtotal * rate 
          : item.subtotal;
        acc[item.product_name].revenue += itemRevenue;
        return acc;
      }, {});

      const topProducts = Object.values(productStats || {})
        .sort((a: any, b: any) => b.revenue - a.revenue)
        .slice(0, 5);

      const averageSale = allSales?.length ? totalRevenue / allSales.length : 0;

      setStats({
        totalSales: allSales?.length || 0,
        todaySales: todaySales.length,
        totalRevenue,
        todayRevenue,
        weekSales: weekSales.length,
        weekRevenue,
        monthSales: monthSales.length,
        monthRevenue,
        averageSale,
        topProducts: topProducts as any
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
      {/* Stats Grid - matching Admin style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Ventes Aujourd'hui"
          value={stats.todaySales.toString()}
          icon={Receipt}
          variant="success"
          change={{
            value: stats.weekSales > 0 ? Number(((stats.todaySales / stats.weekSales) * 100).toFixed(2)) : 0,
            isPositive: stats.todaySales > 0,
            label: "cette semaine"
          }}
        />
        <StatsCard
          title="Revenu Aujourd'hui"
          value={`${formatNumber(stats.todayRevenue)} HTG`}
          icon={DollarSign}
          variant="default"
          change={{
            value: stats.weekRevenue > 0 ? Number(((stats.todayRevenue / stats.weekRevenue) * 100).toFixed(2)) : 0,
            isPositive: stats.todayRevenue > 0,
            label: "cette semaine"
          }}
        />
        <StatsCard
          title="Total Ventes"
          value={stats.totalSales.toString()}
          icon={TrendingUp}
          variant="default"
        />
        <StatsCard
          title="Revenu Total"
          value={`${formatNumber(stats.totalRevenue)} HTG`}
          icon={DollarSign}
          variant="success"
        />
      </div>

      {/* Additional Stats - Enhanced with icons and variants */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatsCard
          title="Ventes cette Semaine"
          value={`${formatNumber(stats.weekRevenue)} HTG`}
          icon={Calendar}
          variant="default"
          change={{
            value: stats.weekSales,
            isPositive: stats.weekSales > 0,
            label: `${stats.weekSales} vente${stats.weekSales > 1 ? 's' : ''}`
          }}
        />
        
        <StatsCard
          title="Ventes ce Mois"
          value={`${formatNumber(stats.monthRevenue)} HTG`}
          icon={Calendar}
          variant="success"
          change={{
            value: stats.monthSales,
            isPositive: stats.monthSales > 0,
            label: `${stats.monthSales} vente${stats.monthSales > 1 ? 's' : ''}`
          }}
        />
        
        <StatsCard
          title="Moyenne par Vente"
          value={`${formatNumber(stats.averageSale)} HTG`}
          icon={ShoppingCart}
          variant="default"
        />
      </div>

      {/* Top Products & Recent Sales - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Products */}
        {stats.topProducts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Top 5 Produits
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.topProducts.map((product, index) => (
                  <div key={product.product_name} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="w-8 h-8 flex items-center justify-center">
                        {index + 1}
                      </Badge>
                      <div>
                        <div className="font-medium">{product.product_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {product.quantity} unités vendues
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-primary">{formatNumber(product.revenue)} HTG</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Sales */}
        <Card>
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
                      <div className="font-bold text-success">{formatNumber(Number(sale.total_amount))} HTG</div>
                      <div className="text-xs text-muted-foreground">{sale.payment_method}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Analytics Zone */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Analyse des Performances
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Croissance Hebdomadaire</p>
              <p className="text-2xl font-bold text-primary">
                {stats.weekSales > 0 ? '+' : ''}{stats.weekSales}
              </p>
              <p className="text-xs text-muted-foreground">ventes cette semaine</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Revenu Mensuel</p>
              <p className="text-lg font-bold text-primary">
                {formatNumber(stats.monthRevenue)} HTG
              </p>
              <p className="text-xs text-muted-foreground">{stats.monthSales} ventes ce mois</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Performance Journalière</p>
              <p className="text-2xl font-bold text-primary">
                {((stats.todayRevenue / (stats.averageSale || 1)) * 100).toFixed(0)}%
              </p>
              <p className="text-xs text-muted-foreground">par rapport à la moyenne</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
