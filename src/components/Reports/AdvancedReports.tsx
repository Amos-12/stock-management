import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  Download, 
  Calendar as CalendarIcon, 
  BarChart3,
  PieChart,
  Target,
  DollarSign,
  Package,
  Users
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface SalesData {
  date: string;
  total_amount: number;
  customer_name?: string;
  payment_method: string;
  seller_name: string;
}

interface ProductSales {
  product_name: string;
  quantity_sold: number;
  total_revenue: number;
}

interface ReportData {
  totalRevenue: number;
  totalSales: number;
  totalProfit: number;
  averageOrderValue: number;
  topProducts: ProductSales[];
  salesByPeriod: { period: string; revenue: number; sales: number }[];
  paymentMethods: { method: string; count: number; percentage: number }[];
  categoryDistribution: { category: string; revenue: number; count: number; percentage: number }[];
}

export const AdvancedReports = () => {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    to: new Date()
  });
  const [reportType, setReportType] = useState<'sales' | 'products' | 'sellers'>('sales');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);

  const generateReport = async () => {
    try {
      setLoading(true);
      
      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');

      // Fetch sales data
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          id,
          total_amount,
          payment_method,
          customer_name,
          created_at,
          seller_id,
          sale_items (
            product_name,
            quantity,
            unit_price,
            subtotal
          )
        `)
        .gte('created_at', fromDate)
        .lte('created_at', toDate + 'T23:59:59')
        .order('created_at', { ascending: false });

      if (salesError) throw salesError;

      // Fetch seller names
      const salesWithSellers = await Promise.all(
        (salesData || []).map(async (sale) => {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', sale.seller_id)
            .single();
          
          return {
            ...sale,
            seller_name: profileData?.full_name || 'Inconnu'
          };
        })
      );

      // Calculate report data
      const totalRevenue = salesWithSellers.reduce((sum, sale) => sum + sale.total_amount, 0);
      const totalSales = salesWithSellers.length;
      const averageOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;

      // Calculate total profit
      let totalProfit = 0;
      for (const sale of salesWithSellers) {
        const { data: itemsData } = await supabase
          .from('sale_items')
          .select('profit_amount')
          .eq('sale_id', sale.id);
        
        totalProfit += itemsData?.reduce((sum, item) => sum + (item.profit_amount || 0), 0) || 0;
      }

      // Top products
      const productSales: Record<string, ProductSales> = {};
      salesWithSellers.forEach(sale => {
        sale.sale_items?.forEach(item => {
          if (!productSales[item.product_name]) {
            productSales[item.product_name] = {
              product_name: item.product_name,
              quantity_sold: 0,
              total_revenue: 0
            };
          }
          productSales[item.product_name].quantity_sold += item.quantity;
          productSales[item.product_name].total_revenue += item.subtotal;
        });
      });

      const topProducts = Object.values(productSales)
        .sort((a, b) => b.total_revenue - a.total_revenue)
        .slice(0, 10);

      // Payment methods analysis
      const paymentMethodCounts: Record<string, number> = {};
      salesWithSellers.forEach(sale => {
        const method = sale.payment_method || 'cash';
        paymentMethodCounts[method] = (paymentMethodCounts[method] || 0) + 1;
      });

      const paymentMethods = Object.entries(paymentMethodCounts).map(([method, count]) => ({
        method,
        count,
        percentage: (count / totalSales) * 100
      }));

      // Sales by period (daily for the selected range)
      const salesByPeriod: Record<string, { revenue: number; sales: number }> = {};
      salesWithSellers.forEach(sale => {
        const day = format(new Date(sale.created_at), 'yyyy-MM-dd');
        if (!salesByPeriod[day]) {
          salesByPeriod[day] = { revenue: 0, sales: 0 };
        }
        salesByPeriod[day].revenue += sale.total_amount;
        salesByPeriod[day].sales += 1;
      });

      const salesByPeriodArray = Object.entries(salesByPeriod)
        .map(([period, data]) => ({ period, ...data }))
        .sort((a, b) => a.period.localeCompare(b.period));

      // Category distribution from sales
      const { data: allSaleItems, error: itemsError } = await supabase
        .from('sale_items')
        .select('product_name, subtotal, sale_id')
        .in('sale_id', salesWithSellers.map(s => s.id));

      if (itemsError) throw itemsError;

      // Get products to get their categories
      const productNames = [...new Set(allSaleItems?.map(item => item.product_name) || [])];
      const { data: productsData } = await supabase
        .from('products')
        .select('name, category')
        .in('name', productNames);

      const categoryRevenue: Record<string, { revenue: number; count: number }> = {};
      allSaleItems?.forEach(item => {
        const product = productsData?.find(p => p.name === item.product_name);
        if (product) {
          if (!categoryRevenue[product.category]) {
            categoryRevenue[product.category] = { revenue: 0, count: 0 };
          }
          categoryRevenue[product.category].revenue += item.subtotal;
          categoryRevenue[product.category].count += 1;
        }
      });

      const categoryDistribution = Object.entries(categoryRevenue)
        .map(([category, data]) => ({
          category,
          revenue: data.revenue,
          count: data.count,
          percentage: (data.revenue / totalRevenue) * 100
        }))
        .sort((a, b) => b.revenue - a.revenue);

      setReportData({
        totalRevenue,
        totalSales,
        totalProfit,
        averageOrderValue,
        topProducts,
        salesByPeriod: salesByPeriodArray,
        paymentMethods,
        categoryDistribution
      });

    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: "Erreur",
        description: "Impossible de générer le rapport",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generateReport();
  }, [dateRange, reportType]);

  const exportReport = () => {
    if (!reportData) return;

    const csvContent = `
Rapport de Ventes - ${format(dateRange.from, 'dd/MM/yyyy', { locale: fr })} au ${format(dateRange.to, 'dd/MM/yyyy', { locale: fr })}

Résumé:
Chiffre d'affaires total,${reportData.totalRevenue.toFixed(2)} HTG
Nombre de ventes,${reportData.totalSales}
Panier moyen,${reportData.averageOrderValue.toFixed(2)} HTG

Top Produits:
Produit,Quantité vendue,Chiffre d'affaires
${reportData.topProducts.map(p => `${p.product_name},${p.quantity_sold},${p.total_revenue.toFixed(2)} HTG`).join('\n')}

Méthodes de paiement:
Méthode,Nombre,Pourcentage
${reportData.paymentMethods.map(p => `${p.method},${p.count},${p.percentage.toFixed(1)}%`).join('\n')}
`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `rapport_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Succès",
      description: "Rapport exporté avec succès"
    });
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Rapports Avancés
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium">Période</label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(dateRange.from, 'dd/MM/yyyy', { locale: fr })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateRange.from}
                      onSelect={(date) => date && setDateRange(prev => ({ ...prev, from: date }))}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                
                <span className="flex items-center text-muted-foreground">à</span>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(dateRange.to, 'dd/MM/yyyy', { locale: fr })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateRange.to}
                      onSelect={(date) => date && setDateRange(prev => ({ ...prev, to: date }))}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Type de rapport</label>
              <Select value={reportType} onValueChange={(value: any) => setReportType(value)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">Ventes</SelectItem>
                  <SelectItem value="products">Produits</SelectItem>
                  <SelectItem value="sellers">Vendeurs</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button onClick={generateReport} disabled={loading}>
                {loading ? 'Génération...' : 'Actualiser'}
              </Button>
              <Button variant="outline" onClick={exportReport} disabled={!reportData}>
                <Download className="w-4 h-4 mr-2" />
                Exporter
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {reportData && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Chiffre d'Affaires</CardTitle>
                <DollarSign className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">
                  {reportData.totalRevenue.toFixed(2)} HTG
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Bénéfices Totaux</CardTitle>
                <TrendingUp className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  {reportData.totalProfit.toFixed(2)} HTG
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Nombre de Ventes</CardTitle>
                <BarChart3 className="h-4 w-4 text-warning" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-warning">
                  {reportData.totalSales}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Panier Moyen</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {reportData.averageOrderValue.toFixed(2)} HTG
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Category Distribution */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="w-5 h-5" />
                Répartition par Catégorie
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {reportData.categoryDistribution.map((cat, index) => {
                  const colors = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--destructive))', 'hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];
                  const color = colors[index % colors.length];
                  return (
                    <div key={cat.category} className="p-4 rounded-lg border" style={{ borderLeft: `4px solid ${color}` }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium capitalize">{cat.category}</span>
                        <Badge variant="secondary">{cat.count}</Badge>
                      </div>
                      <div className="text-2xl font-bold mb-1">
                        {cat.revenue.toFixed(2)} HTG
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2 mb-2">
                        <div 
                          className="h-2 rounded-full transition-all duration-300"
                          style={{ width: `${cat.percentage}%`, backgroundColor: color }}
                        />
                      </div>
                      <div className="text-sm text-muted-foreground text-center font-medium">
                        {cat.percentage.toFixed(1)}% du CA total
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Top Products */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Top 10 des Produits
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reportData.topProducts.map((product, index) => (
                  <div key={product.product_name} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center">
                        {index + 1}
                      </Badge>
                      <div>
                        <div className="font-medium">{product.product_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {product.quantity_sold} unités vendues
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-success">
                        {product.total_revenue.toFixed(2)} HTG
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {((product.total_revenue / reportData.totalRevenue) * 100).toFixed(1)}% du CA HTG total
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Payment Methods */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="w-5 h-5" />
                Répartition des Paiements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {reportData.paymentMethods.map((method) => (
                  <div key={method.method} className="p-4 bg-muted/30 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium capitalize">{method.method}</span>
                      <Badge variant="secondary">{method.count}</Badge>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${method.percentage}%` }}
                      />
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {method.percentage.toFixed(1)}% des ventes
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};