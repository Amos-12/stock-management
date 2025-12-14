import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  ArrowLeft,
  Package,
  Layers,
  Zap,
  Droplet,
  Boxes,
  Shirt,
  Cpu,
  Grid3X3,
  CircleDot,
  X,
} from 'lucide-react';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  cartQuantity: number;
  unit: string;
  category: string;
  currency: 'USD' | 'HTG';
  actualPrice?: number;
  displayUnit?: string;
  surface_par_boite?: number;
  stock_barre?: number;
  bars_per_ton?: number;
  sourceUnit?: string;
  dimension?: string;
  diametre?: string;
  specifications_techniques?: Record<string, any>;
}

interface CartSectionProps {
  cart: CartItem[];
  onContinueShopping: () => void;
  onCheckout: () => void;
  onRemoveItem: (id: string) => void;
  onUpdateQuantity: (id: string, delta: number) => void;
  onDirectQuantityChange: (id: string, value: string) => void;
  onClearCart: () => void;
  formatAmount: (amount: number, currency?: 'USD' | 'HTG' | boolean) => string;
  getTotalAmount: () => number;
  getTotalsByCurrency: () => { totalUSD: number; totalHTG: number };
  getTonnageLabel: (tonnage: number) => string;
  barresToTonnage: (barres: number, barsPerTon: number) => number;
  companySettings?: {
    usd_htg_rate?: number;
    default_display_currency?: string;
  } | null;
}

// Category icon mapping
const getCategoryIcon = (category: string) => {
  const icons: Record<string, React.ReactNode> = {
    ceramique: <Grid3X3 className="w-5 h-5" />,
    fer: <CircleDot className="w-5 h-5" />,
    energie: <Zap className="w-5 h-5" />,
    blocs: <Boxes className="w-5 h-5" />,
    vetements: <Shirt className="w-5 h-5" />,
    electronique: <Cpu className="w-5 h-5" />,
    electromenager: <Droplet className="w-5 h-5" />,
    boissons: <Droplet className="w-5 h-5" />,
  };
  return icons[category] || <Package className="w-5 h-5" />;
};

// Category color mapping
const getCategoryColor = (category: string) => {
  const colors: Record<string, string> = {
    ceramique: 'bg-blue-500/10 text-blue-600 border-blue-200',
    fer: 'bg-orange-500/10 text-orange-600 border-orange-200',
    energie: 'bg-yellow-500/10 text-yellow-600 border-yellow-200',
    blocs: 'bg-stone-500/10 text-stone-600 border-stone-200',
    vetements: 'bg-purple-500/10 text-purple-600 border-purple-200',
    electronique: 'bg-cyan-500/10 text-cyan-600 border-cyan-200',
    electromenager: 'bg-indigo-500/10 text-indigo-600 border-indigo-200',
    boissons: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  };
  return colors[category] || 'bg-muted text-muted-foreground';
};

// Category label mapping
const getCategoryLabel = (category: string) => {
  const labels: Record<string, string> = {
    ceramique: 'Céramique',
    fer: 'Fer',
    energie: 'Énergie',
    blocs: 'Blocs',
    vetements: 'Vêtements',
    electronique: 'Électronique',
    electromenager: 'Électroménager',
    boissons: 'Boissons',
    alimentaires: 'Alimentaire',
    gazeuses: 'Gazeuses',
    autres: 'Autres',
  };
  return labels[category] || category;
};

// Get compact specs for cart items
const getCartItemSpecs = (item: CartItem): { label: string; value: string; color: string }[] => {
  const specs: { label: string; value: string; color: string }[] = [];
  
  if (item.category === 'ceramique' && item.dimension) {
    specs.push({ label: 'Dim', value: item.dimension, color: 'bg-blue-100 text-blue-700' });
  }
  if (item.category === 'fer' && item.diametre) {
    specs.push({ label: 'Ø', value: item.diametre, color: 'bg-orange-100 text-orange-700' });
  }
  
  // Dynamic specs from specifications_techniques
  if (item.specifications_techniques) {
    const specEntries = Object.entries(item.specifications_techniques);
    let addedCount = 0;
    for (const [key, value] of specEntries) {
      if (value && addedCount < 2) {
        const displayKey = key.replace(/_/g, ' ').substring(0, 8);
        const displayValue = String(value).substring(0, 12);
        specs.push({ label: displayKey, value: displayValue, color: 'bg-muted text-muted-foreground' });
        addedCount++;
      }
    }
  }
  
  return specs;
};

export const CartSection: React.FC<CartSectionProps> = ({
  cart,
  onContinueShopping,
  onCheckout,
  onRemoveItem,
  onUpdateQuantity,
  onDirectQuantityChange,
  onClearCart,
  formatAmount,
  getTotalAmount,
  getTotalsByCurrency,
  getTonnageLabel,
  barresToTonnage,
  companySettings,
}) => {
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  
  const totalItems = cart.reduce((sum, item) => sum + item.cartQuantity, 0);
  const distinctProducts = cart.length;
  const { totalUSD, totalHTG } = getTotalsByCurrency();
  const hasMultipleCurrencies = totalUSD > 0 && totalHTG > 0;
  const rate = companySettings?.usd_htg_rate || 132;
  const displayCurrency = (companySettings?.default_display_currency || 'HTG') as 'USD' | 'HTG';
  
  // Calculate unified total
  const unifiedTotal = displayCurrency === 'HTG' 
    ? totalHTG + (totalUSD * rate)
    : totalUSD + (totalHTG / rate);

  // Empty cart state
  if (cart.length === 0) {
    return (
      <Card className="shadow-lg border-2 border-dashed">
        <CardContent className="p-12">
          <div className="text-center">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-muted/50 flex items-center justify-center">
              <ShoppingCart className="w-12 h-12 text-muted-foreground/50" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Votre panier est vide</h3>
            <p className="text-muted-foreground mb-6">
              Ajoutez des produits pour commencer une vente
            </p>
            <Button onClick={onContinueShopping} variant="default" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Parcourir les produits
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg overflow-hidden">
      {/* Enhanced Header */}
      <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <ShoppingCart className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Panier</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">
                  {distinctProducts} produit{distinctProducts > 1 ? 's' : ''}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {Math.round(totalItems)} unité{totalItems > 1 ? 's' : ''}
                </Badge>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Quick Total Preview */}
            <div className="hidden sm:block text-right mr-2">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="font-bold text-success">{formatAmount(unifiedTotal, displayCurrency)}</p>
            </div>
            
            {/* Clear Cart Button */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10">
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Vider</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Vider le panier ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action supprimera tous les {distinctProducts} produit{distinctProducts > 1 ? 's' : ''} de votre panier. Cette action est irréversible.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={onClearCart} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Vider le panier
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="flex flex-col h-[55vh] md:h-[60vh]">
          {/* Scrollable Items List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.map((item, index) => {
              const itemTotal = item.actualPrice !== undefined ? item.actualPrice : (item.price * item.cartQuantity);
              const displayQuantity = item.category === 'ceramique' ? item.cartQuantity.toFixed(2) : item.cartQuantity;
              const unitPrice = item.actualPrice !== undefined ? (item.actualPrice / item.cartQuantity) : item.price;
              const specs = getCartItemSpecs(item);
              const isDeleting = deletingItemId === item.id;
              
              // Calculate remaining stock
              const maxStock = item.category === 'fer' ? (item.stock_barre || 0) : item.quantity;
              const stockUsedPercent = Math.min(100, (item.cartQuantity / maxStock) * 100);
              
              return (
                <div 
                  key={item.id} 
                  className={`group relative bg-card border rounded-xl p-4 transition-all duration-300 hover:shadow-md hover:border-primary/30 ${isDeleting ? 'animate-scale-out opacity-0' : 'animate-fade-in'}`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex gap-4">
                    {/* Category Icon */}
                    <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${getCategoryColor(item.category)}`}>
                      {getCategoryIcon(item.category)}
                    </div>
                    
                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="font-semibold text-sm leading-tight line-clamp-2">{item.name}</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0 h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            setDeletingItemId(item.id);
                            setTimeout(() => onRemoveItem(item.id), 250);
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      {/* Category Badge + Specs */}
                      <div className="flex items-center gap-1.5 flex-wrap mb-2">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getCategoryColor(item.category)}`}>
                          {getCategoryLabel(item.category)}
                        </Badge>
                        {specs.map((spec, i) => (
                          <Badge key={i} variant="secondary" className={`text-[10px] px-1.5 py-0 ${spec.color}`}>
                            {spec.value}
                          </Badge>
                        ))}
                      </div>
                      
                      {/* Quantity Description */}
                      <p className="text-xs text-muted-foreground mb-2">
                        {item.category === 'fer' && item.bars_per_ton 
                          ? item.sourceUnit === 'tonne' 
                            ? `${item.cartQuantity} barres (≈ ${getTonnageLabel(barresToTonnage(item.cartQuantity, item.bars_per_ton))})`
                            : item.cartQuantity % item.bars_per_ton === 0
                              ? `${item.cartQuantity} barres (= ${item.cartQuantity / item.bars_per_ton} tonne${item.cartQuantity / item.bars_per_ton > 1 ? 's' : ''})`
                              : `${item.cartQuantity} barres`
                          : item.category === 'ceramique' && item.surface_par_boite
                            ? `${displayQuantity} m² (${(item.cartQuantity / item.surface_par_boite).toFixed(2)} boîtes)`
                            : `${displayQuantity} ${item.unit}`
                        }
                      </p>
                      
                      {/* Price Row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-muted-foreground">
                            {formatAmount(unitPrice, item.currency)}/{item.category === 'ceramique' ? 'm²' : item.unit}
                          </span>
                          <span className="text-muted-foreground">×</span>
                          <span className="font-medium">{displayQuantity}</span>
                        </div>
                        <span className="font-bold text-success">
                          {formatAmount(itemTotal, item.currency)}
                        </span>
                      </div>
                      
                      {/* Stock Progress */}
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                          <span>Stock utilisé</span>
                          <span>{stockUsedPercent.toFixed(0)}%</span>
                        </div>
                        <Progress value={stockUsedPercent} className="h-1" />
                      </div>
                    </div>
                  </div>
                  
                  {/* Quantity Controls - Redesigned Stepper */}
                  <div className="mt-3 pt-3 border-t flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Quantité</span>
                    
                    {item.category === 'ceramique' ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium bg-muted px-3 py-1.5 rounded-full">
                          {displayQuantity} m²
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            setDeletingItemId(item.id);
                            setTimeout(() => onRemoveItem(item.id), 250);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 w-9 rounded-l-full rounded-r-none border-r-0 hover:bg-muted"
                          onClick={() => onUpdateQuantity(item.id, -1)}
                          disabled={item.cartQuantity <= 1}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </Button>
                        <Input
                          type="number"
                          min="1"
                          max={maxStock}
                          value={item.cartQuantity}
                          onChange={(e) => onDirectQuantityChange(item.id, e.target.value)}
                          className="h-9 w-14 text-center text-sm font-semibold rounded-none border-x-0 focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 w-9 rounded-r-full rounded-l-none border-l-0 hover:bg-muted"
                          onClick={() => onUpdateQuantity(item.id, 1)}
                          disabled={item.cartQuantity >= maxStock}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Enhanced Summary Footer */}
          <div className="border-t bg-muted/30 p-4 space-y-4">
            {/* Currency Breakdown if multiple currencies */}
            {hasMultipleCurrencies && (
              <div className="space-y-1.5 pb-3 border-b border-dashed">
                {totalUSD > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-green-50 text-green-700 border-green-200">$</Badge>
                      Sous-total USD
                    </span>
                    <span className="font-medium">{formatAmount(totalUSD, 'USD')}</span>
                  </div>
                )}
                {totalHTG > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-blue-50 text-blue-700 border-blue-200">G</Badge>
                      Sous-total HTG
                    </span>
                    <span className="font-medium">{formatAmount(totalHTG, 'HTG')}</span>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground italic">
                  Taux: 1 USD = {rate.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} HTG
                </p>
              </div>
            )}
            
            {/* Summary Stats */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{distinctProducts} produit{distinctProducts > 1 ? 's' : ''}</span>
                </div>
              </div>
              
              {/* Grand Total */}
              <div className="text-right">
                <p className="text-xs text-muted-foreground mb-0.5">Total à payer</p>
                <p className="text-2xl font-bold text-success">
                  {formatAmount(unifiedTotal, displayCurrency)}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <Button 
                onClick={onContinueShopping} 
                variant="outline"
                className="flex-1 gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Continuer
              </Button>
              <Button 
                onClick={onCheckout} 
                className="flex-1 gap-2 bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02]"
              >
                Finaliser
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
