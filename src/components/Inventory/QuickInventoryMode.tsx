import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter 
} from '@/components/ui/dialog';
import { 
  Barcode, 
  Package, 
  Check, 
  X, 
  AlertTriangle,
  RefreshCw,
  History,
  Minus,
  Plus,
  ScanLine
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';

interface Product {
  id: string;
  name: string;
  barcode?: string;
  category: string;
  quantity: number;
  stock_boite?: number;
  stock_barre?: number;
  surface_par_boite?: number;
  alert_threshold: number;
  unit: string;
}

interface ScannedItem {
  product: Product;
  scannedAt: Date;
  expectedStock: number;
  actualStock: number | null;
  verified: boolean;
  adjusted: boolean;
  stockUnit: string;
}

export const QuickInventoryMode = () => {
  const { user } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [adjustmentDialog, setAdjustmentDialog] = useState(false);
  const [newStockValue, setNewStockValue] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [manualBarcode, setManualBarcode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Get stock info based on category
  const getStockInfo = (product: Product) => {
    if (product.category === 'ceramique' && product.stock_boite !== null && product.stock_boite !== undefined) {
      const m2 = product.surface_par_boite ? product.stock_boite * product.surface_par_boite : product.stock_boite;
      return { value: product.stock_boite, displayValue: m2.toFixed(2), unit: 'boîtes', displayUnit: 'm²' };
    }
    if (product.category === 'fer' && product.stock_barre !== null && product.stock_barre !== undefined) {
      return { value: product.stock_barre, displayValue: product.stock_barre.toString(), unit: 'barres', displayUnit: 'barres' };
    }
    return { value: product.quantity, displayValue: product.quantity.toString(), unit: product.unit || 'unités', displayUnit: product.unit || 'unités' };
  };

  // Handle barcode scan
  const handleBarcodeScan = useCallback(async (barcode: string) => {
    if (!isActive) return;
    
    try {
      const { data: product, error } = await supabase
        .from('products')
        .select('*')
        .eq('barcode', barcode)
        .single();

      if (error || !product) {
        toast({
          title: "Produit non trouvé",
          description: `Aucun produit avec le code-barres: ${barcode}`,
          variant: "destructive"
        });
        return;
      }

      const stockInfo = getStockInfo(product as Product);
      
      // Check if already scanned
      const existingIndex = scannedItems.findIndex(item => item.product.id === product.id);
      
      if (existingIndex >= 0) {
        // Re-scan: open adjustment dialog
        setCurrentProduct(product as Product);
        setNewStockValue(stockInfo.value.toString());
        setAdjustmentDialog(true);
        toast({
          title: "Produit déjà scanné",
          description: "Voulez-vous ajuster le stock ?",
        });
      } else {
        // New scan: add to list
        const newItem: ScannedItem = {
          product: product as Product,
          scannedAt: new Date(),
          expectedStock: stockInfo.value,
          actualStock: null,
          verified: false,
          adjusted: false,
          stockUnit: stockInfo.unit
        };
        
        setScannedItems(prev => [newItem, ...prev]);
        setCurrentProduct(product as Product);
        setNewStockValue(stockInfo.value.toString());
        setAdjustmentDialog(true);
        
        toast({
          title: "Produit scanné",
          description: product.name,
        });
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      toast({
        title: "Erreur",
        description: "Impossible de récupérer le produit",
        variant: "destructive"
      });
    }
  }, [isActive, scannedItems]);

  // Enable barcode scanner
  useBarcodeScanner({
    onScan: handleBarcodeScan,
    enabled: isActive && !adjustmentDialog,
    minLength: 5,
    maxTimeBetweenKeys: 50
  });

  // Handle manual barcode entry
  const handleManualEntry = () => {
    if (manualBarcode.trim().length >= 5) {
      handleBarcodeScan(manualBarcode.trim());
      setManualBarcode('');
    }
  };

  // Verify stock (mark as correct without adjustment)
  const verifyStock = (productId: string) => {
    setScannedItems(prev => prev.map(item => 
      item.product.id === productId 
        ? { ...item, verified: true, actualStock: item.expectedStock }
        : item
    ));
    setAdjustmentDialog(false);
    setCurrentProduct(null);
    toast({
      title: "Stock vérifié",
      description: "Le stock correspond à l'inventaire",
    });
  };

  // Adjust stock
  const adjustStock = async () => {
    if (!currentProduct || !user) return;
    
    const newValue = parseFloat(newStockValue);
    if (isNaN(newValue) || newValue < 0) {
      toast({
        title: "Valeur invalide",
        description: "Veuillez entrer une valeur numérique positive",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      const stockInfo = getStockInfo(currentProduct);
      const previousValue = stockInfo.value;
      
      // Determine which field to update
      let updateData: any = {};
      if (currentProduct.category === 'ceramique') {
        updateData.stock_boite = newValue;
      } else if (currentProduct.category === 'fer') {
        updateData.stock_barre = newValue;
      } else {
        updateData.quantity = newValue;
      }

      // Update product stock
      const { error: updateError } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', currentProduct.id);

      if (updateError) throw updateError;

      // Log stock movement
      await supabase.from('stock_movements').insert({
        product_id: currentProduct.id,
        movement_type: 'inventory_adjustment',
        quantity: Math.abs(newValue - previousValue),
        previous_quantity: previousValue,
        new_quantity: newValue,
        reason: adjustmentReason || 'Ajustement inventaire rapide',
        created_by: user.id
      });

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        action_type: 'stock_adjusted',
        entity_type: 'product',
        entity_id: currentProduct.id,
        description: `Ajustement inventaire: ${currentProduct.name} de ${previousValue} à ${newValue} ${stockInfo.unit}`,
        metadata: {
          product_name: currentProduct.name,
          previous_stock: previousValue,
          new_stock: newValue,
          reason: adjustmentReason
        }
      });

      // Update scanned items
      setScannedItems(prev => prev.map(item => 
        item.product.id === currentProduct.id 
          ? { 
              ...item, 
              verified: true, 
              adjusted: newValue !== previousValue,
              actualStock: newValue,
              product: { ...item.product, ...updateData }
            }
          : item
      ));

      toast({
        title: "Stock ajusté",
        description: `${currentProduct.name}: ${previousValue} → ${newValue} ${stockInfo.unit}`,
      });

      setAdjustmentDialog(false);
      setCurrentProduct(null);
      setNewStockValue('');
      setAdjustmentReason('');
    } catch (error) {
      console.error('Error adjusting stock:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'ajuster le stock",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Reset session
  const resetSession = () => {
    setScannedItems([]);
    setCurrentProduct(null);
    setNewStockValue('');
    setAdjustmentReason('');
  };

  // Stats
  const stats = {
    total: scannedItems.length,
    verified: scannedItems.filter(i => i.verified && !i.adjusted).length,
    adjusted: scannedItems.filter(i => i.adjusted).length,
    pending: scannedItems.filter(i => !i.verified).length
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <ScanLine className="w-5 h-5" />
              Mode Inventaire Rapide
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant={isActive ? "destructive" : "default"}
                onClick={() => setIsActive(!isActive)}
                className="gap-2"
              >
                {isActive ? (
                  <>
                    <X className="w-4 h-4" />
                    Arrêter
                  </>
                ) : (
                  <>
                    <Barcode className="w-4 h-4" />
                    Démarrer
                  </>
                )}
              </Button>
              {scannedItems.length > 0 && (
                <Button variant="outline" onClick={resetSession} className="gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Réinitialiser
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isActive ? (
            <div className="space-y-4">
              {/* Scanner status */}
              <div className="flex items-center justify-center p-6 border-2 border-dashed border-primary/50 rounded-lg bg-primary/5">
                <div className="text-center">
                  <Barcode className="w-12 h-12 mx-auto text-primary animate-pulse" />
                  <p className="mt-2 font-medium text-primary">Scanner prêt</p>
                  <p className="text-sm text-muted-foreground">
                    Scannez un code-barres ou entrez-le manuellement
                  </p>
                </div>
              </div>

              {/* Manual entry */}
              <div className="flex gap-2">
                <Input
                  placeholder="Entrer le code-barres manuellement..."
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualEntry()}
                  className="flex-1"
                />
                <Button onClick={handleManualEntry} disabled={manualBarcode.length < 5}>
                  Rechercher
                </Button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-muted text-center">
                  <div className="text-2xl font-bold">{stats.total}</div>
                  <div className="text-xs text-muted-foreground">Scannés</div>
                </div>
                <div className="p-3 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-center">
                  <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{stats.verified}</div>
                  <div className="text-xs text-emerald-600 dark:text-emerald-500">Vérifiés</div>
                </div>
                <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-center">
                  <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{stats.adjusted}</div>
                  <div className="text-xs text-amber-600 dark:text-amber-500">Ajustés</div>
                </div>
                <div className="p-3 rounded-lg bg-sky-100 dark:bg-sky-900/30 text-center">
                  <div className="text-2xl font-bold text-sky-700 dark:text-sky-400">{stats.pending}</div>
                  <div className="text-xs text-sky-600 dark:text-sky-500">En attente</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Cliquez sur "Démarrer" pour activer le mode inventaire rapide</p>
              <p className="text-sm mt-1">Scannez les produits pour vérifier et ajuster les stocks</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scanned items list */}
      {scannedItems.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="w-4 h-4" />
              Produits scannés ({scannedItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {scannedItems.map((item, index) => {
                  const stockInfo = getStockInfo(item.product);
                  return (
                    <div 
                      key={`${item.product.id}-${index}`}
                      className={`p-3 rounded-lg border ${
                        item.adjusted 
                          ? 'border-amber-300 bg-amber-50 dark:bg-amber-900/20' 
                          : item.verified 
                            ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20'
                            : 'border-border bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{item.product.name}</span>
                            {item.verified && !item.adjusted && (
                              <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-300">
                                <Check className="w-3 h-3 mr-1" />
                                Vérifié
                              </Badge>
                            )}
                            {item.adjusted && (
                              <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Ajusté
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                            {item.product.barcode && (
                              <code className="text-xs bg-muted px-1 rounded">{item.product.barcode}</code>
                            )}
                            <span>
                              Stock: {item.adjusted 
                                ? `${item.expectedStock} → ${item.actualStock}` 
                                : stockInfo.displayValue
                              } {stockInfo.displayUnit}
                            </span>
                          </div>
                        </div>
                        {!item.verified && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setCurrentProduct(item.product);
                              setNewStockValue(stockInfo.value.toString());
                              setAdjustmentDialog(true);
                            }}
                          >
                            Vérifier
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Adjustment Dialog */}
      <Dialog open={adjustmentDialog} onOpenChange={setAdjustmentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Vérification du stock</DialogTitle>
          </DialogHeader>
          {currentProduct && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted">
                <div className="font-medium">{currentProduct.name}</div>
                {currentProduct.barcode && (
                  <code className="text-xs text-muted-foreground">{currentProduct.barcode}</code>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Stock système</Label>
                  <div className="text-2xl font-bold">
                    {getStockInfo(currentProduct).displayValue}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {getStockInfo(currentProduct).displayUnit}
                  </div>
                </div>
                <div>
                  <Label htmlFor="actual-stock">Stock réel</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => setNewStockValue(prev => Math.max(0, parseFloat(prev) - 1).toString())}
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    <Input
                      id="actual-stock"
                      type="number"
                      step="0.01"
                      min="0"
                      value={newStockValue}
                      onChange={(e) => setNewStockValue(e.target.value)}
                      className="text-center text-lg font-bold"
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => setNewStockValue(prev => (parseFloat(prev) + 1).toString())}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {getStockInfo(currentProduct).unit}
                  </div>
                </div>
              </div>

              {parseFloat(newStockValue) !== getStockInfo(currentProduct).value && (
                <div className="space-y-2">
                  <Label htmlFor="reason">Raison de l'ajustement</Label>
                  <Input
                    id="reason"
                    placeholder="Ex: Erreur de saisie, casse, vol..."
                    value={adjustmentReason}
                    onChange={(e) => setAdjustmentReason(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setAdjustmentDialog(false);
                setCurrentProduct(null);
              }}
              className="w-full sm:w-auto"
            >
              Annuler
            </Button>
            {currentProduct && parseFloat(newStockValue) === getStockInfo(currentProduct).value ? (
              <Button
                onClick={() => verifyStock(currentProduct.id)}
                className="w-full sm:w-auto gap-2 bg-emerald-600 hover:bg-emerald-700"
              >
                <Check className="w-4 h-4" />
                Stock correct
              </Button>
            ) : (
              <Button
                onClick={adjustStock}
                disabled={isProcessing}
                className="w-full sm:w-auto gap-2 bg-amber-600 hover:bg-amber-700"
              >
                {isProcessing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
                Ajuster le stock
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
