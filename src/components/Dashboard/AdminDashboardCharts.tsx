import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
  LabelList
} from 'recharts';
import { 
  Calendar, 
  TrendingUp, 
  Package, 
  DollarSign, 
  ShoppingCart, 
  Users, 
  Target, 
  RefreshCw,
  Clock,
  Wallet,
  BarChart3
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { KPICard } from './KPICard';
import { AdminBusinessHealth } from './AdminBusinessHealth';
import { AdminTopSellersChart } from './AdminTopSellersChart';
import { formatNumber, calculateUnifiedTotal, calculateUnifiedProfit } from '@/lib/utils';

interface RevenueData {
  date: string;
  revenue: number;
  profit: number;
  sales: number;
}

interface ProductSalesData {
  name: string;
  sales: number;
  revenue: number;
  percent?: number;
}

interface CategoryData {
  name: string;
  value: number;
  color: string;
}

interface SellerData {
  name: string;
  sales: number;
  revenue: number;
}

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

export const AdminDashboardCharts = () => {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [topProducts, setTopProducts] = useState<ProductSalesData[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [topSellers, setTopSellers] = useState<SellerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  // Stats data
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [weekRevenue, setWeekRevenue] = useState(0);
  const [monthRevenue, setMonthRevenue] = useState(0);
  const [todaySales, setTodaySales] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalSellers, setTotalSellers] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [avgBasket, setAvgBasket] = useState(0);
  
  // Profit stats
  const [todayProfit, setTodayProfit] = useState(0);
  const [weekProfit, setWeekProfit] = useState(0);
  const [monthProfit, setMonthProfit] = useState(0);
  
  // Trending data
  const [yesterdayRevenue, setYesterdayRevenue] = useState(0);
  const [yesterdayProfit, setYesterdayProfit] = useState(0);
  const [prevWeekRevenue, setPrevWeekRevenue] = useState(0);
  const [prevMonthRevenue, setPrevMonthRevenue] = useState(0);
  const [usdHtgRate, setUsdHtgRate] = useState(132);

  // Sparkline data
  const [revenueSparkline, setRevenueSparkline] = useState<number[]>([]);
  const [profitSparkline, setProfitSparkline] = useState<number[]>([]);
  const [salesSparkline, setSalesSparkline] = useState<number[]>([]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchCompanySettings(),
        fetchStatsData(),
        fetchRevenueData(),
        fetchTopProducts(),
        fetchCategoryData(),
        fetchTopSellers(),
        fetchSparklineData()
      ]);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching chart data:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // Auto-refresh every 60s
    return () => clearInterval(interval);
  }, [fetchData]);

  const fetchCompanySettings = async () => {
    const { data } = await supabase
      .from('company_settings')
      .select('usd_htg_rate')
      .single();
    if (data?.usd_htg_rate) {
      setUsdHtgRate(data.usd_htg_rate);
    }
  };

  const fetchSparklineData = async () => {
    const days = 7;
    const sparklineRevenue: number[] = [];
    const sparklineProfit: number[] = [];
    const sparklineSales: number[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const { data: items } = await supabase
        .from('sale_items')
        .select('subtotal, profit_amount, currency, sales!inner(created_at)')
        .gte('sales.created_at', dayStart.toISOString())
        .lte('sales.created_at', dayEnd.toISOString());

      const { data: salesData } = await supabase
        .from('sales')
        .select('id')
        .gte('created_at', dayStart.toISOString())
        .lte('created_at', dayEnd.toISOString());

      const { data: settings } = await supabase
        .from('company_settings')
        .select('usd_htg_rate')
        .single();
      const rate = settings?.usd_htg_rate || 132;

      sparklineRevenue.push(calculateUnifiedTotal(items || [], rate).unified);
      sparklineProfit.push(calculateUnifiedProfit(items || [], rate));
      sparklineSales.push(salesData?.length || 0);
    }

    setRevenueSparkline(sparklineRevenue);
    setProfitSparkline(sparklineProfit);
    setSalesSparkline(sparklineSales);
  };

  const calcTrend = (current: number, previous: number) => {
    if (previous === 0) {
      if (current > 0) return { value: 100, isPositive: true };
      return { value: 0, isPositive: false };
    }
    const percent = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(Math.round(percent * 10) / 10),
      isPositive: current >= previous
    };
  };

  const fetchStatsData = async () => {
    try {
      const { data: settings } = await supabase
        .from('company_settings')
        .select('usd_htg_rate')
        .single();
      const rate = settings?.usd_htg_rate || 132;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Today's data
      const { data: todayData } = await supabase
        .from('sales')
        .select('id')
        .gte('created_at', today.toISOString());
      
      setTodaySales(todayData?.length || 0);

      const { data: todayItems } = await supabase
        .from('sale_items')
        .select('subtotal, profit_amount, currency, sales!inner(created_at)')
        .gte('sales.created_at', today.toISOString());
      
      const todayRev = calculateUnifiedTotal(todayItems || [], rate).unified;
      const todayPft = calculateUnifiedProfit(todayItems || [], rate);
      setTodayRevenue(todayRev);
      setTodayProfit(todayPft);

      // Average basket
      if (todayData && todayData.length > 0) {
        setAvgBasket(todayRev / todayData.length);
      }

      // Yesterday's data
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const { data: yesterdayItems } = await supabase
        .from('sale_items')
        .select('subtotal, profit_amount, currency, sales!inner(created_at)')
        .gte('sales.created_at', yesterday.toISOString())
        .lt('sales.created_at', today.toISOString());
      
      setYesterdayRevenue(calculateUnifiedTotal(yesterdayItems || [], rate).unified);
      setYesterdayProfit(calculateUnifiedProfit(yesterdayItems || [], rate));

      // Week data
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const { data: weekItems } = await supabase
        .from('sale_items')
        .select('subtotal, profit_amount, currency, sales!inner(created_at)')
        .gte('sales.created_at', weekAgo.toISOString());
      
      setWeekRevenue(calculateUnifiedTotal(weekItems || [], rate).unified);
      setWeekProfit(calculateUnifiedProfit(weekItems || [], rate));

      // Previous week
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const { data: prevWeekItems } = await supabase
        .from('sale_items')
        .select('subtotal, profit_amount, currency, sales!inner(created_at)')
        .gte('sales.created_at', twoWeeksAgo.toISOString())
        .lt('sales.created_at', weekAgo.toISOString());
      
      setPrevWeekRevenue(calculateUnifiedTotal(prevWeekItems || [], rate).unified);

      // Month data
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const { data: monthItems } = await supabase
        .from('sale_items')
        .select('subtotal, profit_amount, currency, sales!inner(created_at)')
        .gte('sales.created_at', monthAgo.toISOString());
      
      setMonthRevenue(calculateUnifiedTotal(monthItems || [], rate).unified);
      setMonthProfit(calculateUnifiedProfit(monthItems || [], rate));

      // Previous month
      const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      const { data: prevMonthItems } = await supabase
        .from('sale_items')
        .select('subtotal, profit_amount, currency, sales!inner(created_at)')
        .gte('sales.created_at', twoMonthsAgo.toISOString())
        .lt('sales.created_at', monthAgo.toISOString());
      
      setPrevMonthRevenue(calculateUnifiedTotal(prevMonthItems || [], rate).unified);

      // Products count
      const { count: productsCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
      
      setTotalProducts(productsCount || 0);

      // Low stock count
      const { data: lowStock } = await supabase
        .from('products')
        .select('id, quantity, alert_threshold')
        .eq('is_active', true);
      
      const lowStockItems = lowStock?.filter(p => p.quantity <= p.alert_threshold) || [];
      setLowStockCount(lowStockItems.length);

      // Sellers count
      const { count: sellersCount } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'seller')
        .eq('is_active', true);
      
      setTotalSellers(sellersCount || 0);

    } catch (error) {
      console.error('Error fetching stats data:', error);
    }
  };

  const fetchRevenueData = async () => {
    const daysBack = period === 'daily' ? 7 : period === 'weekly' ? 28 : 90;
    
    const chartData: RevenueData[] = [];
    
    for (let i = daysBack - 1; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const { data: items } = await supabase
        .from('sale_items')
        .select('subtotal, profit_amount, currency, sales!inner(created_at)')
        .gte('sales.created_at', dayStart.toISOString())
        .lte('sales.created_at', dayEnd.toISOString());

      const { data: salesCount } = await supabase
        .from('sales')
        .select('id')
        .gte('created_at', dayStart.toISOString())
        .lte('created_at', dayEnd.toISOString());

      const revenue = calculateUnifiedTotal(items || [], usdHtgRate).unified;
      const profit = calculateUnifiedProfit(items || [], usdHtgRate);

      chartData.push({
        date: dayStart.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        revenue,
        profit,
        sales: salesCount?.length || 0
      });
    }

    setRevenueData(chartData);
  };

  const fetchTopProducts = async () => {
    const daysBack = period === 'daily' ? 7 : period === 'weekly' ? 28 : 365;
    const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
    
    const { data, error } = await supabase
      .from('sale_items')
      .select('product_name, quantity, subtotal, currency, sales!inner(created_at)')
      .gte('sales.created_at', startDate.toISOString());

    if (error) throw error;

    const grouped = data?.reduce((acc: Record<string, { sales: number; revenue: number }>, item) => {
      if (!acc[item.product_name]) {
        acc[item.product_name] = { sales: 0, revenue: 0 };
      }
      acc[item.product_name].sales += Number(item.quantity);
      const itemRevenue = item.currency === 'USD' 
        ? item.subtotal * usdHtgRate 
        : item.subtotal;
      acc[item.product_name].revenue += itemRevenue;
      return acc;
    }, {});

    const totalRevenue = Object.values(grouped).reduce((sum: number, p) => sum + p.revenue, 0);

    const topProductsData = Object.entries(grouped)
      .map(([name, data]) => ({
        name: name.length > 20 ? name.slice(0, 20) + '...' : name,
        sales: data.sales,
        revenue: data.revenue,
        percent: totalRevenue > 0 ? Math.round((data.revenue / totalRevenue) * 100) : 0
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    setTopProducts(topProductsData);
  };

  const fetchCategoryData = async () => {
    const { data: products } = await supabase
      .from('products')
      .select('category');

    const categories = products?.reduce((acc: any, product) => {
      acc[product.category] = (acc[product.category] || 0) + 1;
      return acc;
    }, {}) || {};

    const chartData = Object.entries(categories).map(([name, value]: [string, any], index) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: COLORS[index % COLORS.length]
    }));

    setCategoryData(chartData);
  };

  const fetchTopSellers = async () => {
    try {
      const { data: salesData } = await supabase
        .from('sales')
        .select('seller_id, total_amount');

      const sellerGroups = salesData?.reduce((acc: any, sale) => {
        if (!acc[sale.seller_id]) {
          acc[sale.seller_id] = { sales: 0, revenue: 0 };
        }
        acc[sale.seller_id].sales += 1;
        acc[sale.seller_id].revenue += sale.total_amount;
        return acc;
      }, {}) || {};

      const sellerIds = Object.keys(sellerGroups);
      if (sellerIds.length === 0) {
        setTopSellers([]);
        return;
      }

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', sellerIds);

      const sellers = sellerIds
        .map(sellerId => {
          const profile = profilesData?.find(p => p.user_id === sellerId);
          const stats = sellerGroups[sellerId];
          return {
            name: profile?.full_name || 'Vendeur inconnu',
            sales: stats.sales,
            revenue: stats.revenue
          };
        })
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      setTopSellers(sellers);
    } catch (error) {
      console.error('Error fetching top sellers:', error);
      setTopSellers([]);
    }
  };

  const profitMargin = todayRevenue > 0 ? (todayProfit / todayRevenue) * 100 : 0;
  const stockTurnover = 2.5; // Placeholder - would need historical data to calculate

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-32 flex items-center justify-center">
                <div className="text-muted-foreground">Chargement...</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with refresh and indicators */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Tableau de Bord</h2>
          <div className="flex items-center gap-3 mt-1">
            <Badge variant="outline" className="flex items-center gap-1.5 text-xs">
              <Clock className="h-3 w-3" />
              Dernière MàJ: {lastUpdated.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1.5 text-xs bg-muted/50">
              <DollarSign className="h-3 w-3 text-primary" />
              1 USD = {formatNumber(usdHtgRate)} HTG
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={(value: any) => setPeriod(value)}>
            <SelectTrigger className="w-44">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">7 derniers jours</SelectItem>
              <SelectItem value="weekly">4 semaines</SelectItem>
              <SelectItem value="monthly">3 mois</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* KPI Cards - Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="animate-fade-in" style={{ animationDelay: '0ms' }}>
          <KPICard
            title="Revenus Aujourd'hui"
            value={todayRevenue}
            previousValue={yesterdayRevenue}
            icon={DollarSign}
            format="currency"
            currency="HTG"
            sparklineData={revenueSparkline.map(v => ({ value: v }))}
            colorScheme="admin-revenue"
          />
        </div>
        <div className="animate-fade-in" style={{ animationDelay: '50ms' }}>
          <KPICard
            title="Bénéfices Aujourd'hui"
            value={todayProfit}
            previousValue={yesterdayProfit}
            icon={TrendingUp}
            format="currency"
            currency="HTG"
            sparklineData={profitSparkline.map(v => ({ value: v }))}
            colorScheme="admin-profit"
          />
        </div>
        <div className="animate-fade-in" style={{ animationDelay: '100ms' }}>
          <KPICard
            title="Revenus Semaine"
            value={weekRevenue}
            previousValue={prevWeekRevenue}
            icon={Wallet}
            format="currency"
            currency="HTG"
            colorScheme="admin-sales"
          />
        </div>
        <div className="animate-fade-in" style={{ animationDelay: '150ms' }}>
          <KPICard
            title="Revenus Mois"
            value={monthRevenue}
            previousValue={prevMonthRevenue}
            icon={Target}
            format="currency"
            currency="HTG"
            colorScheme="admin-target"
          />
        </div>
      </div>

      {/* KPI Cards - Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="animate-fade-in" style={{ animationDelay: '200ms' }}>
          <KPICard
            title="Ventes Aujourd'hui"
            value={todaySales}
            icon={ShoppingCart}
            format="number"
            sparklineData={salesSparkline.map(v => ({ value: v }))}
            colorScheme="admin-orders"
          />
        </div>
        <div className="animate-fade-in" style={{ animationDelay: '250ms' }}>
          <KPICard
            title="Panier Moyen"
            value={avgBasket}
            icon={BarChart3}
            format="currency"
            currency="HTG"
            colorScheme="admin-inventory"
          />
        </div>
        <div className="animate-fade-in" style={{ animationDelay: '300ms' }}>
          <KPICard
            title="Produits Actifs"
            value={totalProducts}
            icon={Package}
            format="number"
            colorScheme="admin-products"
          />
        </div>
        <div className="animate-fade-in" style={{ animationDelay: '350ms' }}>
          <KPICard
            title="Vendeurs Actifs"
            value={totalSellers}
            icon={Users}
            format="number"
            colorScheme="admin-sellers"
          />
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Business Health */}
        <div className="animate-fade-in" style={{ animationDelay: '400ms' }}>
          <AdminBusinessHealth
            revenue={monthRevenue}
            revenueTarget={monthRevenue * 1.2}
            profitMargin={profitMargin}
            stockTurnover={stockTurnover}
            lowStockCount={lowStockCount}
            totalProducts={totalProducts}
          />
        </div>

        {/* Revenue/Profit Trend */}
        <div className="lg:col-span-2 animate-fade-in" style={{ animationDelay: '450ms' }}>
          <Card className="admin-card-revenue h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-admin-revenue" />
                Évolution Revenus & Bénéfices
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--admin-revenue))" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="hsl(var(--admin-revenue))" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--admin-profit))" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="hsl(var(--admin-profit))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                  <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))', 
                      borderRadius: '8px',
                      color: 'hsl(var(--card-foreground))'
                    }}
                    formatter={(value: any, name: string) => [
                      `${formatNumber(value)} HTG`,
                      name === 'revenue' ? 'Revenus' : 'Bénéfices'
                    ]}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    name="Revenus"
                    stroke="hsl(var(--admin-revenue))" 
                    strokeWidth={2}
                    fill="url(#revenueGradient)"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="profit" 
                    name="Bénéfices"
                    stroke="hsl(var(--admin-profit))" 
                    strokeWidth={2}
                    fill="url(#profitGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <Card className="admin-card-products animate-fade-in" style={{ animationDelay: '500ms' }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5 text-admin-products" />
              Top 10 Produits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={topProducts} layout="vertical" margin={{ left: 10, right: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  tick={{ fontSize: 10, fill: 'hsl(var(--foreground))' }}
                  width={100}
                />
                <Tooltip 
                  formatter={(value: any) => [`${formatNumber(value)} HTG`, 'Revenus']} 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))', 
                    borderRadius: '8px',
                    color: 'hsl(var(--card-foreground))' 
                  }} 
                />
                <Bar 
                  dataKey="revenue" 
                  fill="hsl(var(--admin-products))" 
                  radius={[0, 4, 4, 0]}
                >
                  <LabelList 
                    dataKey="percent"
                    position="right"
                    formatter={(value: number) => `${value}%`}
                    fill="hsl(var(--muted-foreground))"
                    fontSize={11}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Sellers */}
        <div className="animate-fade-in" style={{ animationDelay: '550ms' }}>
          <AdminTopSellersChart sellers={topSellers} />
        </div>
      </div>

      {/* Category Distribution */}
      <Card className="admin-card-inventory animate-fade-in" style={{ animationDelay: '600ms' }}>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-admin-inventory" />
            Répartition par Catégorie
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                outerRadius={100}
                innerRadius={60}
                fill="#8884d8"
                dataKey="value"
                label={(entry) => `${entry.name}: ${entry.value}`}
                labelLine={{ stroke: 'hsl(var(--muted-foreground))' }}
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))', 
                  borderRadius: '8px',
                  color: 'hsl(var(--card-foreground))' 
                }} 
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
