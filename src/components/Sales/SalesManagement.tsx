import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShoppingCart, Search, TrendingUp, Calendar, Eye, Trash2, Receipt, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { SaleDetailsDialog } from './SaleDetailsDialog';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/ui/table-pagination';
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

export const SalesManagement = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [filteredSales, setFilteredSales] = useState<Sale[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState<'all' | 'HTG' | 'USD' | 'mixed'>('all');
  const [loading, setLoading] = useState(true);
  const [revenueStats, setRevenueStats] = useState<RevenueStats>({ totalHTG: 0, totalUSD: 0, todayHTG: 0, todayUSD: 0 });
  const [tvaStats, setTvaStats] = useState<TvaStats>({ totalTVA_HTG: 0, totalTVA_USD: 0, todayTVA_HTG: 0, todayTVA_USD: 0 });
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

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

    setFilteredSales(filtered);
    resetPage();
  }, [searchTerm, currencyFilter, sales]);

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

      // Build a map of sale_id -> currencies
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

      // Fetch seller names separately
      const salesWithSellers = await Promise.all(
        (salesData || []).map(async (sale) => {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', sale.seller_id)
            .single();
          
          const currencies = saleItemsMap.get(sale.id) || { htg: 0, usd: 0 };
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
      
      // Calculate TVA stats based on configured tva_rate
      const tvaRate = companySettings?.tva_rate || 0;
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <ShoppingCart className="w-8 h-8 text-primary animate-pulse" />
        <span className="ml-2 text-muted-foreground">Chargement...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="flex flex-wrap gap-3">
        <Card className="shadow-sm flex-1 min-w-[160px]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Total ventes</p>
                <p className="text-lg font-bold">{sales.length}</p>
              </div>
              <ShoppingCart className="w-5 h-5 text-muted-foreground opacity-50 shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm flex-1 min-w-[160px]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Revenu total</p>
                <p className="text-lg font-bold">{formatNumber(revenueStats.totalHTG)} HTG</p>
                {revenueStats.totalUSD > 0 && (
                  <p className="text-xs text-muted-foreground">+ ${formatNumber(revenueStats.totalUSD)}</p>
                )}
              </div>
              <TrendingUp className="w-5 h-5 text-muted-foreground opacity-50 shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm flex-1 min-w-[160px]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Aujourd'hui</p>
                <p className="text-lg font-bold">{formatNumber(revenueStats.todayHTG)} HTG</p>
                {revenueStats.todayUSD > 0 && (
                  <p className="text-xs text-muted-foreground">+ ${formatNumber(revenueStats.todayUSD)}</p>
                )}
              </div>
              <Calendar className="w-5 h-5 text-muted-foreground opacity-50 shrink-0" />
            </div>
          </CardContent>
        </Card>

        {companySettings?.tva_rate > 0 && (
          <Card className="shadow-sm flex-1 min-w-[160px]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">TVA ({companySettings.tva_rate}%)</p>
                  <p className="text-lg font-bold">{formatNumber(tvaStats.totalTVA_HTG)} HTG</p>
                  <p className="text-xs text-muted-foreground">
                    Auj: {formatNumber(tvaStats.todayTVA_HTG)} HTG
                  </p>
                </div>
                <Receipt className="w-5 h-5 text-muted-foreground opacity-50 shrink-0" />
              </div>
            </CardContent>
          </Card>
        )}

        {(revenueStats.totalUSD > 0 || revenueStats.todayUSD > 0) && companySettings && (
          <Card className="shadow-sm flex-1 min-w-[160px]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Taux change</p>
                  <p className="text-lg font-bold">1 $ = {companySettings.usd_htg_rate || 132}</p>
                </div>
                <Badge variant="outline" className="text-xs shrink-0">HTG</Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Sales Table */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            Historique des Ventes
          </CardTitle>
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par client ou vendeur..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={currencyFilter} onValueChange={(value: 'all' | 'HTG' | 'USD' | 'mixed') => setCurrencyFilter(value)}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <DollarSign className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Devise" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes devises</SelectItem>
                <SelectItem value="HTG">HTG uniquement</SelectItem>
                <SelectItem value="USD">USD uniquement</SelectItem>
                <SelectItem value="mixed">Mixte (HTG + USD)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Vendeur</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Paiement</TableHead>
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
                      <TableCell className="font-medium">
                        {formatDate(sale.created_at)}
                      </TableCell>
                      <TableCell>
                        {sale.customer_name || <span className="text-muted-foreground italic">Non renseigné</span>}
                      </TableCell>
                      <TableCell>
                        {sale.profiles?.full_name || <span className="text-muted-foreground italic">N/A</span>}
                      </TableCell>
                      <TableCell className="font-bold">
                        <div className="flex flex-col">
                          {sale.currencies?.htg ? (
                            <span>{formatNumber(sale.currencies.htg)} HTG</span>
                          ) : null}
                          {sale.currencies?.usd ? (
                            <span className="text-muted-foreground text-sm">${formatNumber(sale.currencies.usd)}</span>
                          ) : null}
                          {!sale.currencies?.htg && !sale.currencies?.usd && (
                            <span>{formatNumber(sale.total_amount)} HTG</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {sale.payment_method}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setSelectedSaleId(sale.id);
                              setDialogOpen(true);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          
                          {isAdmin && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  size="sm" 
                                  variant="destructive"
                                  title="Supprimer cette vente"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Êtes-vous sûr de vouloir supprimer cette vente ?
                                    Cette action est irréversible et supprimera également tous les articles de vente associés.
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