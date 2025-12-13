import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  TrendingUp, 
  Download, 
  Calendar as CalendarIcon, 
  BarChart3,
  PieChart,
  Target,
  DollarSign,
  Package,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  FileDown
} from 'lucide-react';
import { generateAdvancedReportPDF, CompanySettings } from '@/lib/pdfGenerator';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn, formatNumber } from '@/lib/utils';

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
  totalRevenueUSD: number;
  totalRevenueHTG: number;
  totalRevenueConverted: number;
  totalRevenue: number;
  totalSales: number;
  totalProfit: number;
  averageOrderValue: number;
  topProducts: ProductSales[];
  salesByPeriod: { period: string; revenue: number; sales: number }[];
  paymentMethods: { method: string; count: number; percentage: number }[];
  categoryDistribution: { category: string; revenue: number; count: number; percentage: number }[];
}

// Define filters available per report type
const REPORT_FILTERS = {
  sales: ['period', 'seller', 'payment_method', 'currency'],
  products: ['period', 'category', 'stock_level'],
  sellers: ['period', 'seller']
};

export const AdvancedReports = () => {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    to: new Date()
  });
  const [reportType, setReportType] = useState<'sales' | 'products' | 'sellers'>('sales');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  
  // Dynamic filters state
  const [selectedSeller, setSelectedSeller] = useState<string>('all');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('all');
  const [selectedCurrency, setSelectedCurrency] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStockLevel, setSelectedStockLevel] = useState<string>('all');
  
  // Data for filter dropdowns
  const [sellers, setSellers] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; nom: string }[]>([]);

  // Fetch company settings for PDF export
  useEffect(() => {
    const fetchCompanySettings = async () => {
      const { data } = await supabase
        .from('company_settings')
        .select('*')
        .single();
      if (data) {
        setCompanySettings(data as CompanySettings);
      }
    };
    fetchCompanySettings();
  }, []);

  // Fetch filter data
  useEffect(() => {
    const fetchFilterData = async () => {
      // Fetch sellers
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name');
      if (profiles) {
        setSellers(profiles.map(p => ({ id: p.user_id, name: p.full_name })));
      }
      
      // Fetch categories
      const { data: cats } = await supabase
        .from('categories')
        .select('id, nom')
        .eq('is_active', true);
      if (cats) {
        setCategories(cats);
      }
    };
    fetchFilterData();
  }, []);

  const generateReport = async () => {
    try {
      setLoading(true);
      
      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');
      const usdHtgRate = companySettings?.usd_htg_rate || 132;

      // Build sales query with filters
      let salesQuery = supabase
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
            subtotal,
            currency
          )
        `)
        .gte('created_at', fromDate)
        .lte('created_at', toDate + 'T23:59:59')
        .order('created_at', { ascending: false });

      // Apply seller filter
      if (selectedSeller !== 'all') {
        salesQuery = salesQuery.eq('seller_id', selectedSeller);
      }
      
      // Apply payment method filter
      if (selectedPaymentMethod !== 'all') {
        salesQuery = salesQuery.eq('payment_method', selectedPaymentMethod);
      }

      const { data: salesData, error: salesError } = await salesQuery;

      if (salesError) throw salesError;

      // Filter by currency if selected
      let filteredSalesData = salesData || [];
      if (selectedCurrency !== 'all') {
        filteredSalesData = filteredSalesData.filter(sale => 
          sale.sale_items?.some((item: any) => (item.currency || 'HTG') === selectedCurrency)
        );
      }

      // Fetch seller names
      const salesWithSellers = await Promise.all(
        (filteredSalesData || []).map(async (sale) => {
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

      // Calculate report data with multi-currency support
      let totalRevenueUSD = 0;
      let totalRevenueHTG = 0;
      let totalProfit = 0;

      salesWithSellers.forEach(sale => {
        sale.sale_items?.forEach((item: any) => {
          const currency = item.currency || 'HTG';
          if (currency === 'USD') {
            totalRevenueUSD += item.subtotal || 0;
          } else {
            totalRevenueHTG += item.subtotal || 0;
          }
        });
      });

      const totalRevenueConverted = totalRevenueHTG + (totalRevenueUSD * usdHtgRate);
      const totalSales = salesWithSellers.length;
      const averageOrderValue = totalSales > 0 ? totalRevenueConverted / totalSales : 0;

      // Calculate total profit
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
        sale.sale_items?.forEach((item: any) => {
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
        percentage: totalSales > 0 ? (count / totalSales) * 100 : 0
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
          percentage: totalRevenueConverted > 0 ? (data.revenue / totalRevenueConverted) * 100 : 0
        }))
        .sort((a, b) => b.revenue - a.revenue);

      setReportData({
        totalRevenueUSD,
        totalRevenueHTG,
        totalRevenueConverted,
        totalRevenue: totalRevenueConverted,
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
  }, [dateRange, reportType, selectedSeller, selectedPaymentMethod, selectedCurrency, selectedCategory, selectedStockLevel]);

  const exportReport = () => {
    if (!reportData) return;

    const csvContent = `
Rapport de Ventes - ${format(dateRange.from, 'dd/MM/yyyy', { locale: fr })} au ${format(dateRange.to, 'dd/MM/yyyy', { locale: fr })}

Résumé:
Ventes USD,$ ${formatNumber(reportData.totalRevenueUSD)}
Ventes HTG,${formatNumber(reportData.totalRevenueHTG)} HTG
Total converti,${formatNumber(reportData.totalRevenueConverted)} HTG
Nombre de ventes,${reportData.totalSales}
Panier moyen,${formatNumber(reportData.averageOrderValue)} HTG

Top Produits:
Produit,Quantité vendue,Chiffre d'affaires
${reportData.topProducts.map(p => `${p.product_name},${p.quantity_sold},${formatNumber(p.total_revenue)} HTG`).join('\n')}

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

  const exportToExcel = () => {
    if (!reportData) return;
    const usdHtgRate = companySettings?.usd_htg_rate || 132;

    // Sheet 1: Résumé
    const summaryData = [
      ['RAPPORT DE VENTES COMPLET'],
      ['Période', `${format(dateRange.from, 'dd/MM/yyyy')} - ${format(dateRange.to, 'dd/MM/yyyy')}`],
      ['Date de génération', format(new Date(), 'dd/MM/yyyy HH:mm')],
      ['Taux de change', `1 USD = ${usdHtgRate} HTG`],
      [''],
      ['Métrique', 'Valeur'],
      ['Ventes USD', `$ ${formatNumber(reportData.totalRevenueUSD)}`],
      ['Ventes HTG', `${formatNumber(reportData.totalRevenueHTG)} HTG`],
      ['Total converti (HTG)', `${formatNumber(reportData.totalRevenueConverted)} HTG`],
      ['Bénéfices totaux', `${formatNumber(reportData.totalProfit)} HTG`],
      ['Nombre total de ventes', reportData.totalSales],
      ['Panier moyen', `${formatNumber(reportData.averageOrderValue)} HTG`]
    ];

    // Sheet 2: Ventes par catégorie
    const categoryData = [
      ['Catégorie', 'Revenu (HTG)', 'Nombre de ventes', 'Pourcentage (%)'],
      ...reportData.categoryDistribution.map(cat => [
        cat.category,
        cat.revenue.toFixed(2),
        cat.count,
        cat.percentage.toFixed(1)
      ])
    ];

    // Sheet 3: Top 10 Produits
    const productsData = [
      ['Position', 'Produit', 'Quantité vendue', 'Chiffre d\'affaires (HTG)'],
      ...reportData.topProducts.map((prod, idx) => [
        idx + 1,
        prod.product_name,
        prod.quantity_sold,
        prod.total_revenue.toFixed(2)
      ])
    ];

    // Sheet 4: Méthodes de paiement
    const paymentData = [
      ['Méthode de paiement', 'Nombre de transactions', 'Pourcentage (%)'],
      ...reportData.paymentMethods.map(pm => [
        pm.method,
        pm.count,
        pm.percentage.toFixed(1)
      ])
    ];

    // Sheet 5: Historique chronologique
    const historyData = [
      ['Date', 'Revenu (HTG)', 'Nombre de ventes'],
      ...reportData.salesByPeriod.map(sp => [
        format(new Date(sp.period), 'dd/MM/yyyy'),
        sp.revenue.toFixed(2),
        sp.sales
      ])
    ];

    // Créer le workbook
    const wb = XLSX.utils.book_new();
    
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    const ws2 = XLSX.utils.aoa_to_sheet(categoryData);
    const ws3 = XLSX.utils.aoa_to_sheet(productsData);
    const ws4 = XLSX.utils.aoa_to_sheet(paymentData);
    const ws5 = XLSX.utils.aoa_to_sheet(historyData);
    
    // Définir la largeur des colonnes pour meilleure lisibilité
    ws1['!cols'] = [{ wch: 30 }, { wch: 30 }];
    ws2['!cols'] = [{ wch: 25 }, { wch: 18 }, { wch: 18 }, { wch: 15 }];
    ws3['!cols'] = [{ wch: 10 }, { wch: 35 }, { wch: 18 }, { wch: 22 }];
    ws4['!cols'] = [{ wch: 25 }, { wch: 22 }, { wch: 15 }];
    ws5['!cols'] = [{ wch: 15 }, { wch: 18 }, { wch: 18 }];
    
    XLSX.utils.book_append_sheet(wb, ws1, 'Résumé');
    XLSX.utils.book_append_sheet(wb, ws2, 'Catégories');
    XLSX.utils.book_append_sheet(wb, ws3, 'Top Produits');
    XLSX.utils.book_append_sheet(wb, ws4, 'Méthodes Paiement');
    XLSX.utils.book_append_sheet(wb, ws5, 'Historique');
    
    // Télécharger le fichier
    const fileName = `rapport_complet_${format(dateRange.from, 'yyyyMMdd')}_${format(dateRange.to, 'yyyyMMdd')}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    toast({
      title: "Export réussi",
      description: "Le rapport Excel complet a été téléchargé avec succès",
    });
  };

  const exportToPDF = () => {
    if (!reportData || !companySettings) {
      toast({
        title: "Erreur",
        description: "Paramètres de l'entreprise non disponibles",
        variant: "destructive"
      });
      return;
    }
    
    generateAdvancedReportPDF(reportData, companySettings, dateRange);
    
    toast({
      title: "Export réussi",
      description: "Le rapport PDF a été téléchargé avec succès",
    });
  };

  // Render dynamic filters based on report type
  const renderDynamicFilters = () => {
    const availableFilters = REPORT_FILTERS[reportType] || [];
    
    return (
      <div className="flex flex-wrap gap-2 items-end">
        {/* Seller filter */}
        {availableFilters.includes('seller') && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Vendeur</label>
            <Select value={selectedSeller} onValueChange={setSelectedSeller}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {sellers.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        
        {/* Payment method filter */}
        {availableFilters.includes('payment_method') && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Paiement</label>
            <Select value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="cash">Espèces</SelectItem>
                <SelectItem value="card">Carte</SelectItem>
                <SelectItem value="transfer">Virement</SelectItem>
                <SelectItem value="credit">Crédit</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        
        {/* Currency filter */}
        {availableFilters.includes('currency') && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Devise</label>
            <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="Toutes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="HTG">HTG</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        
        {/* Category filter */}
        {availableFilters.includes('category') && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Catégorie</label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Toutes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        
        {/* Stock level filter */}
        {availableFilters.includes('stock_level') && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Niveau stock</label>
            <Select value={selectedStockLevel} onValueChange={setSelectedStockLevel}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="rupture">Rupture</SelectItem>
                <SelectItem value="alerte">Alerte</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    );
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
        <CardContent className="space-y-4">
          <div className="flex flex-col lg:flex-row gap-4 items-end">
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={!reportData}>
                    <Download className="w-4 h-4 mr-2" />
                    Exporter
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={exportToPDF}>
                    <FileDown className="w-4 h-4 mr-2" />
                    Export PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportReport}>
                    <FileText className="w-4 h-4 mr-2" />
                    Export rapide (CSV)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportToExcel}>
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Export complet (Excel)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          {/* Dynamic filters */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-2">Filtres</p>
            {renderDynamicFilters()}
          </div>
        </CardContent>
      </Card>

      {reportData && (
        <>
          {/* Summary Cards with Multi-Currency */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ventes USD</CardTitle>
                <DollarSign className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold text-green-600">
                  $ {formatNumber(reportData.totalRevenueUSD)}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ventes HTG</CardTitle>
                <DollarSign className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold text-blue-600">
                  {formatNumber(reportData.totalRevenueHTG)} HTG
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-primary">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Converti</CardTitle>
                <TrendingUp className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold text-primary">
                  {formatNumber(reportData.totalRevenueConverted)} HTG
                </div>
                <p className="text-xs text-muted-foreground">Taux: 1 USD = {companySettings?.usd_htg_rate || 132} HTG</p>
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Nombre de Ventes</CardTitle>
                <BarChart3 className="h-4 w-4 text-warning" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold text-warning">
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
                <div className="text-lg font-bold">
                  {formatNumber(reportData.averageOrderValue)} HTG
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
                      <div className="text-lg font-bold mb-1">
                        {formatNumber(cat.revenue)} HTG
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
                        {formatNumber(product.total_revenue)} HTG
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {reportData.totalRevenueConverted > 0 ? ((product.total_revenue / reportData.totalRevenueConverted) * 100).toFixed(1) : 0}% du CA
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