import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { KPICard } from '@/components/Dashboard/KPICard';
import { SellerGoalsCard } from '@/components/Dashboard/SellerGoalsCard';
import { SellerPerformanceComparison } from '@/components/Dashboard/SellerPerformanceComparison';
import { SellerTrendChart } from '@/components/Dashboard/SellerTrendChart';
import { 
  TrendingUp,
  Receipt,
  Package,
  DollarSign,
  ShoppingCart,
  RefreshCw,
  Clock,
  Zap
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatNumber, calculateUnifiedTotal } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from 'recharts';

interface TrendDataPoint {
  date: string;
  revenue: number;
  sales: number;
}

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
    yesterdaySales: 0,
    yesterdayRevenue: 0,
    lastWeekRevenue: 0,
    lastMonthRevenue: 0,
    topProducts: [] as { product_name: string; quantity: number; revenue: number }[]
  });
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [usdHtgRate, setUsdHtgRate] = useState(132);

  const fetchCompanySettings = async () => {
    const { data } = await supabase
      .from('company_settings')
      .select('usd_htg_rate')
      .single();
    if (data?.usd_htg_rate) {
      setUsdHtgRate(data.usd_htg_rate);
    }
    return data?.usd_htg_rate || 132;
  };

  const fetchStats = useCallback(async () => {
    if (!user) return;

    try {
      const rate = await fetchCompanySettings();

      const { data: allSales, error: allError } = await supabase
        .from('sales')
        .select('id, total_amount, created_at')
        .eq('seller_id', user.id);

      if (allError) throw allError;

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
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);

      const twoWeeksAgo = new Date(today);
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      const monthAgo = new Date(today);
      monthAgo.setDate(monthAgo.getDate() - 30);

      const twoMonthsAgo = new Date(today);
      twoMonthsAgo.setDate(twoMonthsAgo.getDate() - 60);

      // Filter sales by period
      const todaySales = allSales?.filter(s => new Date(s.created_at) >= today) || [];
      const yesterdaySales = allSales?.filter(s => {
        const d = new Date(s.created_at);
        return d >= yesterday && d < today;
      }) || [];
      const weekSales = allSales?.filter(s => new Date(s.created_at) >= weekAgo) || [];
      const lastWeekSales = allSales?.filter(s => {
        const d = new Date(s.created_at);
        return d >= twoWeeksAgo && d < weekAgo;
      }) || [];
      const monthSales = allSales?.filter(s => new Date(s.created_at) >= monthAgo) || [];
      const lastMonthSales = allSales?.filter(s => {
        const d = new Date(s.created_at);
        return d >= twoMonthsAgo && d < monthAgo;
      }) || [];

      // Calculate revenue with proper currency conversion
      const calculateRevenue = (salesList: any[]) => {
        const itemsForSales = allSaleItems.filter(i => 
          salesList.some(s => s.id === i.sale_id)
        );
        return calculateUnifiedTotal(itemsForSales, rate).unified;
      };

      const totalRevenue = calculateRevenue(allSales || []);
      const todayRevenue = calculateRevenue(todaySales);
      const yesterdayRevenue = calculateRevenue(yesterdaySales);
      const weekRevenue = calculateRevenue(weekSales);
      const lastWeekRevenue = calculateRevenue(lastWeekSales);
      const monthRevenue = calculateRevenue(monthSales);
      const lastMonthRevenue = calculateRevenue(lastMonthSales);

      // Calculate trend data for last 7 days
      const trendDataCalc: TrendDataPoint[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        
        const daySales = allSales?.filter(s => {
          const d = new Date(s.created_at);
          return d >= date && d < nextDate;
        }) || [];
        
        const dayRevenue = calculateRevenue(daySales);
        
        trendDataCalc.push({
          date: date.toLocaleDateString('fr-FR', { weekday: 'short' }),
          revenue: dayRevenue,
          sales: daySales.length
        });
      }
      setTrendData(trendDataCalc);

      // Top products with unified currency
      const productStats = allSaleItems.reduce((acc: any, item: any) => {
        if (!acc[item.product_name]) {
          acc[item.product_name] = { product_name: item.product_name, quantity: 0, revenue: 0 };
        }
        acc[item.product_name].quantity += Number(item.quantity);
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
      const averageDailySales = monthSales.length / 30;
      const averageDailyRevenue = monthRevenue / 30;

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
        yesterdaySales: yesterdaySales.length,
        yesterdayRevenue,
        lastWeekRevenue,
        lastMonthRevenue,
        topProducts: topProducts as any
      });

      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  const fetchRecentSales = useCallback(async () => {
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
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchStats();
      fetchRecentSales();
    }
  }, [user, fetchStats, fetchRecentSales]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (user) {
        fetchStats();
        fetchRecentSales();
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [user, fetchStats, fetchRecentSales]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStats();
    fetchRecentSales();
  };

  // Sparkline data for KPIs
  const revenueSparkline = trendData.map(d => ({ value: d.revenue }));
  const salesSparkline = trendData.map(d => ({ value: d.sales }));

  // Average calculations
  const averageDailySales = stats.monthSales / 30;
  const averageDailyRevenue = stats.monthRevenue / 30;

  // Top products for bar chart
  const topProductsChartData = stats.topProducts.map((p, i) => ({
    name: p.product_name.length > 15 ? p.product_name.substring(0, 15) + '...' : p.product_name,
    fullName: p.product_name,
    revenue: p.revenue,
    quantity: p.quantity,
    rank: i + 1
  }));

  const totalProductRevenue = stats.topProducts.reduce((sum, p) => sum + p.revenue, 0);

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
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            <Clock className="w-3 h-3 mr-1" />
            MàJ: {lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </Badge>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* KPI Cards with Sparklines */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Revenu Aujourd'hui"
          value={stats.todayRevenue}
          previousValue={stats.yesterdayRevenue}
          icon={DollarSign}
          sparklineData={revenueSparkline}
          colorScheme="seller-profit"
        />
        <KPICard
          title="Ventes Aujourd'hui"
          value={stats.todaySales}
          previousValue={stats.yesterdaySales}
          icon={Receipt}
          format="number"
          sparklineData={salesSparkline}
          colorScheme="seller-sales"
        />
        <KPICard
          title="Panier Moyen"
          value={stats.averageSale}
          icon={ShoppingCart}
          colorScheme="seller-average"
        />
        <KPICard
          title="Total Ventes"
          value={stats.totalSales}
          icon={TrendingUp}
          format="number"
          colorScheme="seller-revenue"
        />
      </div>

      {/* Trend Chart */}
      <SellerTrendChart data={trendData} />

      {/* Goals & Comparison Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SellerGoalsCard
          todaySales={stats.todaySales}
          todayRevenue={stats.todayRevenue}
          averageDailySales={averageDailySales}
          averageDailyRevenue={averageDailyRevenue}
        />
        <SellerPerformanceComparison
          comparisons={[
            { 
              label: "Aujourd'hui vs Hier", 
              current: stats.todayRevenue, 
              previous: stats.yesterdayRevenue 
            },
            { 
              label: "Cette Semaine vs Semaine Dernière", 
              current: stats.weekRevenue, 
              previous: stats.lastWeekRevenue 
            },
            { 
              label: "Ce Mois vs Mois Dernier", 
              current: stats.monthRevenue, 
              previous: stats.lastMonthRevenue 
            }
          ]}
        />
      </div>

      {/* Top Products & Recent Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Products with Bar Chart */}
        <Card className="animate-fade-in-up dark:border-border/50 dark:bg-card/80" style={{ animationDelay: '300ms' }}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="w-5 h-5 text-primary" />
              Top 5 Produits
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.topProducts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Aucune vente enregistrée</p>
              </div>
            ) : (
              <>
                <div className="h-[180px] mb-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topProductsChartData} layout="vertical" margin={{ left: 0, right: 50 }}>
                      <XAxis type="number" hide />
                      <YAxis 
                        type="category" 
                        dataKey="name" 
                        width={100}
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-card border border-border rounded-lg shadow-lg p-3">
                                <p className="text-sm font-medium">{data.fullName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatNumber(data.revenue)} HTG • {data.quantity} unités
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar 
                        dataKey="revenue" 
                        radius={[0, 4, 4, 0]}
                        animationDuration={1000}
                      >
                        {topProductsChartData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={index === 0 ? 'hsl(var(--primary))' : `hsl(var(--primary) / ${1 - index * 0.15})`}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {stats.topProducts.map((product, index) => {
                    const percent = totalProductRevenue > 0 
                      ? (product.revenue / totalProductRevenue * 100).toFixed(1) 
                      : 0;
                    return (
                      <div 
                        key={product.product_name} 
                        className="flex items-center justify-between text-sm p-2 rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={index === 0 ? 'default' : 'outline'} 
                            className="w-6 h-6 flex items-center justify-center text-xs"
                          >
                            {index + 1}
                          </Badge>
                          <span className="truncate max-w-[150px]">{product.product_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground text-xs">{percent}%</span>
                          <span className="font-medium">{formatNumber(product.revenue)} HTG</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Recent Sales */}
        <Card className="animate-fade-in-up dark:border-border/50 dark:bg-card/80" style={{ animationDelay: '350ms' }}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="w-5 h-5 text-primary" />
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
                {recentSales.map((sale, index) => (
                  <div 
                    key={sale.id} 
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-all hover:scale-[1.01]"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div>
                      <div className="font-medium text-sm">
                        {sale.customer_name || 'Client anonyme'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(sale.created_at).toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-success dark:text-[hsl(160,84%,45%)]">{formatNumber(Number(sale.total_amount))} HTG</div>
                      <Badge variant="outline" className="text-xs">
                        {sale.payment_method || 'N/A'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
