import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Printer, Receipt as ReceiptIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { generateReceipt, generateInvoice } from '@/lib/pdfGenerator';
import { toast } from '@/hooks/use-toast';

interface SaleDetailsDialogProps {
  saleId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SaleItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  unit?: string;
  currency?: string;
}

export const SaleDetailsDialog = ({ saleId, open, onOpenChange }: SaleDetailsDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [saleData, setSaleData] = useState<any>(null);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [sellerName, setSellerName] = useState('');

  useEffect(() => {
    if (open && saleId) {
      loadSaleDetails();
      loadCompanySettings();
    }
  }, [open, saleId]);

  const loadCompanySettings = async () => {
    const { data } = await supabase
      .from('company_settings')
      .select('*')
      .single();
    if (data) {
      setCompanySettings(data);
    }
  };

  const loadSaleDetails = async () => {
    if (!saleId) return;

    try {
      setLoading(true);

      // Fetch sale
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .select('*')
        .eq('id', saleId)
        .single();

      if (saleError) throw saleError;

      // Fetch seller name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', sale.seller_id)
        .single();

      setSellerName(profile?.full_name || 'N/A');

      // Fetch sale items with currency
      const { data: items, error: itemsError } = await supabase
        .from('sale_items')
        .select('*')
        .eq('sale_id', saleId);

      if (itemsError) throw itemsError;

      setSaleData({
        ...sale,
        items: (items || []) as SaleItem[]
      });
    } catch (error) {
      console.error('Error loading sale details:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les détails de la vente",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Calculate currency subtotals
  const currencySubtotals = useMemo(() => {
    if (!saleData?.items) return { usd: 0, htg: 0, hasMultipleCurrencies: false };
    
    const subtotals = { usd: 0, htg: 0 };
    saleData.items.forEach((item: SaleItem) => {
      const currency = item.currency || 'HTG';
      if (currency === 'USD') {
        subtotals.usd += item.subtotal;
      } else {
        subtotals.htg += item.subtotal;
      }
    });
    
    return {
      ...subtotals,
      hasMultipleCurrencies: subtotals.usd > 0 && subtotals.htg > 0
    };
  }, [saleData?.items]);

  const formatCurrencyAmount = (amount: number, currency: string = 'HTG'): string => {
    const formatted = amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return currency === 'USD' ? `$${formatted}` : `${formatted} HTG`;
  };

  const formatNumber = (amount: number): string => {
    return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  const handlePrintReceipt = () => {
    if (!saleData || !companySettings) return;

    const cartItems = saleData.items.map((item: SaleItem) => ({
      id: item.product_id,
      name: item.product_name,
      category: 'general',
      unit: item.unit || 'unité',
      cartQuantity: item.quantity,
      price: item.unit_price,
      actualPrice: item.subtotal,
      displayUnit: item.unit,
      currency: item.currency || 'HTG'
    }));

    generateReceipt(saleData, companySettings, cartItems, sellerName);
  };

  const handlePrintInvoice = () => {
    if (!saleData || !companySettings) return;

    const cartItems = saleData.items.map((item: SaleItem) => ({
      id: item.product_id,
      name: item.product_name,
      category: 'general',
      unit: item.unit || 'unité',
      cartQuantity: item.quantity,
      price: item.unit_price,
      actualPrice: item.subtotal,
      displayUnit: item.unit,
      currency: item.currency || 'HTG'
    }));

    generateInvoice(saleData, companySettings, cartItems, sellerName);
  };

  // Calculate unified total with TVA
  const getUnifiedTotals = (): { subtotal: number; tva: number; total: number; currency: string; tvaRate: number } => {
    if (!companySettings || !saleData) return { subtotal: 0, tva: 0, total: saleData?.total_amount || 0, currency: 'HTG', tvaRate: 0 };
    
    const rate = companySettings.usd_htg_rate || 132;
    const displayCurrency = companySettings.default_display_currency || 'HTG';
    const tvaRate = companySettings.tva_rate || 0;
    
    let unifiedSubtotal = 0;
    if (displayCurrency === 'HTG') {
      unifiedSubtotal = currencySubtotals.htg + (currencySubtotals.usd * rate);
    } else {
      unifiedSubtotal = currencySubtotals.usd + (currencySubtotals.htg / rate);
    }
    
    // Apply discount if any
    let subtotalAfterDiscount = unifiedSubtotal;
    if (saleData.discount_amount > 0) {
      subtotalAfterDiscount -= saleData.discount_amount;
    }
    
    // Calculate TVA
    const tvaAmount = tvaRate > 0 ? (subtotalAfterDiscount * tvaRate / 100) : 0;
    const totalTTC = subtotalAfterDiscount + tvaAmount;
    
    return { 
      subtotal: subtotalAfterDiscount, 
      tva: tvaAmount, 
      total: totalTTC, 
      currency: displayCurrency,
      tvaRate 
    };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Détails de la vente</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center">Chargement...</div>
        ) : saleData ? (
          <div className="space-y-6">
            {/* Sale Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm font-medium text-muted-foreground">Date:</span>
                <p className="text-sm">
                  {new Date(saleData.created_at).toLocaleString('fr-FR')}
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">Vendeur:</span>
                <p className="text-sm">{sellerName}</p>
              </div>
              {saleData.customer_name && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Client:</span>
                  <p className="text-sm">{saleData.customer_name}</p>
                </div>
              )}
              {saleData.customer_address && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Adresse:</span>
                  <p className="text-sm">{saleData.customer_address}</p>
                </div>
              )}
            </div>

            {/* Items Table */}
            <div>
              <h3 className="font-semibold mb-2">Articles</h3>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      <TableHead className="text-center">Devise</TableHead>
                      <TableHead className="text-right">Quantité</TableHead>
                      <TableHead className="text-right">Prix unitaire</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {saleData.items.map((item: SaleItem) => {
                      const currency = item.currency || 'HTG';
                      return (
                        <TableRow key={item.id}>
                          <TableCell>{item.product_name}</TableCell>
                          <TableCell className="text-center">
                            <Badge 
                              variant="outline" 
                              className={currency === 'USD' 
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                              }
                            >
                              {currency === 'USD' ? '$ USD' : 'G HTG'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {item.quantity} {item.unit || ''}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrencyAmount(item.unit_price, currency)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrencyAmount(item.subtotal, currency)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Totals */}
            <div className="space-y-2 border-t pt-4">
              {/* Currency-specific subtotals */}
              {currencySubtotals.hasMultipleCurrencies ? (
                <>
                  <div className="flex justify-between text-sm">
                    <span>Sous-total USD:</span>
                    <span className="text-green-600 dark:text-green-400">${formatNumber(currencySubtotals.usd)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Sous-total HTG:</span>
                    <span className="text-blue-600 dark:text-blue-400">{formatNumber(currencySubtotals.htg)} HTG</span>
                  </div>
                  {companySettings && (
                    <div className="flex justify-between text-xs text-muted-foreground border-t pt-2">
                      <span>Taux de change:</span>
                      <span>1 USD = {companySettings.usd_htg_rate || 132} HTG</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex justify-between">
                  <span>Sous-total:</span>
                  <span>
                    {currencySubtotals.usd > 0 
                      ? `$${formatNumber(currencySubtotals.usd)}`
                      : `${formatNumber(currencySubtotals.htg)} HTG`
                    }
                  </span>
                </div>
              )}
              
              {saleData.discount_amount > 0 && (
                <div className="flex justify-between text-red-600 dark:text-red-400">
                  <span>
                    Remise
                    {saleData.discount_type === 'percentage' &&
                      ` (${saleData.discount_value}%)`}:
                  </span>
                  <span>-{formatCurrencyAmount(saleData.discount_amount, companySettings?.default_display_currency || 'HTG')}</span>
                </div>
              )}
              
              {/* TVA if configured */}
              {getUnifiedTotals().tvaRate > 0 && (
                <>
                  <div className="flex justify-between text-sm">
                    <span>Sous-total HT:</span>
                    <span>{formatCurrencyAmount(getUnifiedTotals().subtotal, getUnifiedTotals().currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>TVA ({getUnifiedTotals().tvaRate}%):</span>
                    <span>{formatCurrencyAmount(getUnifiedTotals().tva, getUnifiedTotals().currency)}</span>
                  </div>
                </>
              )}
              
              {/* Unified total */}
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>{getUnifiedTotals().tvaRate > 0 ? 'Total TTC:' : 'Total à payer:'}</span>
                <span className="text-primary">
                  {formatCurrencyAmount(getUnifiedTotals().total, getUnifiedTotals().currency)}
                </span>
              </div>
              
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Méthode de paiement:</span>
                <span className="capitalize">{saleData.payment_method}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 justify-end border-t pt-4">
              <Button variant="outline" onClick={handlePrintReceipt}>
                <ReceiptIcon className="w-4 h-4 mr-2" />
                Imprimer Reçu
              </Button>
              <Button onClick={handlePrintInvoice}>
                <Printer className="w-4 h-4 mr-2" />
                Imprimer Facture
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center">Aucune donnée disponible</div>
        )}
      </DialogContent>
    </Dialog>
  );
};