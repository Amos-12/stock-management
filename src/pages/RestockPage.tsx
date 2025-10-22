import { useState, useEffect } from 'react';
import { ResponsiveDashboardLayout } from '@/components/Layout/ResponsiveDashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Package, Plus, TrendingUp, AlertCircle, RefreshCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Product {
  id: string;
  name: string;
  category: string;
  quantity: number;
  price: number;
  alert_threshold: number;
  stock_barre?: number;
  bars_per_ton?: number;
  diametre?: string;
}

const RestockPage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [restockQuantity, setRestockQuantity] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('id, name, category, quantity, price, alert_threshold, stock_barre, bars_per_ton, diametre')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les produits",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProduct || !restockQuantity || Number(restockQuantity) <= 0) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs correctement",
        variant: "destructive"
      });
      return;
    }

    try {
      setSubmitting(true);
      
      const product = products.find(p => p.id === selectedProduct);
      if (!product) throw new Error('Produit introuvable');

      const quantityToAdd = parseFloat(restockQuantity);
      
      // For iron products: handle tonnage to bars conversion
      if (product.category === 'fer' && product.bars_per_ton) {
        const barsToAdd = quantityToAdd * product.bars_per_ton;
        const currentStock = product.stock_barre || 0;
        const newStock = currentStock + barsToAdd;

        // Update iron bar stock
        const { error: updateError } = await supabase
          .from('products')
          .update({ stock_barre: newStock })
          .eq('id', selectedProduct);

        if (updateError) throw updateError;

        // Record stock movement
        const { data: { user } } = await supabase.auth.getUser();
        const { error: movementError } = await supabase
          .from('stock_movements')
          .insert({
            product_id: selectedProduct,
            movement_type: 'in',
            quantity: barsToAdd,
            previous_quantity: currentStock,
            new_quantity: newStock,
            reason: `${reason || 'Réapprovisionnement'} (${quantityToAdd} tonne${quantityToAdd > 1 ? 's' : ''} = ${barsToAdd.toFixed(2)} barres)`,
            created_by: user?.id
          });

        if (movementError) throw movementError;

        toast({
          title: "Succès",
          description: `${product.name} réapprovisionné: +${quantityToAdd} tonne${quantityToAdd > 1 ? 's' : ''} (+${barsToAdd.toFixed(2)} barres)`
        });
      } else {
        // For regular products
        const newQuantity = product.quantity + quantityToAdd;

        const { error: updateError } = await supabase
          .from('products')
          .update({ quantity: newQuantity })
          .eq('id', selectedProduct);

        if (updateError) throw updateError;

        // Record stock movement
        const { data: { user } } = await supabase.auth.getUser();
        const { error: movementError } = await supabase
          .from('stock_movements')
          .insert({
            product_id: selectedProduct,
            movement_type: 'in',
            quantity: quantityToAdd,
            previous_quantity: product.quantity,
            new_quantity: newQuantity,
            reason: reason || 'Réapprovisionnement manuel',
            created_by: user?.id
          });

        if (movementError) throw movementError;

        toast({
          title: "Succès",
          description: `${product.name} réapprovisionné avec succès (+${quantityToAdd})`
        });
      }

      // Reset form
      setSelectedProduct('');
      setRestockQuantity('');
      setReason('');
      
      // Refresh products
      fetchProducts();
    } catch (error) {
      console.error('Error restocking:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'effectuer le réapprovisionnement",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getLowStockProducts = () => {
    return products.filter(p => p.quantity <= p.alert_threshold);
  };

  return (
    <ResponsiveDashboardLayout 
      title="Réapprovisionnement" 
      role="admin"
      currentSection="restock"
    >
      <div className="space-y-6">
        {/* Low Stock Alert */}
        {getLowStockProducts().length > 0 && (
          <Card className="border-warning bg-warning/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-warning">
                <AlertCircle className="w-5 h-5" />
                Produits en rupture ou stock faible ({getLowStockProducts().length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {getLowStockProducts().map(product => (
                  <div key={product.id} className="flex items-center justify-between p-2 border rounded-lg">
                    <div>
                      <span className="font-medium">{product.name}</span>
                      <span className="text-sm text-muted-foreground ml-2">
                        ({product.category})
                      </span>
                    </div>
                    <Badge variant="destructive">
                      Stock: {product.quantity}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Restock Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Ajouter du Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRestock} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Produit *</Label>
                  <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un produit" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map(product => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} (Stock: {product.quantity})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Quantité à ajouter *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={restockQuantity}
                    onChange={(e) => setRestockQuantity(e.target.value)}
                    placeholder={
                      products.find(p => p.id === selectedProduct)?.category === 'fer'
                        ? "Ex: 0.25 (tonne), 0.5, 1, 1.75"
                        : "Ex: 50"
                    }
                  />
                  {products.find(p => p.id === selectedProduct)?.category === 'fer' && products.find(p => p.id === selectedProduct)?.bars_per_ton && (
                    <p className="text-xs text-muted-foreground">
                      {restockQuantity && parseFloat(restockQuantity) > 0 ? (
                        <>
                          {parseFloat(restockQuantity)} tonne{parseFloat(restockQuantity) > 1 ? 's' : ''} = {' '}
                          {(parseFloat(restockQuantity) * (products.find(p => p.id === selectedProduct)?.bars_per_ton || 0)).toFixed(2)} barres
                        </>
                      ) : (
                        'Saisir en tonnes (accepte les décimales)'
                      )}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Raison / Note (optionnel)</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex: Livraison fournisseur, Inventaire correction..."
                  rows={2}
                />
              </div>

              <Button 
                type="submit" 
                disabled={submitting || !selectedProduct || !restockQuantity}
                className="w-full md:w-auto"
              >
                {submitting ? "Traitement..." : "Réapprovisionner"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Products Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Tous les Produits
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={fetchProducts} title="Rafraîchir">
                <RefreshCcw className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Package className="w-8 h-8 text-primary animate-pulse" />
                <span className="ml-2 text-muted-foreground">Chargement...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      <TableHead>Catégorie</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead className="text-right">Seuil</TableHead>
                      <TableHead className="text-right">Prix</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => {
                      const isLowStock = product.quantity <= product.alert_threshold;
                      return (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell className="capitalize">{product.category}</TableCell>
                          <TableCell className="text-right">{product.quantity}</TableCell>
                          <TableCell className="text-right">{product.alert_threshold}</TableCell>
                          <TableCell className="text-right">{product.price.toFixed(2)} HTG</TableCell>
                          <TableCell>
                            {isLowStock ? (
                              <Badge variant="destructive">Stock faible</Badge>
                            ) : (
                              <Badge variant="outline" className="text-success border-success">
                                En stock
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ResponsiveDashboardLayout>
  );
};

export default RestockPage;
