import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Printer, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { generateInvoice, generateReceipt } from '@/lib/pdfGenerator';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface SaleDetailsDialogProps {
  saleId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SaleDetailsDialog = ({ saleId, open, onOpenChange }: SaleDetailsDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [saleData, setSaleData] = useState<any>(null);
  const [companySettings, setCompanySettings] = useState<any>(null);

  useEffect(() => {
    if (open && saleId) {
      fetchSaleDetails();
    }
  }, [open, saleId]);

  const fetchSaleDetails = async () => {
    if (!saleId) return;

    try {
      setLoading(true);

      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .select('*')
        .eq('id', saleId)
        .single();

      if (saleError) throw saleError;

      const { data: items, error: itemsError } = await supabase
        .from('sale_items')
        .select('*')
        .eq('sale_id', saleId);

      if (itemsError) throw itemsError;

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', sale.seller_id)
        .single();

      const { data: settings } = await supabase
        .from('company_settings')
        .select('*')
        .single();

      const itemsWithCategory = await Promise.all(
        (items || []).map(async (item) => {
          const { data: product } = await supabase
            .from('products')
            .select('category, bars_per_ton')
            .eq('name', item.product_name)
            .single();
          
          return {
            ...item,
            category: product?.category,
            bars_per_ton: product?.bars_per_ton
          };
        })
      );

      setSaleData({
        ...sale,
        items: itemsWithCategory,
        seller_name: profile?.full_name || 'Inconnu'
      });
      setCompanySettings(settings);
    } catch (error) {
      console.error('Error fetching sale details:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les détails de la vente",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePrintInvoice = async () => {
    if (!saleData || !companySettings) return;
    await generateInvoice(saleData, companySettings);
  };

  const handlePrintReceipt = async () => {
    if (!saleData || !companySettings) return;
    await generateReceipt(saleData, companySettings);
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <div className="text-center py-8">Chargement...</div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!saleData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Détails de la vente</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Date</p>
              <p className="font-medium">
                {format(new Date(saleData.created_at), 'dd MMMM yyyy à HH:mm', { locale: fr })}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">N° de vente</p>
              <p className="font-medium">{saleData.id.substring(0, 8).toUpperCase()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Vendeur</p>
              <p className="font-medium">{saleData.seller_name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Mode de paiement</p>
              <Badge>
                {saleData.payment_method === 'cash' ? 'Espèces' : 
                 saleData.payment_method === 'card' ? 'Carte' : 'Crédit'}
              </Badge>
            </div>
          </div>

          {saleData.customer_name && (
            <div>
              <p className="text-sm text-muted-foreground">Client</p>
              <p className="font-medium">{saleData.customer_name}</p>
              {saleData.customer_address && (
                <p className="text-sm text-muted-foreground">{saleData.customer_address}</p>
              )}
            </div>
          )}

          <div>
            <h3 className="font-semibold mb-3">Articles vendus</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2 text-sm font-medium">Produit</th>
                    <th className="text-right p-2 text-sm font-medium">Quantité</th>
                    <th className="text-right p-2 text-sm font-medium">Prix unitaire</th>
                    <th className="text-right p-2 text-sm font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {saleData.items.map((item: any, index: number) => (
                    <tr key={index} className="border-t">
                      <td className="p-2 text-sm">{item.product_name}</td>
                      <td className="p-2 text-sm text-right">
                        {item.quantity} {item.unit || 'unité'}
                      </td>
                      <td className="p-2 text-sm text-right">{item.unit_price.toFixed(2)} HTG</td>
                      <td className="p-2 text-sm text-right font-medium">
                        {item.subtotal.toFixed(2)} HTG
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Sous-total:</span>
              <span>{saleData.subtotal.toFixed(2)} HTG</span>
            </div>
            {saleData.discount_amount > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Remise:</span>
                <span>-{saleData.discount_amount.toFixed(2)} HTG</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold">
              <span>Total:</span>
              <span>{saleData.total_amount.toFixed(2)} HTG</span>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button onClick={handlePrintInvoice} className="flex-1">
              <FileText className="w-4 h-4 mr-2" />
              Imprimer la facture
            </Button>
            <Button onClick={handlePrintReceipt} variant="outline" className="flex-1">
              <Printer className="w-4 h-4 mr-2" />
              Imprimer le reçu
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
