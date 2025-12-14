import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { KPICard } from './KPICard';
import { TrendChart } from './charts/TrendChart';
import { ComparisonChart } from './charts/ComparisonChart';
import { HeatmapChart } from './charts/HeatmapChart';
import { 
  DollarSign, 
  TrendingUp, 
  ShoppingCart, 
  Users, 
  Target,
  CalendarIcon,
  RefreshCw,
  BarChart3,
  PieChart as PieChartIcon,
} from 'lucide-react';
import { formatNumber, calculateUnifiedTotal, calculateUnifiedProfit } from '@/lib/utils';
import { format, subDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, eachDayOfInterval, getDay, getHours } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LabelList,
} from 'recharts';

type Period = 'today' | 'week' | 'month' | 'quarter' | 'custom';

interface Sale {
  id: string;
  created_at: string;
  total_amount: number;
  seller_id: string;
}

interface SaleItem {
  id: string;
  sale_id: string;
  product_name: string;
  quantity: number;
  subtotal: number;
  profit_amount: number | null;
  currency: string | null;
}

interface KPIData {
  revenue: { current: number; previous: number };
  profit: { current: number; previous: number };
  sales: { current: number; previous: number };
  avgTicket: { current: number; previous: number };
  uniqueSellers: { current: number; previous: number };
}

// Fixed hex colors that work in both light and dark mode
const COLORS = [
  '#2563eb', // blue
  '#22c55e', // green
  '#f59e0b', // orange
  '#8b5cf6', // purple
  '#ef4444', // red
  '#06b6d4', // cyan
];

export const AnalyticsDashboard = () => {
  const [period, setPeriod] = useState<Period>('week');
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<Sale[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [previousSales, setPreviousSales] = useState<Sale[]>([]);
  const [previousSaleItems, setPreviousSaleItems] = useState<SaleItem[]>([]);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [usdHtgRate, setUsdHtgRate] = useState(132);

  const getDateRange = (p: Period): { from: Date; to: Date; prevFrom: Date; prevTo: Date } => {
    const now = new Date();
    let from: Date, to: Date, prevFrom: Date, prevTo: Date;

    switch (p) {
      case 'today':
        from = startOfDay(now);
        to = endOfDay(now);
        prevFrom = startOfDay(subDays(now, 1));
        prevTo = endOfDay(subDays(now, 1));
        break;
      case 'week':
        from = startOfWeek(now, { locale: fr });
        to = endOfWeek(now, { locale: fr });
        prevFrom = startOfWeek(subDays(from, 1), { locale: fr });
        prevTo = endOfWeek(subDays(from, 1), { locale: fr });
        break;
      case 'month':
        from = startOfMonth(now);
        to = endOfMonth(now);
        prevFrom = startOfMonth(subMonths(now, 1));
        prevTo = endOfMonth(subMonths(now, 1));
        break;
      case 'quarter':
        from = subDays(now, 90);
        to = now;
        prevFrom = subDays(from, 90);
        prevTo = subDays(to, 90);
        break;
      default:
        from = dateRange.from;
        to = dateRange.to;
        const diff = to.getTime() - from.getTime();
        prevFrom = new Date(from.getTime() - diff);
        prevTo = new Date(to.getTime() - diff);
    }

    return { from, to, prevFrom, prevTo };
  };

  const fetchData = async () => {
    setLoading(true);
    const { from, to, prevFrom, prevTo } = getDateRange(period);

    // Fetch company settings for rate
    const { data: settings } = await supabase
      .from('company_settings')
      .select('usd_htg_rate')
      .single();
    const rate = settings?.usd_htg_rate || 132;
    setUsdHtgRate(rate);

    try {
      // Current period sales
      const { data: currentSales } = await supabase
        .from('sales')
        .select('*')
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString());

      // Previous period sales
      const { data: prevSales } = await supabase
        .from('sales')
        .select('*')
        .gte('created_at', prevFrom.toISOString())
        .lte('created_at', prevTo.toISOString());

      setSales(currentSales || []);
      setPreviousSales(prevSales || []);

      // Get sale items for current period
      if (currentSales && currentSales.length > 0) {
        const saleIds = currentSales.map(s => s.id);
        const { data: items } = await supabase
          .from('sale_items')
          .select('*')
          .in('sale_id', saleIds);
        setSaleItems(items || []);
      } else {
        setSaleItems([]);
      }

      // Get sale items for previous period
      if (prevSales && prevSales.length > 0) {
        const saleIds = prevSales.map(s => s.id);
        const { data: items } = await supabase
          .from('sale_items')
          .select('*')
          .in('sale_id', saleIds);
        setPreviousSaleItems(items || []);
      } else {
        setPreviousSaleItems([]);
      }

      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [period, dateRange]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [period, dateRange]);

  const kpis = useMemo<KPIData>(() => {
    // Use proper currency conversion for revenue
    const currentRevenue = calculateUnifiedTotal(saleItems, usdHtgRate).unified;
    const previousRevenue = calculateUnifiedTotal(previousSaleItems, usdHtgRate).unified;
    
    // Use proper currency conversion for profit
    const currentProfit = calculateUnifiedProfit(saleItems, usdHtgRate);
    const previousProfit = calculateUnifiedProfit(previousSaleItems, usdHtgRate);
    
    const currentUniqueSellers = new Set(sales.map(s => s.seller_id)).size;
    const previousUniqueSellers = new Set(previousSales.map(s => s.seller_id)).size;

    return {
      revenue: { current: currentRevenue, previous: previousRevenue },
      profit: { current: currentProfit, previous: previousProfit },
      sales: { current: sales.length, previous: previousSales.length },
      avgTicket: { 
        current: sales.length > 0 ? currentRevenue / sales.length : 0, 
        previous: previousSales.length > 0 ? previousRevenue / previousSales.length : 0 
      },
      uniqueSellers: { current: currentUniqueSellers, previous: previousUniqueSellers },
    };
  }, [sales, previousSales, saleItems, previousSaleItems, usdHtgRate]);

  const trendData = useMemo(() => {
    const { from, to } = getDateRange(period);
    const days = eachDayOfInterval({ start: from, end: to });
    
    return days.map(day => {
      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);
      
      const daySales = sales.filter(s => {
        const saleDate = new Date(s.created_at);
        return saleDate >= dayStart && saleDate <= dayEnd;
      });
      
      const dayItems = saleItems.filter(i => 
        daySales.some(s => s.id === i.sale_id)
      );

      return {
        date: format(day, 'dd/MM', { locale: fr }),
        revenue: calculateUnifiedTotal(dayItems, usdHtgRate).unified,
        profit: calculateUnifiedProfit(dayItems, usdHtgRate),
        salesCount: daySales.length,
      };
    });
  }, [sales, saleItems, period, usdHtgRate]);

  const sparklineData = useMemo(() => {
    return trendData.map(d => ({ value: d.revenue }));
  }, [trendData]);

  const comparisonData = useMemo(() => {
    const { from, to, prevFrom, prevTo } = getDateRange(period);
    const days = eachDayOfInterval({ start: from, end: to });
    const prevDays = eachDayOfInterval({ start: prevFrom, end: prevTo });
    
    return days.map((day, index) => {
      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);
      
      // Use corresponding day from previous period array
      const prevDay = prevDays[index] || prevDays[prevDays.length - 1] || day;
      const prevDayStart = startOfDay(prevDay);
      const prevDayEnd = endOfDay(prevDay);
      
      const currentDaySales = sales.filter(s => {
        const saleDate = new Date(s.created_at);
        return saleDate >= dayStart && saleDate <= dayEnd;
      });
      
      const prevDaySales = previousSales.filter(s => {
        const saleDate = new Date(s.created_at);
        return saleDate >= prevDayStart && saleDate <= prevDayEnd;
      });

      // Get items for each period's sales
      const currentDayItems = saleItems.filter(i => 
        currentDaySales.some(s => s.id === i.sale_id)
      );
      const prevDayItems = previousSaleItems.filter(i => 
        prevDaySales.some(s => s.id === i.sale_id)
      );

      return {
        label: format(day, 'EEE', { locale: fr }),
        current: calculateUnifiedTotal(currentDayItems, usdHtgRate).unified,
        previous: calculateUnifiedTotal(prevDayItems, usdHtgRate).unified,
      };
    });
  }, [sales, previousSales, saleItems, previousSaleItems, period, usdHtgRate]);

  const heatmapData = useMemo(() => {
    const data: { day: number; hour: number; value: number }[] = [];
    
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const count = sales.filter(s => {
          const date = new Date(s.created_at);
          return getDay(date) === day && getHours(date) === hour;
        }).length;
        
        data.push({ day, hour, value: count });
      }
    }
    
    return data;
  }, [sales]);

  const topProducts = useMemo(() => {
    const productTotals: Record<string, { name: string; revenue: number; quantity: number }> = {};
    
    saleItems.forEach(item => {
      if (!productTotals[item.product_name]) {
        productTotals[item.product_name] = { name: item.product_name, revenue: 0, quantity: 0 };
      }
      // Convert USD to HTG for unified revenue
      const itemRevenue = item.currency === 'USD' 
        ? item.subtotal * usdHtgRate 
        : item.subtotal;
      productTotals[item.product_name].revenue += itemRevenue;
      productTotals[item.product_name].quantity += Number(item.quantity);
    });
    
    return Object.values(productTotals)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [saleItems, usdHtgRate]);

  const categoryDistribution = useMemo(() => {
    const categories: Record<string, number> = {};
    
    saleItems.forEach(item => {
      const category = item.product_name.split(' ')[0] || 'Autre';
      // Convert USD to HTG for unified total
      const itemValue = item.currency === 'USD' 
        ? item.subtotal * usdHtgRate 
        : item.subtotal;
      categories[category] = (categories[category] || 0) + itemValue;
    });
    
    return Object.entries(categories)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [saleItems]);

  const periodLabels: Record<Period, string> = {
    today: "Aujourd'hui",
    week: 'Cette semaine',
    month: 'Ce mois',
    quarter: '90 jours',
    custom: 'Personnalisé',
  };

  return (
    <div className="space-y-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Dernière mise à jour: {format(lastRefresh, 'HH:mm:ss', { locale: fr })}
          </p>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="flex items-center gap-2 text-sm px-3 py-1.5 bg-muted/50">
            <DollarSign className="h-4 w-4 text-primary" />
            <span>1 USD = {formatNumber(usdHtgRate)} HTG</span>
          </Badge>

          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[100]">
              <SelectItem value="today">Aujourd'hui</SelectItem>
              <SelectItem value="week">Cette semaine</SelectItem>
              <SelectItem value="month">Ce mois</SelectItem>
              <SelectItem value="quarter">90 jours</SelectItem>
              <SelectItem value="custom">Personnalisé</SelectItem>
            </SelectContent>
          </Select>

          {period === 'custom' && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {format(dateRange.from, 'dd/MM')} - {format(dateRange.to, 'dd/MM')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-[100]" align="end">
                <Calendar
                  mode="range"
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range) => {
                    if (range?.from && range?.to) {
                      setDateRange({ from: range.from, to: range.to });
                    }
                  }}
                  locale={fr}
                />
              </PopoverContent>
            </Popover>
          )}

          <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard
          title="Revenus"
          value={kpis.revenue.current}
          previousValue={kpis.revenue.previous}
          icon={DollarSign}
          sparklineData={sparklineData}
        />
        <KPICard
          title="Bénéfices"
          value={kpis.profit.current}
          previousValue={kpis.profit.previous}
          icon={TrendingUp}
          colorScheme="success"
          sparklineData={sparklineData}
        />
        <KPICard
          title="Ventes"
          value={kpis.sales.current}
          previousValue={kpis.sales.previous}
          icon={ShoppingCart}
          format="number"
        />
        <KPICard
          title="Panier moyen"
          value={kpis.avgTicket.current}
          previousValue={kpis.avgTicket.previous}
          icon={Target}
        />
        <KPICard
          title="Vendeurs actifs"
          value={kpis.uniqueSellers.current}
          previousValue={kpis.uniqueSellers.previous}
          icon={Users}
          format="number"
        />
      </div>

      {/* Main Trend Chart - without Brush */}
      <TrendChart data={trendData} title={`Tendance des ventes - ${periodLabels[period]}`} showBrush={false} />

      {/* Tabs for different views */}
      <Tabs defaultValue="comparison" className="space-y-4">
        <TabsList>
          <TabsTrigger value="comparison" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Comparaison
          </TabsTrigger>
          <TabsTrigger value="distribution" className="gap-2">
            <PieChartIcon className="w-4 h-4" />
            Distribution
          </TabsTrigger>
        </TabsList>

        <TabsContent value="comparison" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ComparisonChart 
              data={comparisonData} 
              title="Comparaison vs période précédente"
            />
            <HeatmapChart 
              data={heatmapData} 
              title="Activité par heure et jour"
            />
          </div>
        </TabsContent>

        <TabsContent value="distribution" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top Products - Full height */}
            <Card className="flex flex-col">
              <CardHeader className="pb-2 shrink-0">
                <CardTitle className="text-lg font-semibold">Top 10 Produits</CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="h-[450px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topProducts} layout="vertical" margin={{ left: 5, right: 60, top: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} height={25} />
                      <YAxis 
                        type="category" 
                        dataKey="name" 
                        tick={{ fontSize: 10 }}
                        width={100}
                        tickFormatter={(v) => v.length > 14 ? `${v.slice(0, 14)}...` : v}
                      />
                      <Tooltip 
                        formatter={(value: number) => [`${formatNumber(value)} HTG`, 'Revenus']}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          color: 'hsl(var(--card-foreground))',
                        }}
                      />
                      <Bar dataKey="revenue" fill="#2563eb" radius={[0, 4, 4, 0]}>
                        <LabelList 
                          dataKey="revenue" 
                          position="right" 
                          formatter={(value: number) => {
                            const total = topProducts.reduce((sum, p) => sum + p.revenue, 0);
                            const percent = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
                            return `${percent}%`;
                          }}
                          style={{ fontSize: 10, fill: 'hsl(var(--foreground))' }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Category Distribution - Full height */}
            <Card className="flex flex-col bg-card">
              <CardHeader className="pb-2 shrink-0">
                <CardTitle className="text-lg font-semibold text-card-foreground">Distribution par catégorie</CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="h-[450px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryDistribution}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={140}
                        innerRadius={80}
                        paddingAngle={2}
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                      >
                        {categoryDistribution.map((_, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => [`${formatNumber(value)} HTG`, 'Revenus']}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          color: 'hsl(var(--card-foreground))',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Period Summary Badge */}
      <div className="flex justify-center">
        <Badge variant="outline" className="text-sm">
          {periodLabels[period]} • {sales.length} vente{sales.length !== 1 ? 's' : ''} • {formatNumber(kpis.revenue.current)} HTG
        </Badge>
      </div>
    </div>
  );
};
