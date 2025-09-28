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
import { Calendar, TrendingUp, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

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

const COLORS = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--destructive))', 'hsl(var(--muted))'];

export const AdminDashboardCharts = () => {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [topProducts, setTopProducts] = useState<ProductSalesData[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [topSellers, setTopSellers] = useState<SellerData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChartData();
  }, [period]);

  const fetchChartData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchRevenueData(),
        fetchTopProducts(),
        fetchCategoryData(),
        fetchTopSellers()
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

  const fetchTopProducts = async () => {
    const { data, error } = await supabase
      .from('sale_items')
      .select('product_name, quantity, subtotal')
      .order('subtotal', { ascending: false });

    if (error) throw error;

    const grouped = data?.reduce((acc: any, item) => {
      if (!acc[item.product_name]) {
        acc[item.product_name] = { sales: 0, revenue: 0 };
      }
      acc[item.product_name].sales += item.quantity;
      acc[item.product_name].revenue += item.subtotal;
      return acc;
    }, {}) || {};

    const topProducts = Object.entries(grouped)
      .map(([name, data]: [string, any]) => ({
        name,
        sales: data.sales,
        revenue: data.revenue
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    setTopProducts(topProducts);
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
                    name === 'revenue' ? `${value}€` : value,
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

        {/* Top Products */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Top 5 des Produits</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topProducts}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value: any) => [`${value}€`, 'Revenus']} />
                <Bar dataKey="revenue" fill="hsl(var(--success))" />
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
                    <div className="font-bold text-success">{seller.revenue.toFixed(2)}€</div>
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