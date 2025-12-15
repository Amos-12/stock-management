import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShoppingCart, Search, TrendingUp, Calendar, Eye, Trash2, Receipt, DollarSign, LayoutGrid, List, Download, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { SaleDetailsDialog } from './SaleDetailsDialog';
import { SaleCard } from './SaleCard';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/ui/table-pagination';
import { useIsMobile } from '@/hooks/use-mobile';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from '@/components/ui/alert-dialog';

interface Sale {
  id: string;
  customer_name?: string;
  total_amount: number;
  payment_method: string;
  created_at: string;
  seller_id: string;
  profiles?: {
    full_name: string;
  };
  currencies?: {
    htg: number;
    usd: number;
  };
}

interface RevenueStats {
  totalHTG: number;
  totalUSD: number;
  todayHTG: number;
  todayUSD: number;
}

interface TvaStats {
  totalTVA_HTG: number;
  totalTVA_USD: number;
  todayTVA_HTG: number;
  todayTVA_USD: number;
}

const formatNumber = (amount: number): string => {
  return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

const formatCompactNumber = (amount: number, isMobile: boolean): string => {
  if (!isMobile) return formatNumber(amount);
  
  if (amount >= 1000000) {
    return (amount / 1000000).toFixed(1) + 'M';
  } else if (amount >= 1000) {
    return (amount / 1000).toFixed(1) + 'K';
  }
  return amount.toFixed(0);
};

export const SalesManagement = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [filteredSales, setFilteredSales] = useState<Sale[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState<'all' | 'HTG' | 'USD' | 'mixed'>('all');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [loading, setLoading] = useState(true);
  const [revenueStats, setRevenueStats] = useState<RevenueStats>({ totalHTG: 0, totalUSD: 0, todayHTG: 0, todayUSD: 0 });
  const [tvaStats, setTvaStats] = useState<TvaStats>({ totalTVA_HTG: 0, totalTVA_USD: 0, todayTVA_HTG: 0, todayTVA_USD: 0 });
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const isMobile = useIsMobile();

  // Auto-switch to cards on mobile
  useEffect(() => {
    if (isMobile) {
      setViewMode('cards');
    }
  }, [isMobile]);

  // Helper function to filter by period
  const filterByPeriod = (saleDate: Date, filter: 'all' | 'today' | 'week' | 'month'): boolean => {
    if (filter === 'all') return true;
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const saleDay = new Date(saleDate.getFullYear(), saleDate.getMonth(), saleDate.getDate());
    
    if (filter === 'today') {
      return saleDay.getTime() === today.getTime();
    }
    
    if (filter === 'week') {
      // Start of week (Monday)
      const dayOfWeek = now.getDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - diffToMonday);
      return saleDay >= startOfWeek;
    }
    
    if (filter === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return saleDay >= startOfMonth;
    }
    
    return true;
  };

  const { 
    paginatedItems: paginatedSales, 
    currentPage, 
    totalPages, 
    totalItems, 
    pageSize, 
    nextPage, 
    prevPage, 
    hasNextPage, 
    hasPrevPage,
    resetPage
  } = usePagination(filteredSales, 20);

  useEffect(() => {
    fetchSales();
    fetchCompanySettings();
    checkAdminRole();
  }, []);

  const fetchCompanySettings = async () => {
    const { data } = await supabase
      .from('company_settings')
      .select('usd_htg_rate, default_display_currency, tva_rate')
      .single();
    if (data) {
      setCompanySettings(data);
    }
  };

  useEffect(() => {
    let filtered = sales.filter(sale =>
      sale.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Apply currency filter
    if (currencyFilter !== 'all') {
      filtered = filtered.filter(sale => {
        const currencies = sale.currencies || { htg: 0, usd: 0 };
        if (currencyFilter === 'HTG') {
          return currencies.htg > 0 && currencies.usd === 0;
        } else if (currencyFilter === 'USD') {
          return currencies.usd > 0 && currencies.htg === 0;
        } else if (currencyFilter === 'mixed') {
          return currencies.htg > 0 && currencies.usd > 0;
        }
        return true;
      });
    }

    // Apply period filter
    if (periodFilter !== 'all') {
      filtered = filtered.filter(sale => filterByPeriod(new Date(sale.created_at), periodFilter));
    }

    setFilteredSales(filtered);
    resetPage();
  }, [searchTerm, currencyFilter, periodFilter, sales]);

  const fetchSales = async () => {
    try {
      // Fetch sales and their items to calculate per-currency totals
      const { data: salesData, error } = await supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch all sale items to calculate currency-specific totals
      const { data: allItems } = await supabase
        .from('sale_items')
        .select('sale_id, subtotal, currency');

      // Build a map of sale_id -> currencies (HT amounts from items)
      const saleItemsMap = new Map<string, { htg: number; usd: number }>();
      (allItems || []).forEach(item => {
        const existing = saleItemsMap.get(item.sale_id) || { htg: 0, usd: 0 };
        if (item.currency === 'USD') {
          existing.usd += item.subtotal;
        } else {
          existing.htg += item.subtotal;
        }
        saleItemsMap.set(item.sale_id, existing);
      });

      // Get TVA rate from company settings
      const { data: settingsData } = await supabase
        .from('company_settings')
        .select('tva_rate')
        .single();
      const tvaRate = settingsData?.tva_rate || 0;

      // Fetch seller names separately
      const salesWithSellers = await Promise.all(
        (salesData || []).map(async (sale) => {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', sale.seller_id)
            .single();
          
          const rawCurrencies = saleItemsMap.get(sale.id) || { htg: 0, usd: 0 };
          const totalRaw = rawCurrencies.htg + rawCurrencies.usd;
          
          // Apply discount proportionally to each currency
          const discountRatio = totalRaw > 0 ? (sale.discount_amount || 0) / totalRaw : 0;
          const htgAfterDiscount = rawCurrencies.htg * (1 - discountRatio);
          const usdAfterDiscount = rawCurrencies.usd * (1 - discountRatio);
          
          // Add TVA to get TTC amounts
          const currencies = {
            htg: htgAfterDiscount * (1 + tvaRate / 100),
            usd: usdAfterDiscount * (1 + tvaRate / 100)
          };
          
          return {
            ...sale,
            profiles: profileData || { full_name: 'N/A' },
            currencies
          };
        })
      );

      setSales(salesWithSellers as Sale[]);

      // Calculate revenue by currency
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const stats: RevenueStats = { totalHTG: 0, totalUSD: 0, todayHTG: 0, todayUSD: 0 };
      
      (salesData || []).forEach(sale => {
        const currencies = saleItemsMap.get(sale.id) || { htg: 0, usd: 0 };
        // Calculate HT after discount
        const totalRaw = currencies.htg + currencies.usd;
        const discountRatio = totalRaw > 0 ? (sale.discount_amount || 0) / totalRaw : 0;
        stats.totalHTG += currencies.htg * (1 - discountRatio);
        stats.totalUSD += currencies.usd * (1 - discountRatio);
        
        const saleDate = new Date(sale.created_at);
        saleDate.setHours(0, 0, 0, 0);
        if (saleDate.getTime() === today.getTime()) {
          stats.todayHTG += currencies.htg * (1 - discountRatio);
          stats.todayUSD += currencies.usd * (1 - discountRatio);
        }
      });
      
      setRevenueStats(stats);
      
      // Calculate TVA stats based on configured tva_rate (use already fetched tvaRate)
      setTvaStats({
        totalTVA_HTG: stats.totalHTG * tvaRate / 100,
        totalTVA_USD: stats.totalUSD * tvaRate / 100,
        todayTVA_HTG: stats.todayHTG * tvaRate / 100,
        todayTVA_USD: stats.todayUSD * tvaRate / 100
      });

    } catch (error) {
      console.error('Error fetching sales:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les ventes",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const checkAdminRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setIsAdmin(data?.role === 'admin');
    } catch (error) {
      console.error('Error checking admin role:', error);
      setIsAdmin(false);
    }
  };

  const handleDeleteSale = async (saleId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Non authentifié');
      }

      const { data, error } = await supabase.functions.invoke('delete-sale', {
        body: { saleId },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Erreur lors de la suppression');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Erreur lors de la suppression');
      }

      toast({
        title: "Vente supprimée",
        description: data.message || `${data.restoredProducts || 0} produit(s) remis en stock`,
      });

      // Recharger la liste
      fetchSales();
    } catch (error) {
      console.error('Error deleting sale:', error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de supprimer la vente",
        variant: "destructive"
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Dynamic stats based on filtered sales
  const filteredStats = useMemo(() => {
    let htg = 0;
    let usd = 0;
    let tvaHtg = 0;
    let tvaUsd = 0;
    const tvaRate = companySettings?.tva_rate || 0;
    
    filteredSales.forEach(sale => {
      htg += sale.currencies?.htg || 0;
      usd += sale.currencies?.usd || 0;
    });
    
    // TVA is already included in currencies (TTC), so calculate HT first then TVA
    const htgHT = htg / (1 + tvaRate / 100);
    const usdHT = usd / (1 + tvaRate / 100);
    tvaHtg = htg - htgHT;
    tvaUsd = usd - usdHT;
    
    return {
      count: filteredSales.length,
      htg,
      usd,
      tvaHtg,
      tvaUsd
    };
  }, [filteredSales, companySettings]);

  // Export functions
  const exportToExcel = () => {
    const data = filteredSales.map(sale => ({
      'Date': formatDate(sale.created_at),
      'Client': sale.customer_name || 'Non renseigné',
      'Vendeur': sale.profiles?.full_name || 'N/A',
      'Montant HTG': sale.currencies?.htg?.toFixed(2) || '0.00',
      'Montant USD': sale.currencies?.usd?.toFixed(2) || '0.00',
      'Paiement': sale.payment_method
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ventes');
    XLSX.writeFile(wb, `ventes_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast({ title: "Export Excel", description: `${filteredSales.length} ventes exportées` });
  };

  const exportToPDF = () => {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    
    // Header
    pdf.setFontSize(18);
    pdf.text('Rapport des Ventes', pageWidth / 2, 20, { align: 'center' });
    
    pdf.setFontSize(10);
    pdf.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, pageWidth / 2, 28, { align: 'center' });
    
    // Stats summary
    pdf.setFontSize(12);
    pdf.text(`Total: ${filteredStats.count} ventes`, 20, 45);
    pdf.text(`Revenus HTG: ${formatNumber(filteredStats.htg)} HTG`, 20, 53);
    if (filteredStats.usd > 0) {
      pdf.text(`Revenus USD: $${formatNumber(filteredStats.usd)}`, 20, 61);
    }
    
    // Table header
    let yPos = 75;
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Date', 20, yPos);
    pdf.text('Client', 55, yPos);
    pdf.text('Vendeur', 100, yPos);
    pdf.text('Montant', 145, yPos);
    pdf.text('Paiement', 175, yPos);
    
    pdf.setFont('helvetica', 'normal');
    yPos += 8;
    
    // Table rows
    filteredSales.slice(0, 40).forEach((sale) => {
      if (yPos > 270) {
        pdf.addPage();
        yPos = 20;
      }
      
      pdf.text(formatDate(sale.created_at).substring(0, 16), 20, yPos);
      pdf.text((sale.customer_name || 'N/A').substring(0, 20), 55, yPos);
      pdf.text((sale.profiles?.full_name || 'N/A').substring(0, 18), 100, yPos);
      
      const amount = sale.currencies?.htg 
        ? `${formatNumber(sale.currencies.htg).substring(0, 12)} HTG`
        : `$${formatNumber(sale.currencies?.usd || 0).substring(0, 10)}`;
      pdf.text(amount, 145, yPos);
      pdf.text(sale.payment_method.substring(0, 10), 175, yPos);
      
      yPos += 6;
    });
    
    if (filteredSales.length > 40) {
      pdf.text(`... et ${filteredSales.length - 40} autres ventes`, 20, yPos + 5);
    }
    
    pdf.save(`ventes_${new Date().toISOString().split('T')[0]}.pdf`);
    toast({ title: "Export PDF", description: `Rapport généré avec ${filteredSales.length} ventes` });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <ShoppingCart className="w-8 h-8 text-primary animate-pulse" />
        <span className="ml-2 text-muted-foreground">Chargement...</span>
      </div>
    );
  }


  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Stats Cards - Dynamic based on filters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <Card className="shadow-sm">
          <CardContent className="p-2 sm:p-3 md:p-4">
            <div className="flex items-center justify-between gap-1 sm:gap-2">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground">Ventes filtrées</p>
                <p className="text-sm sm:text-base md:text-lg font-bold">{filteredStats.count}</p>
              </div>
              <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground opacity-50 shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-2 sm:p-3 md:p-4">
            <div className="flex items-center justify-between gap-1 sm:gap-2">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground">Revenu HTG</p>
                <p className="text-sm sm:text-base md:text-lg font-bold truncate">
                  {formatCompactNumber(filteredStats.htg, isMobile)} <span className="text-[10px] sm:text-xs font-normal">HTG</span>
                </p>
              </div>
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground opacity-50 shrink-0 hidden sm:block" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-2 sm:p-3 md:p-4">
            <div className="flex items-center justify-between gap-1 sm:gap-2">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground">Revenu USD</p>
                <p className="text-sm sm:text-base md:text-lg font-bold truncate">
                  ${formatCompactNumber(filteredStats.usd, isMobile)}
                </p>
              </div>
              <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground opacity-50 shrink-0 hidden sm:block" />
            </div>
          </CardContent>
        </Card>

        {companySettings?.tva_rate > 0 && (
          <Card className="shadow-sm">
            <CardContent className="p-2 sm:p-3 md:p-4">
              <div className="flex items-center justify-between gap-1 sm:gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-muted-foreground">TVA ({companySettings.tva_rate}%)</p>
                  <p className="text-sm sm:text-base md:text-lg font-bold truncate">
                    {formatCompactNumber(filteredStats.tvaHtg, isMobile)} <span className="text-[10px] sm:text-xs font-normal">HTG</span>
                  </p>
                </div>
                <Receipt className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground opacity-50 shrink-0 hidden sm:block" />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Sales Table */}
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Historique des Ventes
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportToExcel} className="h-8">
                <Download className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Excel</span>
              </Button>
              <Button variant="outline" size="sm" onClick={exportToPDF} className="h-8">
                <FileText className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">PDF</span>
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-3 mt-4">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par client ou vendeur..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {/* Period filter */}
                <Select value={periodFilter} onValueChange={(value: 'all' | 'today' | 'week' | 'month') => setPeriodFilter(value)}>
                  <SelectTrigger className="w-[120px] sm:w-[130px]">
                    <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Période" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tout</SelectItem>
                    <SelectItem value="today">Aujourd'hui</SelectItem>
                    <SelectItem value="week">Cette semaine</SelectItem>
                    <SelectItem value="month">Ce mois</SelectItem>
                  </SelectContent>
                </Select>
                
                {/* Currency filter */}
                <Select value={currencyFilter} onValueChange={(value: 'all' | 'HTG' | 'USD' | 'mixed') => setCurrencyFilter(value)}>
                  <SelectTrigger className="w-[100px] sm:w-[120px]">
                    <DollarSign className="w-4 h-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Devise" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes</SelectItem>
                    <SelectItem value="HTG">HTG</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="mixed">Mixte</SelectItem>
                  </SelectContent>
                </Select>
                
                {/* View toggle - desktop only */}
                {!isMobile && (
                  <div className="flex border rounded-md overflow-hidden">
                    <Button
                      variant={viewMode === 'table' ? 'default' : 'ghost'}
                      size="sm"
                      className="rounded-none h-10 px-3"
                      onClick={() => setViewMode('table')}
                    >
                      <List className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'cards' ? 'default' : 'ghost'}
                      size="sm"
                      className="rounded-none h-10 px-3"
                      onClick={() => setViewMode('cards')}
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Card view for mobile or when selected */}
          {viewMode === 'cards' ? (
            <div className="space-y-2">
              {paginatedSales.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p>Aucune vente trouvée</p>
                </div>
              ) : (
                paginatedSales.map((sale, index) => (
                  <SaleCard
                    key={sale.id}
                    sale={sale}
                    isAdmin={isAdmin}
                    showSwipeHint={index === 0}
                    onView={(id) => {
                      setSelectedSaleId(id);
                      setDialogOpen(true);
                    }}
                    onDelete={handleDeleteSale}
                  />
                ))
              )}
            </div>
          ) : (
            /* Table view for desktop */
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="hidden md:table-cell">Vendeur</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead className="hidden sm:table-cell">Paiement</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedSales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Aucune vente trouvée
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedSales.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell className="font-medium text-xs sm:text-sm">
                          {formatDate(sale.created_at)}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm">
                          {sale.customer_name || <span className="text-muted-foreground italic">Non renseigné</span>}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs sm:text-sm">
                          {sale.profiles?.full_name || <span className="text-muted-foreground italic">N/A</span>}
                        </TableCell>
                        <TableCell className="font-bold text-xs sm:text-sm">
                          <div className="flex flex-col">
                            {sale.currencies?.htg ? (
                              <span>{formatNumber(sale.currencies.htg)} HTG</span>
                            ) : null}
                            {sale.currencies?.usd ? (
                              <span className="text-muted-foreground text-xs">${formatNumber(sale.currencies.usd)}</span>
                            ) : null}
                            {!sale.currencies?.htg && !sale.currencies?.usd && (
                              <span>{formatNumber(sale.total_amount)} HTG</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="outline" className="capitalize text-xs">
                            {sale.payment_method}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 sm:gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3"
                              onClick={() => {
                                setSelectedSaleId(sale.id);
                                setDialogOpen(true);
                              }}
                            >
                              <Eye className="w-4 h-4" />
                              <span className="hidden sm:inline ml-1">Voir</span>
                            </Button>
                            
                            {isAdmin && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button 
                                    size="sm" 
                                    variant="destructive"
                                    className="h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3"
                                    title="Supprimer cette vente"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="w-[90vw] max-w-md">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Êtes-vous sûr de vouloir supprimer cette vente ?
                                      Cette action est irréversible.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => handleDeleteSale(sale.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Supprimer
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPrevPage={prevPage}
            onNextPage={nextPage}
            hasPrevPage={hasPrevPage}
            hasNextPage={hasNextPage}
          />
        </CardContent>
      </Card>
      
      <SaleDetailsDialog 
        saleId={selectedSaleId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
};