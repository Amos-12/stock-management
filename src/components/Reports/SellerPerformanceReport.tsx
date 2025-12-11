import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  DollarSign, 
  ShoppingCart, 
  Award,
  ChevronDown,
  ChevronUp,
  Download,
  RefreshCw,
  Package
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import * as XLSX from 'xlsx';

interface SellerStats {
  seller_id: string;
  seller_name: string;
  total_revenue: number;
  total_sales: number;
  total_profit: number;
  average_cart: number;
  trend_percent: number;
  top_products: { name: string; quantity: number; revenue: number }[];
}

export const SellerPerformanceReport = () => {
  const [sellers, setSellers] = useState<SellerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');
  const [expandedSeller, setExpandedSeller] = useState<string | null>(null);

  const fetchSellerStats = async () => {
    setLoading(true);
    try {
      const daysAgo = parseInt(period);
      const startDate = startOfDay(subDays(new Date(), daysAgo)).toISOString();
      const endDate = endOfDay(new Date()).toISOString();
      
      // Previous period for trend calculation
      const prevStartDate = startOfDay(subDays(new Date(), daysAgo * 2)).toISOString();
      const prevEndDate = startOfDay(subDays(new Date(), daysAgo)).toISOString();

      // Fetch all sellers
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name');

      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['seller', 'admin']);

      const sellerProfiles = profiles?.filter(p => 
        userRoles?.some(r => r.user_id === p.user_id)
      ) || [];

      // Fetch current period sales
      const { data: currentSales } = await supabase
        .from('sales')
        .select(`
          id,
          seller_id,
          total_amount,
          created_at,
          sale_items (
            product_name,
            quantity,
            subtotal,
            profit_amount
          )
        `)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      // Fetch previous period sales for trend
      const { data: prevSales } = await supabase
        .from('sales')
        .select('seller_id, total_amount')
        .gte('created_at', prevStartDate)
        .lt('created_at', prevEndDate);

      // Calculate stats per seller
      const sellerStatsMap = new Map<string, SellerStats>();

      sellerProfiles.forEach(profile => {
        sellerStatsMap.set(profile.user_id, {
          seller_id: profile.user_id,
          seller_name: profile.full_name,
          total_revenue: 0,
          total_sales: 0,
          total_profit: 0,
          average_cart: 0,
          trend_percent: 0,
          top_products: []
        });
      });

      // Process current sales
      const productSalesMap = new Map<string, Map<string, { quantity: number; revenue: number }>>();

      currentSales?.forEach(sale => {
        const stats = sellerStatsMap.get(sale.seller_id);
        if (stats) {
          stats.total_revenue += sale.total_amount || 0;
          stats.total_sales += 1;
          
          sale.sale_items?.forEach((item: any) => {
            stats.total_profit += item.profit_amount || 0;
            
            // Track products for this seller
            if (!productSalesMap.has(sale.seller_id)) {
              productSalesMap.set(sale.seller_id, new Map());
            }
            const sellerProducts = productSalesMap.get(sale.seller_id)!;
            const existing = sellerProducts.get(item.product_name) || { quantity: 0, revenue: 0 };
            sellerProducts.set(item.product_name, {
              quantity: existing.quantity + item.quantity,
              revenue: existing.revenue + item.subtotal
            });
          });
        }
      });

      // Calculate previous period revenue per seller
      const prevRevenueMap = new Map<string, number>();
      prevSales?.forEach(sale => {
        const current = prevRevenueMap.get(sale.seller_id) || 0;
        prevRevenueMap.set(sale.seller_id, current + (sale.total_amount || 0));
      });

      // Finalize stats
      sellerStatsMap.forEach((stats, sellerId) => {
        if (stats.total_sales > 0) {
          stats.average_cart = stats.total_revenue / stats.total_sales;
        }
        
        const prevRevenue = prevRevenueMap.get(sellerId) || 0;
        if (prevRevenue > 0) {
          stats.trend_percent = ((stats.total_revenue - prevRevenue) / prevRevenue) * 100;
        } else if (stats.total_revenue > 0) {
          stats.trend_percent = 100;
        }

        // Get top 5 products
        const sellerProducts = productSalesMap.get(sellerId);
        if (sellerProducts) {
          stats.top_products = Array.from(sellerProducts.entries())
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);
        }
      });

      // Sort by revenue
      const sortedSellers = Array.from(sellerStatsMap.values())
        .filter(s => s.total_sales > 0)
        .sort((a, b) => b.total_revenue - a.total_revenue);

      setSellers(sortedSellers);
    } catch (error) {
      console.error('Error fetching seller stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSellerStats();
  }, [period]);

  const exportToExcel = () => {
    const data = sellers.map((s, index) => ({
      'Rang': index + 1,
      'Vendeur': s.seller_name,
      'Chiffre d\'affaires': s.total_revenue,
      'Nombre de ventes': s.total_sales,
      'Panier moyen': s.average_cart,
      'Bénéfice': s.total_profit,
      'Tendance (%)': s.trend_percent.toFixed(1)
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Performance Vendeurs');
    XLSX.writeFile(wb, `performance_vendeurs_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { 
      minimumFractionDigits: 0,
      maximumFractionDigits: 0 
    }).format(amount) + ' F';
  };

  const totalRevenue = sellers.reduce((sum, s) => sum + s.total_revenue, 0);
  const totalSales = sellers.reduce((sum, s) => sum + s.total_sales, 0);
  const totalProfit = sellers.reduce((sum, s) => sum + s.total_profit, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Performance des Vendeurs</h2>
          <p className="text-muted-foreground">Analyse des ventes par vendeur</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Aujourd'hui</SelectItem>
              <SelectItem value="7">7 derniers jours</SelectItem>
              <SelectItem value="30">30 derniers jours</SelectItem>
              <SelectItem value="90">3 mois</SelectItem>
              <SelectItem value="365">1 an</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchSellerStats} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="outline" onClick={exportToExcel} disabled={sellers.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Chiffre d'affaires total</p>
                <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
              </div>
              <div className="p-3 bg-primary/10 rounded-full">
                <DollarSign className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ventes totales</p>
                <p className="text-2xl font-bold">{totalSales}</p>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-full">
                <ShoppingCart className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bénéfice total</p>
                <p className="text-2xl font-bold">{formatCurrency(totalProfit)}</p>
              </div>
              <div className="p-3 bg-green-500/10 rounded-full">
                <TrendingUp className="w-6 h-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Vendeurs actifs</p>
                <p className="text-2xl font-bold">{sellers.length}</p>
              </div>
              <div className="p-3 bg-purple-500/10 rounded-full">
                <Users className="w-6 h-6 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sellers Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5 text-yellow-500" />
            Classement des Vendeurs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : sellers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucune vente trouvée pour cette période
            </div>
          ) : (
            <div className="space-y-2">
              {sellers.map((seller, index) => (
                <Collapsible 
                  key={seller.seller_id}
                  open={expandedSeller === seller.seller_id}
                  onOpenChange={(open) => setExpandedSeller(open ? seller.seller_id : null)}
                >
                  <div className="border rounded-lg overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            index === 0 ? 'bg-yellow-500 text-yellow-950' :
                            index === 1 ? 'bg-gray-300 text-gray-700' :
                            index === 2 ? 'bg-amber-600 text-amber-50' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium">{seller.seller_name}</p>
                            <p className="text-sm text-muted-foreground">{seller.total_sales} ventes</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right hidden sm:block">
                            <p className="font-semibold">{formatCurrency(seller.total_revenue)}</p>
                            <p className="text-sm text-muted-foreground">CA</p>
                          </div>
                          <div className="text-right hidden md:block">
                            <p className="font-semibold">{formatCurrency(seller.total_profit)}</p>
                            <p className="text-sm text-muted-foreground">Bénéfice</p>
                          </div>
                          <div className="text-right hidden lg:block">
                            <p className="font-semibold">{formatCurrency(seller.average_cart)}</p>
                            <p className="text-sm text-muted-foreground">Panier moy.</p>
                          </div>
                          <Badge variant={seller.trend_percent >= 0 ? 'default' : 'destructive'} className="flex items-center gap-1">
                            {seller.trend_percent >= 0 ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            {Math.abs(seller.trend_percent).toFixed(1)}%
                          </Badge>
                          {expandedSeller === seller.seller_id ? (
                            <ChevronUp className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border-t bg-muted/30 p-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4 sm:hidden">
                          <div>
                            <p className="text-sm text-muted-foreground">CA</p>
                            <p className="font-semibold">{formatCurrency(seller.total_revenue)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Bénéfice</p>
                            <p className="font-semibold">{formatCurrency(seller.total_profit)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Panier moy.</p>
                            <p className="font-semibold">{formatCurrency(seller.average_cart)}</p>
                          </div>
                        </div>
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <Package className="w-4 h-4" />
                          Top 5 Produits vendus
                        </h4>
                        {seller.top_products.length > 0 ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Produit</TableHead>
                                <TableHead className="text-right">Quantité</TableHead>
                                <TableHead className="text-right">Revenu</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {seller.top_products.map((product, idx) => (
                                <TableRow key={idx}>
                                  <TableCell className="font-medium">{product.name}</TableCell>
                                  <TableCell className="text-right">{product.quantity}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(product.revenue)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        ) : (
                          <p className="text-muted-foreground text-sm">Aucun produit vendu</p>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
