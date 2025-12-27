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
  const [displayCurrency, setDisplayCurrency] = useState<'USD' | 'HTG'>('HTG');

  const [tvaRate, setTvaRate] = useState(0);

  const fetchCompanySettings = async () => {
    const { data } = await supabase
      .from('company_settings')
      .select('usd_htg_rate, default_display_currency, tva_rate')
      .single();
    
    const rate = data?.usd_htg_rate || 132;
    const currency = (data?.default_display_currency || 'HTG') as 'USD' | 'HTG';
    const tva = data?.tva_rate || 0;
    
    setUsdHtgRate(rate);
    setDisplayCurrency(currency);
    setTvaRate(tva);
    
    return { rate, currency, tva };
  };

  const fetchStats = useCallback(async () => {
    if (!user) return;

    try {
      const { rate, currency, tva } = await fetchCompanySettings();

      const { data: allSales, error: allError } = await supabase
        .from('sales')
        .select('id, created_at')
        .eq('seller_id', user.id);

      if (allError) throw allError;

      const saleIds = allSales?.map(s => s.id) || [];
      let allSaleItems: any[] = [];
      if (saleIds.length > 0) {
        const { data: items } = await supabase
          .from('sale_items')
          .select('sale_id, product_name, quantity, subtotal, currency, profit_amount')
          .in('sale_id', saleIds);
        allSaleItems = items || [];
      }

      // Create a map of sale_id to sale for quick lookup
      const salesMap = new Map((allSales || []).map(s => [s.id, s]));

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

      // Calculate revenue TTC using sale_items with currency conversion (like AdminDashboardCharts)
      const calculateRevenueTTC = (salesList: any[]) => {
        const saleIdSet = new Set(salesList.map(s => s.id));
        const itemsForSales = allSaleItems.filter(item => saleIdSet.has(item.sale_id));
        
        // Use calculateUnifiedTotal from utils
        const { unified } = calculateUnifiedTotal(itemsForSales, rate, currency);
        
        // Apply TVA to get TTC
        return unified * (1 + tva / 100);
      };

      const totalRevenue = calculateRevenueTTC(allSales || []);
      const todayRevenue = calculateRevenueTTC(todaySales);
      const yesterdayRevenue = calculateRevenueTTC(yesterdaySales);
      const weekRevenue = calculateRevenueTTC(weekSales);
      const lastWeekRevenue = calculateRevenueTTC(lastWeekSales);
      const monthRevenue = calculateRevenueTTC(monthSales);
      const lastMonthRevenue = calculateRevenueTTC(lastMonthSales);

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
        
        const dayRevenue = calculateRevenueTTC(daySales);
        
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
        const itemRevenue = currency === 'USD'
          ? (item.currency === 'USD' ? item.subtotal : item.subtotal / rate)
          : (item.currency === 'USD' ? item.subtotal * rate : item.subtotal);
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
      
      // Fetch recent sales with the same settings to ensure consistency
      await fetchRecentSales(rate, currency, tva);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  const fetchRecentSales = useCallback(async (rate: number, currency: 'USD' | 'HTG', tva: number) => {
    if (!user) return;

    try {
      const { data: salesData, error } = await supabase
        .from('sales')
        .select('*')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      
      if (!salesData || salesData.length === 0) {
        setRecentSales([]);
        return;
      }

      // Fetch sale items for these sales to calculate proper amounts
      const saleIds = salesData.map(s => s.id);
      const { data: saleItems } = await supabase
        .from('sale_items')
        .select('sale_id, subtotal, currency')
        .in('sale_id', saleIds);

      // Calculate proper TTC for each sale using sale_items with passed parameters
      const enrichedSales = salesData.map(sale => {
        const itemsForSale = (saleItems || []).filter(item => item.sale_id === sale.id);
        const { unified } = calculateUnifiedTotal(itemsForSale, rate, currency);
        const ttc = unified * (1 + tva / 100);
        
        return {
          ...sale,
          displayAmount: ttc
        };
      });

      setRecentSales(enrichedSales);
    } catch (error) {
      console.error('Error fetching recent sales:', error);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user, fetchStats]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (user) {
        fetchStats();
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [user, fetchStats]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStats();
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
    <div className="space-y-3 sm:space-y-6">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 sm:px-2">
            <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1" />
            <span className="hidden sm:inline">MàJ:</span> {lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </Badge>
          <Badge 
            variant="outline" 
            className={`text-[10px] sm:text-xs px-1.5 sm:px-2 ${
              displayCurrency === 'USD' 
                ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700' 
                : 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700'
            }`}
          >
            {displayCurrency === 'USD' ? '$ USD' : 'HTG'}
          </Badge>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          disabled={refreshing}
          className="h-7 sm:h-8 text-xs sm:text-sm"
        >
          <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Actualiser</span>
        </Button>
      </div>

      {/* KPI Cards with Sparklines */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <KPICard
          title="Revenu Aujourd'hui"
          value={stats.todayRevenue}
          previousValue={stats.yesterdayRevenue}
          icon={DollarSign}
          sparklineData={revenueSparkline}
          colorScheme="seller-profit"
          currency={displayCurrency}
        />
        <KPICard
          title="Ventes"
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
          size="sm"
          currency={displayCurrency}
        />
        <KPICard
          title="Total Ventes"
          value={stats.totalSales}
          icon={TrendingUp}
          format="number"
          colorScheme="seller-revenue"
          size="sm"
        />
      </div>

      {/* Trend Chart - hidden on mobile */}
      <div className="hidden sm:block">
        <SellerTrendChart data={trendData} currency={displayCurrency} />
      </div>

      {/* Goals & Comparison Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <SellerGoalsCard
          todaySales={stats.todaySales}
          todayRevenue={stats.todayRevenue}
          averageDailySales={averageDailySales}
          averageDailyRevenue={averageDailyRevenue}
          currency={displayCurrency}
        />
        <SellerPerformanceComparison
          comparisons={[
            { 
              label: "Aujourd'hui vs Hier", 
              current: stats.todayRevenue, 
              previous: stats.yesterdayRevenue 
            },
            { 
              label: "Cette Semaine", 
              current: stats.weekRevenue, 
              previous: stats.lastWeekRevenue 
            },
            { 
              label: "Ce Mois", 
              current: stats.monthRevenue, 
              previous: stats.lastMonthRevenue 
            }
          ]}
          currency={displayCurrency}
        />
      </div>

      {/* Top Products & Recent Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {/* Top Products with Bar Chart */}
        <Card className="animate-fade-in-up dark:border-border/50 dark:bg-card/80" style={{ animationDelay: '300ms' }}>
          <CardHeader className="pb-1 sm:pb-2 px-3 sm:px-6">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <Package className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              Top 5 Produits
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            {stats.topProducts.length === 0 ? (
              <div className="text-center py-6 sm:py-8 text-muted-foreground">
                <Package className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                <p className="text-xs sm:text-base">Aucune vente enregistrée</p>
              </div>
            ) : (
              <>
                <div className="h-[140px] sm:h-[180px] mb-3 sm:mb-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topProductsChartData} layout="vertical" margin={{ left: 0, right: 40 }}>
                      <XAxis type="number" hide />
                      <YAxis 
                        type="category" 
                        dataKey="name" 
                        width={75}
                        tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-card border border-border rounded-lg shadow-lg p-2 sm:p-3 text-xs sm:text-sm">
                              <p className="font-medium">{data.fullName}</p>
                                <p className="text-muted-foreground">
                                  {displayCurrency === 'USD' ? `$${formatNumber(data.revenue)}` : `${formatNumber(data.revenue)} HTG`} • {data.quantity} unités
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
                <div className="space-y-1.5 sm:space-y-2">
                  {stats.topProducts.map((product, index) => {
                    const percent = totalProductRevenue > 0 
                      ? (product.revenue / totalProductRevenue * 100).toFixed(1) 
                      : 0;
                    return (
                      <div 
                        key={product.product_name} 
                        className="flex items-center justify-between text-xs sm:text-sm p-1.5 sm:p-2 rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                          <Badge 
                            variant={index === 0 ? 'default' : 'outline'} 
                            className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-[10px] sm:text-xs flex-shrink-0"
                          >
                            {index + 1}
                          </Badge>
                          <span className="truncate max-w-[100px] sm:max-w-[150px]">{product.product_name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                          <span className="text-muted-foreground text-[10px] sm:text-xs">{percent}%</span>
                          <span className="font-medium text-xs sm:text-sm">{displayCurrency === 'USD' ? `$${formatNumber(product.revenue)}` : formatNumber(product.revenue)}</span>
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
          <CardHeader className="pb-1 sm:pb-2 px-3 sm:px-6">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <Receipt className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              Ventes Récentes
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            {recentSales.length === 0 ? (
              <div className="text-center py-6 sm:py-8 text-muted-foreground">
                <Receipt className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                <p className="text-xs sm:text-base">Aucune vente récente</p>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {recentSales.map((sale, index) => (
                  <div 
                    key={sale.id} 
                    className="flex items-center justify-between p-2 sm:p-3 border rounded-lg hover:bg-accent/50 transition-all"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">
                        {sale.customer_name || 'Client anonyme'}
                      </div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground">
                        {new Date(sale.created_at).toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-xs sm:text-sm text-success dark:text-[hsl(160,84%,45%)]">
                        {displayCurrency === 'USD' 
                          ? `$${formatNumber(sale.displayAmount || Number(sale.total_amount) / usdHtgRate)}` 
                          : `${formatNumber(sale.displayAmount || Number(sale.total_amount))} HTG`
                        }
                      </div>
                      <Badge variant="outline" className="text-[9px] sm:text-xs px-1 sm:px-2">
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
