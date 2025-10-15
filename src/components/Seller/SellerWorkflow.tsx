import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  unit: string;
  price: number;
  quantity: number;
  alert_threshold: number;
  is_active: boolean;
  sale_type: 'retail' | 'wholesale';
  // Ceramic-specific fields
  dimension?: string;
  surface_par_boite?: number;
  prix_m2?: number;
  stock_boite?: number;
  // Iron bar-specific fields
  diametre?: string;
  longueur_barre?: number;
  prix_par_metre?: number;
  prix_par_barre?: number;
  stock_barre?: number;
  decimal_autorise?: boolean;
}

interface CartItem extends Product {
  cartQuantity: number;
  displayUnit?: string; // For ceramics: "m²", For iron: "barre"
  actualPrice?: number; // Calculated price for ceramics
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
  const [saleTypeFilter, setSaleTypeFilter] = useState<'all' | 'retail' | 'wholesale'>('all');
  const [customerName, setCustomerName] = useState('');
  const [discountType, setDiscountType] = useState<'none' | 'percentage' | 'amount'>('none');
  const [discountValue, setDiscountValue] = useState('0');
  const [isProcessing, setIsProcessing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completedSale, setCompletedSale] = useState<any>(null);
  const [customQuantityDialog, setCustomQuantityDialog] = useState<{open: boolean, product: Product | null}>({open: false, product: null});
  const [customQuantityValue, setCustomQuantityValue] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    const filtered = products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSaleType = saleTypeFilter === 'all' || product.sale_type === saleTypeFilter;
      return matchesSearch && matchesSaleType;
    });
    setFilteredProducts(filtered);
  }, [searchTerm, saleTypeFilter, products]);

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

  const addToCart = (product: Product, customQty?: number) => {
    // For ceramics, open dialog to get m² needed
    if (product.category === 'ceramique' && !customQty) {
      setCustomQuantityDialog({open: true, product});
      return;
    }

    // For iron bars, add directly in barres
    if (product.category === 'fer' && !customQty) {
      setCustomQuantityDialog({open: true, product});
      return;
    }

    let quantityToAdd = customQty || 1;
    let actualPrice = product.price;
    let displayUnit = product.unit;

    // Calculate for ceramics
    if (product.category === 'ceramique' && product.surface_par_boite && product.prix_m2) {
      const surfaceNeeded = customQty || 0;
      const boxesNeeded = Math.ceil(surfaceNeeded / product.surface_par_boite);
      const actualSurface = boxesNeeded * product.surface_par_boite;
      quantityToAdd = boxesNeeded;
      actualPrice = actualSurface * product.prix_m2;
      displayUnit = `m² (${boxesNeeded} boîtes)`;
    }

    // Calculate for iron bars
    if (product.category === 'fer' && product.prix_par_barre) {
      quantityToAdd = customQty || 1;
      actualPrice = product.prix_par_barre * quantityToAdd;
      displayUnit = 'barre';
    }

    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id);
      
      if (existingItem) {
        const newCartQuantity = existingItem.cartQuantity + quantityToAdd;
        const availableStock = product.category === 'ceramique' ? (product.stock_boite || 0) : 
                                product.category === 'fer' ? (product.stock_barre || 0) : 
                                product.quantity;
        
        if (newCartQuantity > availableStock) {
          toast({
            title: "Stock insuffisant",
            description: `Stock disponible : ${availableStock} ${displayUnit}`,
            variant: "destructive"
          });
          return prevCart;
        }
        
        return prevCart.map(item =>
          item.id === product.id
            ? { ...item, cartQuantity: newCartQuantity, actualPrice, displayUnit }
            : item
        );
      } else {
        return [...prevCart, { 
          ...product, 
          cartQuantity: quantityToAdd,
          actualPrice,
          displayUnit
        }];
      }
    });

    setCustomQuantityDialog({open: false, product: null});
    setCustomQuantityValue('');
  };

  const handleCustomQuantitySubmit = () => {
    const product = customQuantityDialog.product;
    if (!product || !customQuantityValue) return;

    const qty = parseFloat(customQuantityValue);
    if (isNaN(qty) || qty <= 0) {
      toast({
        title: "Quantité invalide",
        description: "Veuillez entrer une quantité valide",
        variant: "destructive"
      });
      return;
    }

    addToCart(product, qty);
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
    return cart.reduce((total, item) => {
      const price = item.actualPrice !== undefined ? item.actualPrice : (item.price * item.cartQuantity);
      return total + price;
    }, 0);
  };

  const getSubtotal = () => {
    return getTotalAmount();
  };

  const getDiscountAmount = () => {
    const subtotal = getSubtotal();
    const discVal = parseFloat(discountValue) || 0;
    
    if (discountType === 'percentage') {
      return Math.min(subtotal * (discVal / 100), subtotal);
    } else if (discountType === 'amount') {
      return Math.min(discVal, subtotal);
    }
    return 0;
  };

  const getFinalTotal = () => {
    return Math.max(0, getSubtotal() - getDiscountAmount());
  };

  const processSale = async () => {
    if (!user || cart.length === 0) return;

    setIsProcessing(true);

    try {
      const subtotal = getSubtotal();
      const discountAmount = getDiscountAmount();
      const totalAmount = getFinalTotal();

      // Prepare sale data for Edge Function
      const saleRequest = {
        customer_name: customerName.trim() || null,
        payment_method: 'cash',
        subtotal: subtotal,
        discount_type: discountType,
        discount_value: parseFloat(discountValue) || 0,
        discount_amount: discountAmount,
        total_amount: totalAmount,
        items: cart.map(item => ({
          product_id: item.id,
          product_name: item.name,
          quantity: item.cartQuantity,
          unit: item.displayUnit || item.unit,
          unit_price: item.actualPrice !== undefined ? item.actualPrice / item.cartQuantity : item.price,
          subtotal: item.actualPrice !== undefined ? item.actualPrice : (item.price * item.cartQuantity)
        }))
      };

      // Call Edge Function to process sale
      const { data, error } = await supabase.functions.invoke('process-sale', {
        body: saleRequest
      });

      if (error) throw error;
      
      if (!data.success) {
        throw new Error(data.error || 'Échec du traitement de la vente');
      }

      toast({
        title: "Vente enregistrée",
        description: `Vente de ${totalAmount.toFixed(2)} HTG enregistrée avec succès`,
      });

      setCurrentStep('success');
      setCompletedSale({
        ...data.sale,
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
      const errorMessage = error instanceof Error ? error.message : "Impossible d'enregistrer la vente";
      toast({
        title: "Erreur",
        description: errorMessage,
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
    setSaleTypeFilter('all');
    setDiscountType('none');
    setDiscountValue('0');
    setCompletedSale(null);
    onSaleComplete?.();
  };

  const categories = [
    { value: 'alimentaires', label: 'Alimentaires' },
    { value: 'boissons', label: 'Boissons' },
    { value: 'gazeuses', label: 'Gazeuses' },
    { value: 'electronique', label: 'Électronique' },
    { value: 'ceramique', label: 'Céramique' },
    { value: 'fer', label: 'Fer / Acier' },
    { value: 'materiaux_de_construction', label: 'Matériaux de construction' },
    { value: 'energie', label: 'Énergie' },
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
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un produit..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={saleTypeFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => setSaleTypeFilter('all')}
                >
                  Tous
                </Button>
                <Button
                  size="sm"
                  variant={saleTypeFilter === 'retail' ? 'default' : 'outline'}
                  onClick={() => setSaleTypeFilter('retail')}
                >
                  Détail
                </Button>
                <Button
                  size="sm"
                  variant={saleTypeFilter === 'wholesale' ? 'default' : 'outline'}
                  onClick={() => setSaleTypeFilter('wholesale')}
                >
                  Gros
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
              {filteredProducts.map((product) => {
                const cartItem = cart.find(item => item.id === product.id);
                let availableStock = product.quantity;
                let stockLabel = product.unit;
                
                // For ceramics, show boxes and m²
                if (product.category === 'ceramique' && product.stock_boite !== undefined) {
                  availableStock = product.stock_boite;
                  const surfaceDisponible = product.surface_par_boite ? 
                    (product.stock_boite * product.surface_par_boite).toFixed(2) : 0;
                  stockLabel = `boîtes (≈ ${surfaceDisponible} m²)`;
                }
                
                // For iron bars
                if (product.category === 'fer' && product.stock_barre !== undefined) {
                  availableStock = product.stock_barre;
                  stockLabel = 'barres';
                }
                
                const cartQuantity = cartItem?.cartQuantity || 0;
                const remainingStock = availableStock - cartQuantity;
                
                return (
                  <Card key={product.id} className="border hover:shadow-md transition-smooth">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-medium">{product.name}</h4>
                          {product.category === 'ceramique' && product.dimension && (
                            <p className="text-xs text-muted-foreground">Dimension: {product.dimension}</p>
                          )}
                          {product.category === 'fer' && product.diametre && (
                            <p className="text-xs text-muted-foreground">Diamètre: {product.diametre}</p>
                          )}
                          <div className="flex items-center gap-2 text-sm flex-wrap mt-1">
                            <Badge variant="outline" className="text-xs">
                              {categories.find(c => c.value === product.category)?.label}
                            </Badge>
                            <Badge variant={product.sale_type === 'retail' ? 'default' : 'secondary'} className="text-xs">
                              {product.sale_type === 'retail' ? 'Détail' : 'Gros'}
                            </Badge>
                            {product.category === 'ceramique' && product.prix_m2 ? (
                              <span className="text-success font-medium">{product.prix_m2.toFixed(2)} HTG/m²</span>
                            ) : product.category === 'fer' && product.prix_par_barre ? (
                              <span className="text-success font-medium">{product.prix_par_barre.toFixed(2)} HTG/barre</span>
                            ) : (
                              <span className="text-success font-medium">{product.price.toFixed(2)} HTG</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                            <span>Disponible: {remainingStock} {stockLabel} {cartQuantity > 0 ? `(${cartQuantity} au panier)` : ''}</span>
                            {remainingStock <= product.alert_threshold && (
                              <AlertCircle className="w-3 h-3 text-warning" />
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => addToCart(product)}
                          disabled={remainingStock === 0}
                          className="w-full"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          {product.category === 'ceramique' ? 'Entrer surface (m²)' : 
                           product.category === 'fer' ? 'Entrer nombre de barres' : 
                           'Ajouter au panier'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
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
                {cart.map((item) => {
                  const itemTotal = item.actualPrice !== undefined ? item.actualPrice : (item.price * item.cartQuantity);
                  return (
                    <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <h5 className="font-medium">{item.name}</h5>
                        <p className="text-sm text-muted-foreground">
                          {item.cartQuantity} {item.displayUnit || item.unit} = {itemTotal.toFixed(2)} HTG
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
                  );
                })}

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
                  <span>{item.name} × {item.cartQuantity} {item.unit}</span>
                  <span>{(item.price * item.cartQuantity).toFixed(2)} HTG</span>
                </div>
              ))}
              <div className="border-t mt-3 pt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Sous-total</span>
                  <span>{getSubtotal().toFixed(2)} HTG</span>
                </div>
                
                {/* Discount Section */}
                <div className="space-y-2 border-t pt-2">
                  <Label htmlFor="discount-type" className="text-sm">Type de remise</Label>
                  <Select
                    value={discountType}
                    onValueChange={(value: 'none' | 'percentage' | 'amount') => setDiscountType(value)}
                  >
                    <SelectTrigger id="discount-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucune remise</SelectItem>
                      <SelectItem value="percentage">Pourcentage (%)</SelectItem>
                      <SelectItem value="amount">Montant fixe (HTG)</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {discountType !== 'none' && (
                    <div className="space-y-2">
                      <Label htmlFor="discount-value" className="text-sm">
                        Valeur de la remise {discountType === 'percentage' ? '(%)' : '(HTG)'}
                      </Label>
                      <Input
                        id="discount-value"
                        type="number"
                        min="0"
                        max={discountType === 'percentage' ? '100' : getSubtotal().toString()}
                        step={discountType === 'percentage' ? '1' : '0.01'}
                        value={discountValue}
                        onChange={(e) => setDiscountValue(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  )}
                  
                  {discountType !== 'none' && getDiscountAmount() > 0 && (
                    <div className="flex justify-between text-sm text-warning">
                      <span>Remise appliquée</span>
                      <span>-{getDiscountAmount().toFixed(2)} HTG</span>
                    </div>
                  )}
                </div>
                
                <div className="border-t pt-2 flex justify-between font-semibold text-lg">
                  <span>Total</span>
                  <span className="text-success">{getFinalTotal().toFixed(2)} HTG</span>
                </div>
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
              La vente de {getFinalTotal().toFixed(2)} HTG a été enregistrée avec succès.
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

      {/* Custom Quantity Dialog */}
      <Dialog open={customQuantityDialog.open} onOpenChange={(open) => {
        if (!open) {
          setCustomQuantityDialog({open: false, product: null});
          setCustomQuantityValue('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {customQuantityDialog.product?.category === 'ceramique' 
                ? 'Entrer la surface nécessaire' 
                : 'Entrer le nombre de barres'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {customQuantityDialog.product && (
              <div className="p-3 border rounded-lg bg-muted/50">
                <p className="font-medium">{customQuantityDialog.product.name}</p>
                {customQuantityDialog.product.category === 'ceramique' && (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Dimension: {customQuantityDialog.product.dimension}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Surface par boîte: {customQuantityDialog.product.surface_par_boite} m²
                    </p>
                    <p className="text-sm text-success">
                      Prix: {customQuantityDialog.product.prix_m2} HTG/m²
                    </p>
                  </>
                )}
                {customQuantityDialog.product.category === 'fer' && (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Diamètre: {customQuantityDialog.product.diametre}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Longueur: {customQuantityDialog.product.longueur_barre}m par barre
                    </p>
                    <p className="text-sm text-success">
                      Prix: {customQuantityDialog.product.prix_par_barre} HTG/barre
                    </p>
                  </>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="custom-quantity">
                {customQuantityDialog.product?.category === 'ceramique' 
                  ? 'Surface nécessaire (m²)' 
                  : 'Nombre de barres'}
              </Label>
              <Input
                id="custom-quantity"
                type="number"
                step={customQuantityDialog.product?.category === 'ceramique' ? '0.01' : '1'}
                min="0"
                value={customQuantityValue}
                onChange={(e) => setCustomQuantityValue(e.target.value)}
                placeholder={customQuantityDialog.product?.category === 'ceramique' ? 'Ex: 15.5' : 'Ex: 10'}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleCustomQuantitySubmit();
                  }
                }}
              />
              {customQuantityDialog.product?.category === 'ceramique' && customQuantityValue && (
                <p className="text-xs text-muted-foreground">
                  {customQuantityDialog.product.surface_par_boite && (
                    <>
                      Boîtes nécessaires: {Math.ceil(parseFloat(customQuantityValue) / customQuantityDialog.product.surface_par_boite)}
                      {' '}(≈ {(Math.ceil(parseFloat(customQuantityValue) / customQuantityDialog.product.surface_par_boite) * customQuantityDialog.product.surface_par_boite).toFixed(2)} m²)
                    </>
                  )}
                </p>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setCustomQuantityDialog({open: false, product: null});
                  setCustomQuantityValue('');
                }}
              >
                Annuler
              </Button>
              <Button onClick={handleCustomQuantitySubmit}>
                Ajouter au panier
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
     </div>
   );
 };