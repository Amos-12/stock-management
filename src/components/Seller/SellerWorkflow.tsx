import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  ShoppingCart, 
  Package, 
  Search,
  Plus,
  Minus,
  Receipt,
  CheckCircle,
  ArrowRight,
  AlertCircle,
  FileText
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { InvoiceGenerator } from '@/components/Invoice/InvoiceGenerator';

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

type WorkflowStep = 'products' | 'cart' | 'checkout' | 'success';

interface SellerWorkflowProps {
  onSaleComplete?: () => void;
}

export const SellerWorkflow = ({ onSaleComplete }: SellerWorkflowProps) => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completedSale, setCompletedSale] = useState<any>(null);

  useEffect(() => {
    fetchProducts();
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

  const updateQuantity = (productId: string, change: number) => {
    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.id === productId) {
          const newQuantity = Math.max(0, item.cartQuantity + change);
          if (newQuantity === 0) {
            return null; // Will be filtered out
          }
          if (newQuantity > item.quantity) {
            toast({
              title: "Stock insuffisant",
              description: `Stock disponible : ${item.quantity}`,
              variant: "destructive"
            });
            return item;
          }
          return { ...item, cartQuantity: newQuantity };
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  const getTotalAmount = () => {
    return cart.reduce((total, item) => total + (item.price * item.cartQuantity), 0);
  };

  const processSale = async () => {
    if (!user || cart.length === 0) return;

    setIsProcessing(true);

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
        description: `Vente de ${totalAmount.toFixed(2)} HTG enregistrée avec succès`,
      });

      setCurrentStep('success');
      setCompletedSale({
        ...saleData,
        items: cart.map(item => ({
          name: item.name,
          quantity: item.cartQuantity,
          unit_price: item.price,
          total: item.price * item.cartQuantity
        }))
      });
      
      // Refresh products
      fetchProducts();
      
      // Call parent callback
      onSaleComplete?.();

    } catch (error) {
      console.error('Error processing sale:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer la vente",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const resetWorkflow = () => {
    setCurrentStep('products');
    setCart([]);
    setCustomerName('');
    setSearchTerm('');
    setCompletedSale(null);
    onSaleComplete?.();
  };

  const categories = [
    { value: 'alimentaires', label: 'Alimentaires' },
    { value: 'boissons', label: 'Boissons' },
    { value: 'gazeuses', label: 'Gazeuses' },
    { value: 'electronique', label: 'Électronique' },
    { value: 'energie', label: 'Energie' },
    { value: 'autres', label: 'Autres' }
  ];

  const steps = [
    { id: 'products', label: 'Sélection Produits', icon: Package },
    { id: 'cart', label: 'Panier', icon: ShoppingCart },
    { id: 'checkout', label: 'Finalisation', icon: Receipt },
    { id: 'success', label: 'Confirmation', icon: CheckCircle }
  ];

  const getCurrentStepIndex = () => steps.findIndex(step => step.id === currentStep);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Package className="w-8 h-8 text-primary animate-pulse" />
        <span className="ml-2 text-muted-foreground">Chargement...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Workflow Progress */}
      <Card className="shadow-lg">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = step.id === currentStep;
              const isCompleted = index < getCurrentStepIndex();
              
              return (
                <div key={step.id} className="flex items-center w-full sm:w-auto">
                  <div className="flex items-center flex-1 sm:flex-initial">
                    <div
                      className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-smooth ${
                        isActive
                          ? 'border-primary bg-primary text-primary-foreground'
                          : isCompleted
                          ? 'border-success bg-success text-success-foreground'
                          : 'border-muted-foreground text-muted-foreground'
                      }`}
                    >
                      <StepIcon className="w-5 h-5" />
                    </div>
                    <div className="ml-3">
                      <div className={`text-sm font-medium ${isActive ? 'text-primary' : isCompleted ? 'text-success' : 'text-muted-foreground'}`}>
                        {step.label}
                      </div>
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <ArrowRight className="hidden sm:block w-5 h-5 mx-4 text-muted-foreground" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      {currentStep === 'products' && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Étape 1: Sélection des Produits
            </CardTitle>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
              {filteredProducts.map((product) => (
                <Card key={product.id} className="border hover:shadow-md transition-smooth">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-medium">{product.name}</h4>
                        <div className="flex items-center gap-2 text-sm">
                          <Badge variant="outline" className="text-xs">
                            {categories.find(c => c.value === product.category)?.label}
                          </Badge>
                          <span className="text-success font-medium">{product.price.toFixed(2)} HTG</span>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <span>Stock: {product.quantity}</span>
                          {product.quantity <= product.alert_threshold && (
                            <AlertCircle className="w-3 h-3 text-warning" />
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => addToCart(product)}
                        disabled={product.quantity === 0}
                        className="w-full"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Ajouter au panier
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {cart.length > 0 && (
              <div className="mt-6 flex flex-col sm:flex-row justify-end gap-2">
                <Button onClick={() => setCurrentStep('cart')} className="gap-2 w-full sm:w-auto">
                  Voir le panier ({cart.length})
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {currentStep === 'cart' && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Étape 2: Révision du Panier
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cart.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">Votre panier est vide</p>
                <Button 
                  onClick={() => setCurrentStep('products')} 
                  className="mt-4"
                  variant="outline"
                >
                  Retour aux produits
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <h5 className="font-medium">{item.name}</h5>
                      <p className="text-sm text-muted-foreground">
                        {item.price.toFixed(2)} HTG × {item.cartQuantity} = {(item.price * item.cartQuantity).toFixed(2)} HTG
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateQuantity(item.id, -1)}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="text-sm font-medium w-8 text-center">
                        {item.cartQuantity}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateQuantity(item.id, 1)}
                        disabled={item.cartQuantity >= item.quantity}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-lg font-semibold">Total:</span>
                    <span className="text-xl font-bold text-success">
                      {getTotalAmount().toFixed(2)} HTG
                    </span>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button 
                      onClick={() => setCurrentStep('products')} 
                      variant="outline"
                      className="flex-1"
                    >
                      Continuer les achats
                    </Button>
                    <Button 
                      onClick={() => setCurrentStep('checkout')} 
                      className="flex-1 gap-2"
                    >
                      Finaliser
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {currentStep === 'checkout' && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              Étape 3: Finalisation de la Vente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="customer-name">Nom du client (optionnel)</Label>
              <Input
                id="customer-name"
                placeholder="Nom du client"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>

            <div className="border rounded-lg p-4 bg-muted/50">
              <h4 className="font-medium mb-3">Résumé de la commande</h4>
              {cart.map((item) => (
                <div key={item.id} className="flex justify-between text-sm mb-2">
                  <span>{item.name} × {item.cartQuantity}</span>
                  <span>{(item.price * item.cartQuantity).toFixed(2)} HTG</span>
                </div>
              ))}
              <div className="border-t mt-3 pt-3 flex justify-between font-semibold text-lg">
                <span>Total</span>
                <span className="text-success">{getTotalAmount().toFixed(2)} HTG</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={() => setCurrentStep('cart')}
                variant="outline"
                className="flex-1"
              >
                Retour au panier
              </Button>
              <Button
                onClick={processSale}
                disabled={isProcessing}
                className="flex-1 gap-2"
                variant="default"
              >
                {isProcessing ? 'Traitement...' : (
                  <>
                    Confirmer la vente
                    <CheckCircle className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 'success' && (
        <Card className="shadow-lg">
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Vente confirmée !</h3>
            <p className="text-muted-foreground mb-6">
              La vente de {getTotalAmount().toFixed(2)} HTG a été enregistrée avec succès.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              {completedSale && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2 w-full sm:w-auto">
                      <FileText className="w-4 h-4" />
                      Imprimer Reçu
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <InvoiceGenerator saleData={completedSale} />
                  </DialogContent>
                </Dialog>
              )}
              <Button onClick={resetWorkflow} className="gap-2 w-full sm:w-auto">
                <Plus className="w-4 h-4" />
                Nouvelle vente
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};