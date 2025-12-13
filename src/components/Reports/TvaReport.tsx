import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Calculator, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/ui/table-pagination';
import { generateTvaReportPDF } from '@/lib/pdfGenerator';

interface TvaSaleData {
  id: string;
  created_at: string;
  customer_name: string | null;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  htg_subtotal: number;
  usd_subtotal: number;
}

interface TvaTotals {
  totalHT_HTG: number;
  totalHT_USD: number;
  totalTVA_HTG: number;
  totalTVA_USD: number;
  totalTTC_HTG: number;
  totalTTC_USD: number;
  unifiedTotalHT: number;
  unifiedTotalTVA: number;
  unifiedTotalTTC: number;
}

const formatNumber = (amount: number): string => {
  return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

export const TvaReport = () => {
  const [salesData, setSalesData] = useState<TvaSaleData[]>([]);
  const [loading, setLoading] = useState(false);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setDate(1); // First day of current month
    return date.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [totals, setTotals] = useState<TvaTotals>({
    totalHT_HTG: 0, totalHT_USD: 0,
    totalTVA_HTG: 0, totalTVA_USD: 0,
    totalTTC_HTG: 0, totalTTC_USD: 0,
    unifiedTotalHT: 0, unifiedTotalTVA: 0, unifiedTotalTTC: 0
  });

  const { 
    paginatedItems, 
    currentPage, 
    totalPages, 
    totalItems, 
    pageSize, 
    nextPage, 
    prevPage, 
    hasNextPage, 
    hasPrevPage 
  } = usePagination(salesData, 20);

  useEffect(() => {
    fetchCompanySettings();
  }, []);

  const fetchCompanySettings = async () => {
    const { data } = await supabase
      .from('company_settings')
      .select('*')
      .single();
    if (data) {
      setCompanySettings(data);
    }
  };

  const fetchTvaData = async () => {
    if (!companySettings) {
      toast({
        title: "Erreur",
        description: "Paramètres de l'entreprise non chargés",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Fetch sales in date range
      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('id, created_at, customer_name, subtotal, discount_amount, total_amount')
        .gte('created_at', `${dateFrom}T00:00:00`)
        .lte('created_at', `${dateTo}T23:59:59`)
        .order('created_at', { ascending: false });

      if (salesError) throw salesError;

      // Fetch all sale items for these sales
      const saleIds = (sales || []).map(s => s.id);
      const { data: items, error: itemsError } = await supabase
        .from('sale_items')
        .select('sale_id, subtotal, currency')
        .in('sale_id', saleIds);

      if (itemsError) throw itemsError;

      // Build currency map
      const currencyMap = new Map<string, { htg: number; usd: number }>();
      (items || []).forEach(item => {
        const existing = currencyMap.get(item.sale_id) || { htg: 0, usd: 0 };
        if (item.currency === 'USD') {
          existing.usd += item.subtotal;
        } else {
          existing.htg += item.subtotal;
        }
        currencyMap.set(item.sale_id, existing);
      });

      // Combine data
      const enrichedSales: TvaSaleData[] = (sales || []).map(sale => {
        const currencies = currencyMap.get(sale.id) || { htg: 0, usd: 0 };
        return {
          ...sale,
          htg_subtotal: currencies.htg,
          usd_subtotal: currencies.usd
        };
      });

      setSalesData(enrichedSales);

      // Calculate totals
      const tvaRate = companySettings.tva_rate || 0;
      const rate = companySettings.usd_htg_rate || 132;
      const displayCurrency = companySettings.default_display_currency || 'HTG';

      let totalHT_HTG = 0, totalHT_USD = 0;
      
      enrichedSales.forEach(sale => {
        // Subtract discount proportionally from each currency
        const totalRaw = sale.htg_subtotal + sale.usd_subtotal;
        const discountRatio = totalRaw > 0 ? sale.discount_amount / totalRaw : 0;
        
        totalHT_HTG += sale.htg_subtotal * (1 - discountRatio);
        totalHT_USD += sale.usd_subtotal * (1 - discountRatio);
      });

      const totalTVA_HTG = totalHT_HTG * tvaRate / 100;
      const totalTVA_USD = totalHT_USD * tvaRate / 100;
      const totalTTC_HTG = totalHT_HTG + totalTVA_HTG;
      const totalTTC_USD = totalHT_USD + totalTVA_USD;

      // Unified totals
      let unifiedTotalHT: number, unifiedTotalTVA: number, unifiedTotalTTC: number;
      if (displayCurrency === 'HTG') {
        unifiedTotalHT = totalHT_HTG + (totalHT_USD * rate);
        unifiedTotalTVA = totalTVA_HTG + (totalTVA_USD * rate);
        unifiedTotalTTC = totalTTC_HTG + (totalTTC_USD * rate);
      } else {
        unifiedTotalHT = totalHT_USD + (totalHT_HTG / rate);
        unifiedTotalTVA = totalTVA_USD + (totalTVA_HTG / rate);
        unifiedTotalTTC = totalTTC_USD + (totalTTC_HTG / rate);
      }

      setTotals({
        totalHT_HTG, totalHT_USD,
        totalTVA_HTG, totalTVA_USD,
        totalTTC_HTG, totalTTC_USD,
        unifiedTotalHT, unifiedTotalTVA, unifiedTotalTTC
      });

    } catch (error) {
      console.error('Error fetching TVA data:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données TVA",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    if (!companySettings) return;
    
    generateTvaReportPDF(
      salesData,
      companySettings,
      { from: new Date(dateFrom), to: new Date(dateTo) },
      totals
    );
    
    toast({
      title: "Export réussi",
      description: "Le rapport TVA a été téléchargé"
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getTvaForSale = (sale: TvaSaleData) => {
    if (!companySettings) return { ht: 0, tva: 0, ttc: 0 };
    const tvaRate = companySettings.tva_rate || 0;
    const rate = companySettings.usd_htg_rate || 132;
    const displayCurrency = companySettings.default_display_currency || 'HTG';

    // Calculate HT after discount
    const totalRaw = sale.htg_subtotal + sale.usd_subtotal;
    const discountRatio = totalRaw > 0 ? sale.discount_amount / totalRaw : 0;
    const htHTG = sale.htg_subtotal * (1 - discountRatio);
    const htUSD = sale.usd_subtotal * (1 - discountRatio);

    let ht: number;
    if (displayCurrency === 'HTG') {
      ht = htHTG + (htUSD * rate);
    } else {
      ht = htUSD + (htHTG / rate);
    }

    const tva = ht * tvaRate / 100;
    const ttc = ht + tva;

    return { ht, tva, ttc };
  };

  const displayCurrency = companySettings?.default_display_currency || 'HTG';
  const tvaRate = companySettings?.tva_rate || 0;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Rapport TVA Collectée
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label>Date début</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Date fin</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <Button onClick={fetchTvaData} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Générer
            </Button>
            {salesData.length > 0 && (
              <Button variant="outline" onClick={handleExportPDF}>
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {salesData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total HT</p>
              <p className="text-xl font-bold">
                {displayCurrency === 'HTG' 
                  ? `${formatNumber(totals.unifiedTotalHT)} HTG`
                  : `$${formatNumber(totals.unifiedTotalHT)}`
                }
              </p>
              {totals.totalHT_USD > 0 && totals.totalHT_HTG > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  <span>{formatNumber(totals.totalHT_HTG)} HTG</span>
                  <span className="mx-1">+</span>
                  <span>${formatNumber(totals.totalHT_USD)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">TVA Collectée ({tvaRate}%)</p>
              <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
                {displayCurrency === 'HTG' 
                  ? `${formatNumber(totals.unifiedTotalTVA)} HTG`
                  : `$${formatNumber(totals.unifiedTotalTVA)}`
                }
              </p>
              {totals.totalTVA_USD > 0 && totals.totalTVA_HTG > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  <span>{formatNumber(totals.totalTVA_HTG)} HTG</span>
                  <span className="mx-1">+</span>
                  <span>${formatNumber(totals.totalTVA_USD)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total TTC</p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">
                {displayCurrency === 'HTG' 
                  ? `${formatNumber(totals.unifiedTotalTTC)} HTG`
                  : `$${formatNumber(totals.unifiedTotalTTC)}`
                }
              </p>
              {totals.totalTTC_USD > 0 && totals.totalTTC_HTG > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  <span>{formatNumber(totals.totalTTC_HTG)} HTG</span>
                  <span className="mx-1">+</span>
                  <span>${formatNumber(totals.totalTTC_USD)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Details Table */}
      {salesData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Détail des ventes ({totalItems} ventes)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>N° Vente</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Montant HT</TableHead>
                    <TableHead className="text-center">TVA</TableHead>
                    <TableHead className="text-right">Montant TVA</TableHead>
                    <TableHead className="text-right">Total TTC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((sale) => {
                    const { ht, tva, ttc } = getTvaForSale(sale);
                    return (
                      <TableRow key={sale.id}>
                        <TableCell>{formatDate(sale.created_at)}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {sale.id.substring(0, 8)}
                        </TableCell>
                        <TableCell>
                          {sale.customer_name || <span className="text-muted-foreground italic">-</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          {displayCurrency === 'HTG' 
                            ? `${formatNumber(ht)} HTG`
                            : `$${formatNumber(ht)}`
                          }
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{tvaRate}%</Badge>
                        </TableCell>
                        <TableCell className="text-right text-orange-600 dark:text-orange-400">
                          {displayCurrency === 'HTG' 
                            ? `${formatNumber(tva)} HTG`
                            : `$${formatNumber(tva)}`
                          }
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {displayCurrency === 'HTG' 
                            ? `${formatNumber(ttc)} HTG`
                            : `$${formatNumber(ttc)}`
                          }
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
      )}

      {salesData.length === 0 && !loading && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Calculator className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Sélectionnez une période et cliquez sur "Générer" pour voir le rapport TVA</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
