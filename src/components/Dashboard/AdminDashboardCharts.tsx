import { useState, useEffect } from 'react';
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
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Calendar, TrendingUp, Package, DollarSign, ShoppingCart, Users, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { StatsCard } from './StatsCard';
import { formatNumber, calculateUnifiedTotal, calculateUnifiedProfit } from '@/lib/utils';

interface RevenueData {
  date: string;
  revenue: number;
  sales: number;
}

interface ProductSalesData {
  name: string;
  sales: number;
  revenue: number;
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

// Fixed hex colors that work in both light and dark mode
const COLORS = ['#2563eb', '#22c55e', '#f59e0b', '#ef4444', '#6b7280'];

export const AdminDashboardCharts = () => {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [profitData, setProfitData] = useState<RevenueData[]>([]);
  const [topProducts, setTopProducts] = useState<ProductSalesData[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [topSellers, setTopSellers] = useState<SellerData[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Stats data
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [weekRevenue, setWeekRevenue] = useState(0);
  const [monthRevenue, setMonthRevenue] = useState(0);
  const [yearRevenue, setYearRevenue] = useState(0);
  const [todaySales, setTodaySales] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalSellers, setTotalSellers] = useState(0);
  
  // Profit stats
  const [todayProfit, setTodayProfit] = useState(0);
  const [weekProfit, setWeekProfit] = useState(0);
  const [monthProfit, setMonthProfit] = useState(0);
  const [yearProfit, setYearProfit] = useState(0);
  
  // Trending data
  const [yesterdayRevenue, setYesterdayRevenue] = useState(0);
  const [yesterdayProfit, setYesterdayProfit] = useState(0);
  const [prevWeekRevenue, setPrevWeekRevenue] = useState(0);
  const [prevWeekProfit, setPrevWeekProfit] = useState(0);
  const [usdHtgRate, setUsdHtgRate] = useState(132);

  useEffect(() => {
    fetchCompanySettings();
    fetchChartData();
  }, [period]);

  const fetchCompanySettings = async () => {
    const { data } = await supabase
      .from('company_settings')
      .select('usd_htg_rate')
      .single();
    if (data?.usd_htg_rate) {
      setUsdHtgRate(data.usd_htg_rate);
    }
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

  const fetchChartData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchRevenueData(),
        fetchProfitData(),
        fetchTopProducts(),
        fetchCategoryData(),
        fetchTopSellers(),
        fetchStatsData()
      ]);
    } catch (error) {
      console.error('Error fetching chart data:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données graphiques",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStatsData = async () => {
    try {
      // Fetch rate first
      const { data: settings } = await supabase
        .from('company_settings')
        .select('usd_htg_rate')
        .single();
      const rate = settings?.usd_htg_rate || 132;

      // Today's revenue, sales, and profit
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data: todayData, error: todayError } = await supabase
        .from('sales')
        .select('id')
        .gte('created_at', today.toISOString());
      
      if (todayError) throw todayError;
      setTodaySales(todayData?.length || 0);

      // Calculate today's revenue and profit from sale_items with currency conversion
      const { data: todayItems } = await supabase
        .from('sale_items')
        .select('subtotal, profit_amount, currency, sales!inner(created_at)')
        .gte('sales.created_at', today.toISOString());
      
      const todayRev = calculateUnifiedTotal(todayItems || [], rate).unified;
      const todayPft = calculateUnifiedProfit(todayItems || [], rate);
      setTodayRevenue(todayRev);
      setTodayProfit(todayPft);

      // Yesterday's revenue and profit
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const { data: yesterdayItems } = await supabase
        .from('sale_items')
        .select('subtotal, profit_amount, currency, sales!inner(created_at)')
        .gte('sales.created_at', yesterday.toISOString())
        .lt('sales.created_at', today.toISOString());
      
      const yesterdayRev = calculateUnifiedTotal(yesterdayItems || [], rate).unified;
      const yesterdayPft = calculateUnifiedProfit(yesterdayItems || [], rate);
      setYesterdayRevenue(yesterdayRev);
      setYesterdayProfit(yesterdayPft);

      // Week revenue and profit
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      const { data: weekItems } = await supabase
        .from('sale_items')
        .select('subtotal, profit_amount, currency, sales!inner(created_at)')
        .gte('sales.created_at', weekAgo.toISOString());
      
      const weekRev = calculateUnifiedTotal(weekItems || [], rate).unified;
      const weekPft = calculateUnifiedProfit(weekItems || [], rate);
      setWeekRevenue(weekRev);
      setWeekProfit(weekPft);

      // Previous week revenue and profit (7-14 days ago)
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      
      const { data: prevWeekItems } = await supabase
        .from('sale_items')
        .select('subtotal, profit_amount, currency, sales!inner(created_at)')
        .gte('sales.created_at', twoWeeksAgo.toISOString())
        .lt('sales.created_at', weekAgo.toISOString());
      
      const prevWeekRev = calculateUnifiedTotal(prevWeekItems || [], rate).unified;
      const prevWeekPft = calculateUnifiedProfit(prevWeekItems || [], rate);
      setPrevWeekRevenue(prevWeekRev);
      setPrevWeekProfit(prevWeekPft);

      // Month revenue and profit
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const { data: monthItems } = await supabase
        .from('sale_items')
        .select('subtotal, profit_amount, currency, sales!inner(created_at)')
        .gte('sales.created_at', monthAgo.toISOString());
      
      const monthRev = calculateUnifiedTotal(monthItems || [], rate).unified;
      const monthPft = calculateUnifiedProfit(monthItems || [], rate);
      setMonthRevenue(monthRev);
      setMonthProfit(monthPft);

      // Year revenue and profit
      const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      
      const { data: yearItems } = await supabase
        .from('sale_items')
        .select('subtotal, profit_amount, currency, sales!inner(created_at)')
        .gte('sales.created_at', yearAgo.toISOString());
      
      const yearRev = calculateUnifiedTotal(yearItems || [], rate).unified;
      const yearPft = calculateUnifiedProfit(yearItems || [], rate);
      setYearRevenue(yearRev);
      setYearProfit(yearPft);

      // Total products
      const { count: productsCount, error: productsError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
      
      if (productsError) throw productsError;
      setTotalProducts(productsCount || 0);

      // Total sellers
      const { count: sellersCount, error: sellersError } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'seller');
      
      if (sellersError) throw sellersError;
      setTotalSellers(sellersCount || 0);

    } catch (error) {
      console.error('Error fetching stats data:', error);
    }
  };

  const fetchRevenueData = async () => {
    const daysBack = period === 'daily' ? 7 : period === 'weekly' ? 28 : 365;
    const { data, error } = await supabase
      .from('sales')
      .select('created_at, total_amount')
      .gte('created_at', new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at');

    if (error) throw error;

    const grouped = data?.reduce((acc: any, sale) => {
      const date = new Date(sale.created_at).toLocaleDateString('fr-FR');
      if (!acc[date]) {
        acc[date] = { revenue: 0, sales: 0 };
      }
      acc[date].revenue += sale.total_amount;
      acc[date].sales += 1;
      return acc;
    }, {}) || {};

    const chartData = Object.entries(grouped).map(([date, data]: [string, any]) => ({
      date,
      revenue: data.revenue,
      sales: data.sales
    }));

    setRevenueData(chartData);
  };

  const fetchProfitData = async () => {
    const daysBack = period === 'daily' ? 7 : period === 'weekly' ? 28 : 365;
    const { data: salesData, error: salesError } = await supabase
      .from('sales')
      .select('id, created_at')
      .gte('created_at', new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at');

    if (salesError) throw salesError;

    // Fetch sale_items with profit data
    const { data: itemsData, error: itemsError } = await supabase
      .from('sale_items')
      .select('sale_id, profit_amount')
      .in('sale_id', salesData?.map(s => s.id) || []);

    if (itemsError) throw itemsError;

    // Group profit by date
    const profitByDate: Record<string, number> = {};
    salesData?.forEach(sale => {
      const date = new Date(sale.created_at).toLocaleDateString('fr-FR');
      const saleProfit = itemsData
        ?.filter(item => item.sale_id === sale.id)
        .reduce((sum, item) => sum + (item.profit_amount || 0), 0) || 0;
      
      profitByDate[date] = (profitByDate[date] || 0) + saleProfit;
    });

    const chartData = Object.entries(profitByDate).map(([date, profit]) => ({
      date,
      revenue: profit,
      sales: 0
    }));

    setProfitData(chartData);
  };

  const fetchTopProducts = async () => {
    // Apply period filter for consistency with Analytics dashboard
    const daysBack = period === 'daily' ? 7 : period === 'weekly' ? 28 : 365;
    const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
    
    const { data, error } = await supabase
      .from('sale_items')
      .select('product_name, quantity, subtotal, currency, sales!inner(created_at)')
      .gte('sales.created_at', startDate.toISOString())
      .order('subtotal', { ascending: false });

    if (error) throw error;

    const grouped = data?.reduce((acc: any, item) => {
      if (!acc[item.product_name]) {
        acc[item.product_name] = { sales: 0, revenue: 0 };
      }
      acc[item.product_name].sales += Number(item.quantity);
      // Convert USD to HTG for unified revenue
      const itemRevenue = item.currency === 'USD' 
        ? item.subtotal * usdHtgRate 
        : item.subtotal;
      acc[item.product_name].revenue += itemRevenue;
      return acc;
    }, {}) || {};

    const topProductsData = Object.entries(grouped)
      .map(([name, data]: [string, any]) => ({
        name,
        sales: data.sales,
        revenue: data.revenue
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    setTopProducts(topProductsData);
  };

  const fetchCategoryData = async () => {
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('category');

    if (productsError) throw productsError;

    const categories = products?.reduce((acc: any, product) => {
      acc[product.category] = (acc[product.category] || 0) + 1;
      return acc;
    }, {}) || {};

    const categoryColors = ['alimentaires', 'boissons', 'gazeuses', 'electronique', 'autres'];
    const chartData = Object.entries(categories).map(([name, value]: [string, any], index) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: COLORS[index % COLORS.length]
    }));

    setCategoryData(chartData);
  };

  const fetchTopSellers = async () => {
    try {
      // First get all sales grouped by seller
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('seller_id, total_amount');

      if (salesError) throw salesError;

      // Group sales by seller
      const sellerGroups = salesData?.reduce((acc: any, sale) => {
        const sellerId = sale.seller_id;
        if (!acc[sellerId]) {
          acc[sellerId] = { sales: 0, revenue: 0 };
        }
        acc[sellerId].sales += 1;
        acc[sellerId].revenue += sale.total_amount;
        return acc;
      }, {}) || {};

      // Get seller names from profiles
      const sellerIds = Object.keys(sellerGroups);
      if (sellerIds.length === 0) {
        setTopSellers([]);
        return;
      }

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', sellerIds);

      if (profilesError) throw profilesError;

      // Combine data
      const topSellers = sellerIds
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

      setTopSellers(topSellers);
    } catch (error) {
      console.error('Error fetching top sellers:', error);
      setTopSellers([]);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="shadow-lg">
            <CardContent className="h-80 flex items-center justify-center">
              <div className="animate-pulse text-muted-foreground">Chargement...</div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Exchange Rate Indicator */}
      <div className="flex justify-end">
        <Badge variant="outline" className="flex items-center gap-2 text-sm px-3 py-1.5 bg-muted/50">
          <DollarSign className="h-4 w-4 text-primary" />
          <span>Taux: 1 USD = {formatNumber(usdHtgRate)} HTG</span>
        </Badge>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Ventes Aujourd'hui"
          value={`${formatNumber(todayRevenue)} HTG`}
          icon={DollarSign}
          change={{
            value: calcTrend(todayRevenue, yesterdayRevenue).value,
            isPositive: calcTrend(todayRevenue, yesterdayRevenue).isPositive,
            label: "vs hier"
          }}
          variant="default"
        />
        <StatsCard
          title="Bénéfices Aujourd'hui"
          value={`${formatNumber(todayProfit)} HTG`}
          icon={TrendingUp}
          change={{
            value: calcTrend(todayProfit, yesterdayProfit).value,
            isPositive: calcTrend(todayProfit, yesterdayProfit).isPositive,
            label: "vs hier"
          }}
          variant="success"
        />
        <StatsCard
          title="Ventes cette Semaine"
          value={`${formatNumber(weekRevenue)} HTG`}
          icon={DollarSign}
          change={{
            value: calcTrend(weekRevenue, prevWeekRevenue).value,
            isPositive: calcTrend(weekRevenue, prevWeekRevenue).isPositive,
            label: "vs 7j précédents"
          }}
          variant="default"
        />
        <StatsCard
          title="Bénéfices cette Semaine"
          value={`${formatNumber(weekProfit)} HTG`}
          icon={TrendingUp}
          change={{
            value: calcTrend(weekProfit, prevWeekProfit).value,
            isPositive: calcTrend(weekProfit, prevWeekProfit).isPositive,
            label: "vs 7j précédents"
          }}
          variant="success"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Ventes ce Mois"
          value={`${formatNumber(monthRevenue)} HTG`}
          icon={Target}
          variant="default"
        />
        <StatsCard
          title="Bénéfices ce Mois"
          value={`${formatNumber(monthProfit)} HTG`}
          icon={TrendingUp}
          variant="success"
        />
        <StatsCard
          title="Commandes Aujourd'hui"
          value={todaySales}
          icon={ShoppingCart}
          variant="warning"
        />
        <StatsCard
          title="Produits Actifs"
          value={totalProducts}
          icon={Package}
          variant="default"
        />
      </div>

      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Analyse des Performances
        </h2>
        <Select value={period} onValueChange={(value: any) => setPeriod(value)}>
          <SelectTrigger className="w-40">
            <Calendar className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">7 derniers jours</SelectItem>
            <SelectItem value="weekly">4 dernières semaines</SelectItem>
            <SelectItem value="monthly">12 derniers mois</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Évolution du Chiffre d'Affaires</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip 
                  formatter={(value: any, name: any) => [
                    name === 'revenue' ? `${value} HTG` : value,
                    name === 'revenue' ? 'CA' : 'Ventes'
                  ]}
                />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Profit Chart */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Évolution des Bénéfices</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={profitData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip 
                  formatter={(value: any) => [`${value} HTG`, 'Bénéfices']}
                />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="hsl(var(--success))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--success))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Top 10 des Produits</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={topProducts} layout="vertical" margin={{ left: 5, right: 50, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  tick={{ fontSize: 10 }}
                  width={100}
                  tickFormatter={(v) => v.length > 14 ? `${v.slice(0, 14)}...` : v}
                />
                <Tooltip formatter={(value: any) => [`${formatNumber(value)} HTG`, 'Revenus']} />
                <Bar dataKey="revenue" fill="hsl(var(--success))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category Distribution */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Répartition par Catégorie</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={(entry) => entry.name}
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Sellers */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Top 5 des Vendeurs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topSellers.map((seller, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center">
                      {index + 1}
                    </Badge>
                    <div>
                      <div className="font-medium">{seller.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {seller.sales} vente{seller.sales > 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-success">{seller.revenue.toFixed(2)} HTG</div>
                  </div>
                </div>
              ))}
              {topSellers.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Aucune donnée disponible</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};