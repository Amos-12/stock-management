import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { 
  Package, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Receipt, 
  TrendingUp,
  Search,
  AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
  alert_threshold: number;
  is_active: boolean;
}

interface CartItem extends Product {
  cartQuantity: number;
}

interface Sale {
  id: string;
  customer_name?: string;
  total_amount: number;
  payment_method: string;
  created_at: string;
}

const SellerDashboard = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [isProcessingSale, setIsProcessingSale] = useState(false);
  const [showSaleDialog, setShowSaleDialog] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchMySales();
  }, []);

  useEffect(() => {
    const filtered = products.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredProducts(filtered);
  }, [searchTerm, products]);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .gt('quantity', 0)
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

  const fetchMySales = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setSales(data || []);
    } catch (error) {
      console.error('Error fetching sales:', error);
    }
  };

  const addToCart = (product: Product) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id);
      
      if (existingItem) {
        if (existingItem.cartQuantity >= product.quantity) {
          toast({
            title: "Stock insuffisant",
            description: `Stock disponible : ${product.quantity}`,
            variant: "destructive"
          });
          return prevCart;
        }
        
        return prevCart.map(item =>
          item.id === product.id
            ? { ...item, cartQuantity: item.cartQuantity + 1 }
            : item
        );
      } else {
        return [...prevCart, { ...product, cartQuantity: 1 }];
      }
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prevCart => {
      return prevCart.map(item =>
        item.id === productId
          ? { ...item, cartQuantity: Math.max(0, item.cartQuantity - 1) }
          : item
      ).filter(item => item.cartQuantity > 0);
    });
  };

  const getTotalAmount = () => {
    return cart.reduce((total, item) => total + (item.price * item.cartQuantity), 0);
  };

  const processSale = async () => {
    if (cart.length === 0) {
      toast({
        title: "Panier vide",
        description: "Ajoutez des produits au panier",
        variant: "destructive"
      });
      return;
    }

    if (!user) return;

    setIsProcessingSale(true);

    try {
      const totalAmount = getTotalAmount();

      // Create sale record
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert([{
          customer_name: customerName.trim() || null,
          seller_id: user.id,
          total_amount: totalAmount,
          payment_method: 'cash'
        }])
        .select()
        .single();

      if (saleError) throw saleError;

      // Create sale items and update stock
      for (const item of cart) {
        // Insert sale item
        const { error: itemError } = await supabase
          .from('sale_items')
          .insert([{
            sale_id: saleData.id,
            product_id: item.id,
            product_name: item.name,
            quantity: item.cartQuantity,
            unit_price: item.price,
            subtotal: item.price * item.cartQuantity
          }]);

        if (itemError) throw itemError;

        // Update product quantity
        const newQuantity = item.quantity - item.cartQuantity;
        const { error: updateError } = await supabase
          .from('products')
          .update({ quantity: newQuantity })
          .eq('id', item.id);

        if (updateError) throw updateError;

        // Record stock movement
        const { error: movementError } = await supabase
          .from('stock_movements')
          .insert([{
            product_id: item.id,
            movement_type: 'out',
            quantity: -item.cartQuantity,
            previous_quantity: item.quantity,
            new_quantity: newQuantity,
            reason: `Vente #${saleData.id}`,
            sale_id: saleData.id,
            created_by: user.id
          }]);

        if (movementError) throw movementError;
      }

      toast({
        title: "Vente enregistrée",
        description: `Vente de ${totalAmount.toFixed(2)}€ enregistrée avec succès`,
      });

      // Reset cart and form
      setCart([]);
      setCustomerName('');
      setShowSaleDialog(false);

      // Refresh data
      fetchProducts();
      fetchMySales();

    } catch (error) {
      console.error('Error processing sale:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer la vente",
        variant: "destructive"
      });
    } finally {
      setIsProcessingSale(false);
    }
  };

  const categories = [
    { value: 'alimentaires', label: 'Alimentaires' },
    { value: 'boissons', label: 'Boissons' },
    { value: 'gazeuses', label: 'Gazeuses' },
    { value: 'electronique', label: 'Électronique' },
    { value: 'autres', label: 'Autres' }
  ];

  if (loading) {
    return (
      <DashboardLayout title="Espace Vendeur" role="seller">
        <div className="flex items-center justify-center h-64">
          <ShoppingCart className="w-8 h-8 text-primary animate-pulse" />
          <span className="ml-2 text-muted-foreground">Chargement...</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Espace Vendeur" role="seller">
      <div className="space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Produits en Stock</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{products.length}</div>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Panier Actuel</CardTitle>
              <ShoppingCart className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{cart.length}</div>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Mes Ventes</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{sales.length}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Products List */}
          <div className="lg:col-span-2">
            <Card className="shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Produits Disponibles
                  </CardTitle>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher un produit..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-smooth"
                    >
                      <div className="flex-1">
                        <h4 className="font-medium">{product.name}</h4>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {categories.find(c => c.value === product.category)?.label}
                          </Badge>
                          <span>•</span>
                          <span>{product.price.toFixed(2)} €</span>
                          <span>•</span>
                          <div className="flex items-center gap-1">
                            <span>Stock: {product.quantity}</span>
                            {product.quantity <= product.alert_threshold && (
                              <AlertCircle className="w-3 h-3 text-warning" />
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => addToCart(product)}
                        disabled={product.quantity === 0}
                        variant={product.quantity > 0 ? "default" : "secondary"}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Ajouter
                      </Button>
                    </div>
                  ))}
                  {filteredProducts.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Aucun produit trouvé</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Shopping Cart */}
          <div>
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  Panier ({cart.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {cart.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Panier vide</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {cart.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-2 border rounded">
                          <div className="flex-1">
                            <h5 className="text-sm font-medium">{item.name}</h5>
                            <p className="text-xs text-muted-foreground">
                              {item.price.toFixed(2)} € × {item.cartQuantity}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => removeFromCart(item.id)}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <span className="text-sm font-medium w-8 text-center">
                              {item.cartQuantity}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => addToCart(item)}
                              disabled={item.cartQuantity >= item.quantity}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center mb-4">
                        <span className="font-semibold">Total:</span>
                        <span className="text-lg font-bold text-success">
                          {getTotalAmount().toFixed(2)} €
                        </span>
                      </div>

                      <Dialog open={showSaleDialog} onOpenChange={setShowSaleDialog}>
                        <DialogTrigger asChild>
                          <Button className="w-full" variant="seller">
                            <Receipt className="w-4 h-4 mr-2" />
                            Finaliser la Vente
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Finaliser la vente</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="customer-name">Nom du client (optionnel)</Label>
                              <Input
                                id="customer-name"
                                placeholder="Nom du client"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                              />
                            </div>

                            <div className="border rounded p-4 bg-muted/50">
                              <h4 className="font-medium mb-2">Résumé de la commande</h4>
                              {cart.map((item) => (
                                <div key={item.id} className="flex justify-between text-sm">
                                  <span>{item.name} × {item.cartQuantity}</span>
                                  <span>{(item.price * item.cartQuantity).toFixed(2)} €</span>
                                </div>
                              ))}
                              <div className="border-t mt-2 pt-2 flex justify-between font-semibold">
                                <span>Total</span>
                                <span>{getTotalAmount().toFixed(2)} €</span>
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <Button
                                onClick={processSale}
                                disabled={isProcessingSale}
                                className="flex-1"
                                variant="success"
                              >
                                {isProcessingSale ? 'Traitement...' : 'Confirmer la Vente'}
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => setShowSaleDialog(false)}
                              >
                                Annuler
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Recent Sales */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Mes Ventes Récentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Paiement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell>
                      {new Date(sale.created_at).toLocaleDateString('fr-FR')}
                    </TableCell>
                    <TableCell>{sale.customer_name || 'Client anonyme'}</TableCell>
                    <TableCell className="font-semibold">
                      {sale.total_amount.toFixed(2)} €
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {sale.payment_method}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {sales.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Aucune vente enregistrée</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default SellerDashboard;