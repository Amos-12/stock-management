import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Printer, Receipt as ReceiptIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { generateReceipt, generateInvoice } from '@/lib/pdfGenerator';
import { toast } from '@/hooks/use-toast';

interface SaleDetailsDialogProps {
  saleId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

      // Fetch sale items
      const { data: items, error: itemsError } = await supabase
        .from('sale_items')
        .select('*')
        .eq('sale_id', saleId);

      if (itemsError) throw itemsError;

      setSaleData({
        ...sale,
        items: items || []
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

  const handlePrintReceipt = () => {
    if (!saleData || !companySettings) return;

    const cartItems = saleData.items.map((item: any) => ({
      id: item.product_id,
      name: item.product_name,
      category: 'general', // We'll need to fetch this if needed
      unit: item.unit || 'unité',
      cartQuantity: item.quantity,
      price: item.unit_price,
      actualPrice: item.subtotal,
      displayUnit: item.unit
    }));

    generateReceipt(saleData, companySettings, cartItems, sellerName);
  };

  const handlePrintInvoice = () => {
    if (!saleData || !companySettings) return;

    const cartItems = saleData.items.map((item: any) => ({
      id: item.product_id,
      name: item.product_name,
      category: 'general',
      unit: item.unit || 'unité',
      cartQuantity: item.quantity,
      price: item.unit_price,
      actualPrice: item.subtotal,
      displayUnit: item.unit
    }));

    generateInvoice(saleData, companySettings, cartItems, sellerName);
  };

  const formatAmount = (amount: number): string => {
    return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' HTG';
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
              {saleData.notes && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Adresse:</span>
                  <p className="text-sm">{saleData.notes}</p>
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
                      <TableHead className="text-right">Quantité</TableHead>
                      <TableHead className="text-right">Prix unitaire</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {saleData.items.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.product_name}</TableCell>
                        <TableCell className="text-right">
                          {item.quantity} {item.unit || ''}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatAmount(item.unit_price)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatAmount(item.subtotal)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Totals */}
            <div className="space-y-2 border-t pt-4">
              <div className="flex justify-between">
                <span>Sous-total:</span>
                <span>{formatAmount(saleData.subtotal)}</span>
              </div>
              {saleData.discount_amount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>
                    Remise
                    {saleData.discount_type === 'percentage' &&
                      ` (${saleData.discount_value}%)`}:
                  </span>
                  <span>-{formatAmount(saleData.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total:</span>
                <span>{formatAmount(saleData.total_amount)}</span>
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