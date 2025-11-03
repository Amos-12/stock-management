import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Package, Plus, Edit, Trash2, AlertCircle, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface Product {
  id: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  purchase_price?: number;
  quantity: number;
  alert_threshold: number;
  is_active: boolean;
  sale_type: 'retail' | 'wholesale';
  description?: string;
  created_at: string;
  // Ceramic-specific fields
  dimension?: string;
  surface_par_boite?: number;
  prix_m2?: number;
  stock_boite?: number;
  // Iron bar-specific fields
  diametre?: string;
  longueur_barre?: number;
  longueur_barre_ft?: number;
  bars_per_ton?: number;
  prix_par_metre?: number;
  prix_par_barre?: number;
  stock_barre?: number;
  decimal_autorise?: boolean;
  // Energy-specific fields
  puissance?: number;
  voltage?: number;
  capacite?: number;
  type_energie?: string;
  specifications_techniques?: any;
  // Blocs-specific fields
  bloc_type?: string;
  bloc_poids?: number;
  // Vêtements-specific fields
  vetement_taille?: string;
  vetement_genre?: string;
  vetement_couleur?: string;
}

type ProductCategory = 'alimentaires' | 'boissons' | 'gazeuses' | 'electronique' | 'autres' | 'ceramique' | 'fer' | 'materiaux_de_construction' | 'energie' | 'blocs' | 'vetements';

export const ProductManagement = () => {
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{open: boolean, productId: string | null, productName: string}>({
    open: false, 
    productId: null,
    productName: ''
  });
  
  const [formData, setFormData] = useState<{
    name: string;
    category: ProductCategory;
    unit: string;
    price: string;
    purchase_price: string;
    quantity: string;
    alert_threshold: string;
    description: string;
    is_active: boolean;
    sale_type: 'retail' | 'wholesale';
    dimension: string;
    surface_par_boite: string;
    prix_m2: string;
    prix_achat_m2: string;
    stock_boite: string;
    diametre: string;
    longueur_barre_ft: string;
    bars_per_ton: string;
    prix_par_metre: string;
    prix_par_barre: string;
    stock_barre: string;
    decimal_autorise: boolean;
    puissance: string;
    voltage: string;
    capacite: string;
    type_energie: string;
    bloc_type: string;
    bloc_poids: string;
    vetement_taille: string;
    vetement_genre: string;
    vetement_couleur: string;
  }>({
    name: '',
    category: 'alimentaires',
    unit: 'unité',
    price: '',
    purchase_price: '',
    quantity: '',
    alert_threshold: '10',
    description: '',
    is_active: true,
    sale_type: 'retail',
    dimension: '',
    surface_par_boite: '',
    prix_m2: '',
    prix_achat_m2: '',
    stock_boite: '',
    diametre: '',
    longueur_barre_ft: '',
    bars_per_ton: '',
    prix_par_metre: '',
    prix_par_barre: '',
    stock_barre: '',
    decimal_autorise: true,
    puissance: '',
    voltage: '',
    capacite: '',
    type_energie: '',
    bloc_type: '',
    bloc_poids: '',
    vetement_taille: '',
    vetement_genre: '',
    vetement_couleur: ''
  });

  const categories = [
    { value: 'alimentaires', label: 'Alimentaires' },
    { value: 'boissons', label: 'Boissons' },
    { value: 'gazeuses', label: 'Gazeuses' },
    { value: 'electronique', label: 'Électronique' },
    { value: 'ceramique', label: 'Céramique' },
    { value: 'fer', label: 'Fer / Acier' },
    { value: 'materiaux_de_construction', label: 'Matériaux de construction' },
    { value: 'energie', label: 'Énergie' },
    { value: 'blocs', label: 'Blocs' },
    { value: 'vetements', label: 'Vêtements' },
    { value: 'autres', label: 'Autres' }
  ];

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
        .order('created_at', { ascending: false });

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

  const resetForm = () => {
    setFormData({
      name: '',
      category: 'alimentaires' as const,
      unit: 'unité',
      price: '',
      purchase_price: '',
      quantity: '',
      alert_threshold: '10',
      description: '',
      is_active: true,
      sale_type: 'retail',
      dimension: '',
      surface_par_boite: '',
      prix_m2: '',
      prix_achat_m2: '',
      stock_boite: '',
      diametre: '',
      longueur_barre_ft: '',
      bars_per_ton: '',
      prix_par_metre: '',
      prix_par_barre: '',
      stock_barre: '',
      decimal_autorise: true,
      puissance: '',
      voltage: '',
      capacite: '',
      type_energie: '',
      bloc_type: '',
      bloc_poids: '',
      vetement_taille: '',
      vetement_genre: '',
      vetement_couleur: ''
    });
    setEditingProduct(null);
  };

  const handleEdit = (product: Product) => {
    if (!isAdmin) {
      toast({
        title: "Action non autorisée",
        description: "Seuls les administrateurs peuvent modifier les produits",
        variant: "destructive"
      });
      return;
    }
    
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category: product.category as ProductCategory,
      unit: product.unit || 'unité',
      price: product.price.toString(),
      purchase_price: product.purchase_price?.toString() || '',
      quantity: product.quantity.toString(),
      alert_threshold: product.alert_threshold.toString(),
      description: product.description || '',
      is_active: product.is_active,
      sale_type: product.sale_type,
      dimension: product.dimension || '',
      surface_par_boite: product.surface_par_boite?.toString() || '',
      prix_m2: product.prix_m2?.toString() || '',
      prix_achat_m2: product.purchase_price?.toString() || '',
      stock_boite: product.stock_boite?.toString() || '',
      diametre: product.diametre || '',
      longueur_barre_ft: product.longueur_barre_ft?.toString() || '',
      bars_per_ton: product.bars_per_ton?.toString() || '',
      prix_par_metre: product.prix_par_metre?.toString() || '',
      prix_par_barre: product.prix_par_barre?.toString() || '',
      stock_barre: product.stock_barre?.toString() || '',
      decimal_autorise: product.decimal_autorise !== false,
      puissance: product.puissance?.toString() || '',
      voltage: product.voltage?.toString() || '',
      capacite: product.capacite?.toString() || '',
      type_energie: product.type_energie || '',
      bloc_type: product.bloc_type || '',
      bloc_poids: product.bloc_poids?.toString() || '',
      vetement_taille: product.vetement_taille || '',
      vetement_genre: product.vetement_genre || '',
      vetement_couleur: product.vetement_couleur || ''
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;

    if (!isAdmin) {
      toast({
        title: "Action non autorisée",
        description: "Seuls les administrateurs peuvent gérer les produits",
        variant: "destructive"
      });
      return;
    }

    // Validation for ceramic products
    if (formData.category === 'ceramique') {
      if (!formData.dimension || !formData.surface_par_boite || !formData.prix_m2 || !formData.prix_achat_m2 || !formData.stock_boite) {
        toast({
          title: "Erreur de validation",
          description: "Veuillez remplir tous les champs obligatoires pour la céramique (incluant prix d'achat)",
          variant: "destructive"
        });
        return;
      }
    }

    // Validation for iron products
    if (formData.category === 'fer') {
      if (!formData.diametre || !formData.longueur_barre_ft || !formData.bars_per_ton || !formData.prix_par_barre || !formData.stock_barre) {
        toast({
          title: "Erreur de validation",
          description: "Veuillez remplir tous les champs obligatoires pour le fer",
          variant: "destructive"
        });
        return;
      }
    }

    // Validation for blocs
    if (formData.category === 'blocs') {
      if (!formData.bloc_type) {
        toast({
          title: "Erreur de validation",
          description: "Veuillez sélectionner le type de bloc",
          variant: "destructive"
        });
        return;
      }
    }

    // Validation for vetements
    if (formData.category === 'vetements') {
      if (!formData.vetement_taille || !formData.vetement_genre || !formData.vetement_couleur) {
        toast({
          title: "Erreur de validation",
          description: "Veuillez remplir tous les champs obligatoires pour les vêtements",
          variant: "destructive"
        });
        return;
      }
    }

    // Validation for energie
    if (formData.category === 'energie') {
      if (!formData.puissance && !formData.voltage && !formData.capacite) {
        toast({
          title: "Erreur de validation",
          description: "Veuillez remplir au moins un champ technique (puissance, voltage ou capacité) pour les produits d'énergie",
          variant: "destructive"
        });
        return;
      }
    }

    // Validation for standard products
    if (formData.category !== 'ceramique' && formData.category !== 'fer') {
      if (!formData.price || !formData.quantity) {
        toast({
          title: "Erreur de validation",
          description: "Veuillez remplir le prix et la quantité",
          variant: "destructive"
        });
        return;
      }
    }

    try {
      const productData: any = {
        name: formData.name,
        category: formData.category,
        unit: formData.unit,
        alert_threshold: parseInt(formData.alert_threshold),
        description: formData.description || null,
        is_active: formData.is_active,
        sale_type: formData.sale_type,
        created_by: user.id,
        decimal_autorise: formData.decimal_autorise,
        puissance: formData.puissance ? parseFloat(formData.puissance) : null,
        voltage: formData.voltage ? parseFloat(formData.voltage) : null,
        capacite: formData.capacite ? parseFloat(formData.capacite) : null,
        type_energie: formData.type_energie || null,
        bloc_type: formData.bloc_type || null,
        bloc_poids: formData.bloc_poids ? parseFloat(formData.bloc_poids) : null,
        vetement_taille: formData.vetement_taille || null,
        vetement_genre: formData.vetement_genre || null,
        vetement_couleur: formData.vetement_couleur || null
      };

      // Map values based on category
      if (formData.category === 'ceramique') {
        // Use ceramic-specific values
        productData.price = parseFloat(formData.prix_m2);
        productData.purchase_price = parseFloat(formData.prix_achat_m2);
        productData.quantity = parseFloat(formData.stock_boite);
        productData.dimension = formData.dimension;
        productData.surface_par_boite = parseFloat(formData.surface_par_boite);
        productData.prix_m2 = parseFloat(formData.prix_m2);
        productData.stock_boite = parseFloat(formData.stock_boite);
      } else if (formData.category === 'fer') {
        // Use iron bar-specific values
        productData.price = parseFloat(formData.prix_par_barre);
        productData.purchase_price = formData.purchase_price ? parseFloat(formData.purchase_price) : parseFloat(formData.prix_par_barre) * 0.7;
        productData.quantity = parseFloat(formData.stock_barre);
        productData.diametre = formData.diametre;
        productData.longueur_barre_ft = parseFloat(formData.longueur_barre_ft);
        productData.bars_per_ton = parseFloat(formData.bars_per_ton);
        productData.prix_par_metre = formData.prix_par_metre ? parseFloat(formData.prix_par_metre) : null;
        productData.prix_par_barre = parseFloat(formData.prix_par_barre);
        productData.stock_barre = parseFloat(formData.stock_barre);
      } else {
        // Use standard values
        productData.price = parseFloat(formData.price);
        productData.purchase_price = formData.purchase_price ? parseFloat(formData.purchase_price) : null;
        productData.quantity = parseFloat(formData.quantity);
      }

      if (editingProduct) {
        // Update existing product
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id);

        if (error) throw error;

        toast({
          title: "Produit mis à jour",
          description: "Le produit a été modifié avec succès"
        });

        // Log the activity
        await (supabase as any).from('activity_logs').insert({
          user_id: user.id,
          action_type: 'product_updated',
          entity_type: 'product',
          entity_id: editingProduct.id,
          description: `Produit "${formData.name}" modifié dans la catégorie ${formData.category}`,
          metadata: {
            product_name: formData.name,
            category: formData.category,
            price: productData.price
          }
        });
      } else {
        // Create new product
        const { data: newProduct, error } = await supabase
          .from('products')
          .insert([productData])
          .select()
          .single();

        if (error) throw error;

        toast({
          title: "Produit créé",
          description: "Le produit a été ajouté avec succès"
        });

        // Log the activity
        await (supabase as any).from('activity_logs').insert({
          user_id: user.id,
          action_type: 'product_added',
          entity_type: 'product',
          entity_id: newProduct.id,
          description: `Nouveau produit "${formData.name}" ajouté dans la catégorie ${formData.category}`,
          metadata: {
            product_name: formData.name,
            category: formData.category,
            price: productData.price
          }
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchProducts();
    } catch (error: any) {
      console.error('Error saving product:', error);
      
      // Check for RLS policy violation
      if (error?.message?.includes('row-level security') || error?.message?.includes('policy')) {
        toast({
          title: "Action réservée aux administrateurs",
          description: "Seuls les administrateurs peuvent gérer les produits",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Erreur",
          description: "Impossible de sauvegarder le produit",
          variant: "destructive"
        });
      }
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    if (!isAdmin) {
      toast({
        title: "Action non autorisée",
        description: "Seuls les administrateurs peuvent supprimer les produits",
        variant: "destructive"
      });
      return;
    }
    
    setDeleteDialog({ open: true, productId: id, productName: name });
  };

  const handleDelete = async () => {
    if (!deleteDialog.productId || !user) return;

    try {
      const productId = deleteDialog.productId;
      const productName = deleteDialog.productName;

      // Check if product is used in any sales
      const { count, error: countError } = await supabase
        .from('sale_items')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', productId);

      if (countError) throw countError;

      if (count && count > 0) {
        // Product is used in sales - deactivate instead
        const { error } = await supabase
          .from('products')
          .update({ is_active: false })
          .eq('id', productId);

        if (error) throw error;

        toast({
          title: "Produit désactivé",
          description: `Ce produit est utilisé dans ${count} vente(s). Il a été désactivé au lieu d'être supprimé.`,
        });

        // Log deactivation
        await (supabase as any).from('activity_logs').insert({
          user_id: user.id,
          action_type: 'product_deactivated',
          entity_type: 'product',
          entity_id: productId,
          description: `Produit "${productName}" désactivé (utilisé dans des ventes)`,
          metadata: { product_name: productName, reason: 'used_in_sales', sales_count: count }
        });
      } else {
        // Product not used - delete permanently
        const { error } = await supabase
          .from('products')
          .delete()
          .eq('id', productId);

        if (error) throw error;

        toast({
          title: "Produit supprimé",
          description: "Le produit a été définitivement supprimé"
        });

        // Log deletion
        await (supabase as any).from('activity_logs').insert({
          user_id: user.id,
          action_type: 'product_deleted',
          entity_type: 'product',
          entity_id: productId,
          description: `Produit "${productName}" supprimé définitivement`,
          metadata: { product_name: productName }
        });
      }

      setDeleteDialog({ open: false, productId: null, productName: '' });
      fetchProducts();
    } catch (error: any) {
      console.error('Error deleting product:', error);
      
      
      if (error?.message?.includes('row-level security') || error?.message?.includes('policy')) {
        toast({
          title: "Action réservée aux administrateurs",
          description: "Seuls les administrateurs peuvent supprimer les produits",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Erreur",
          description: "Impossible de supprimer le produit",
          variant: "destructive"
        });
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Package className="w-8 h-8 text-primary animate-pulse" />
        <span className="ml-2 text-muted-foreground">Chargement...</span>
      </div>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        {!isAdmin && (
          <div className="mb-4 p-3 bg-muted border border-border rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Seuls les administrateurs peuvent ajouter, modifier ou supprimer des produits.
            </p>
          </div>
        )}
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Gestion des Produits
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button 
                className="gap-2" 
                disabled={!isAdmin}
                title={!isAdmin ? "Réservé aux administrateurs" : "Ajouter un nouveau produit"}
              >
                <Plus className="w-4 h-4" />
                Nouveau produit
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingProduct ? 'Modifier le produit' : 'Nouveau produit'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6 pb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nom du produit *</Label>
                    <Input
                      id="name"
                      required
                      autoFocus
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="Nom du produit"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Catégorie *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value: ProductCategory) => {
                        // Auto-set unit based on category
                        let newUnit = formData.unit;
                        if (value === 'ceramique') newUnit = 'm²';
                        else if (value === 'fer') newUnit = 'barre';
                        else if (formData.category === 'ceramique' || formData.category === 'fer') newUnit = 'unité';
                        
                        setFormData({...formData, category: value, unit: newUnit});
                      }}
                    >
                      <SelectTrigger className="pointer-events-auto">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="pointer-events-auto z-[150]">
                        {categories.map(cat => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Info badge based on category */}
                  {formData.category === 'ceramique' && (
                    <div className="col-span-1 sm:col-span-2">
                      <Badge variant="outline" className="text-xs">
                        🏺 Céramique : Le prix et le stock seront basés sur les m² et les boîtes
                      </Badge>
                    </div>
                  )}
                  {formData.category === 'fer' && (
                    <div className="col-span-1 sm:col-span-2">
                      <Badge variant="outline" className="text-xs">
                        🔩 Fer : Le prix par barre sera calculé automatiquement (prix/m × longueur)
                      </Badge>
                    </div>
                  )}
                  {formData.category === 'energie' && (
                    <div className="col-span-1 sm:col-span-2">
                      <Badge variant="outline" className="text-xs">
                        ⚡ Énergie : Ajoutez les spécifications techniques (puissance, voltage, capacité, etc.)
                      </Badge>
                    </div>
                  )}
                  {formData.category === 'blocs' && (
                    <div className="col-span-1 sm:col-span-2">
                      <Badge variant="outline" className="text-xs">
                        🧱 Blocs : Précisez le type de bloc et son poids (optionnel)
                      </Badge>
                    </div>
                  )}
                  {formData.category === 'vetements' && (
                    <div className="col-span-1 sm:col-span-2">
                      <Badge variant="outline" className="text-xs">
                        👕 Vêtements : Précisez la taille, le genre et la couleur
                      </Badge>
                    </div>
                  )}
                  {formData.category !== 'ceramique' && formData.category !== 'fer' && formData.category !== 'energie' && formData.category !== 'blocs' && formData.category !== 'vetements' && (
                    <div className="col-span-1 sm:col-span-2">
                      <Badge variant="outline" className="text-xs">
                        📦 Produit standard : Remplissez le prix unitaire et la quantité en stock
                      </Badge>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="unit">Unité de mesure *</Label>
                    <Input
                      id="unit"
                      required
                      value={formData.unit}
                      onChange={(e) => setFormData({...formData, unit: e.target.value})}
                      placeholder="Ex: m², barre, sac, livre..."
                      disabled={formData.category === 'ceramique' || formData.category === 'fer'}
                      className={formData.category === 'ceramique' || formData.category === 'fer' ? 'bg-muted' : ''}
                    />
                  </div>

                  {/* Show these fields only for non-ceramic and non-iron products */}
                  {formData.category !== 'ceramique' && formData.category !== 'fer' && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="price">Prix de vente (HTG) *</Label>
                        <Input
                          id="price"
                          type="number"
                          step="0.01"
                          required
                          value={formData.price}
                          onChange={(e) => setFormData({...formData, price: e.target.value})}
                          placeholder="0.00 HTG"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="purchase_price">Prix d'achat (HTG)</Label>
                        <Input
                          id="purchase_price"
                          type="number"
                          step="0.01"
                          value={formData.purchase_price}
                          onChange={(e) => setFormData({...formData, purchase_price: e.target.value})}
                          placeholder="0.00 HTG"
                        />
                        <p className="text-xs text-muted-foreground">Coût payé par le magasin (optionnel)</p>
                        {formData.purchase_price && formData.price && (
                          <p className="text-xs font-medium text-success">
                            Bénéfice: {(parseFloat(formData.price) - parseFloat(formData.purchase_price)).toFixed(2)} HTG
                            ({(((parseFloat(formData.price) - parseFloat(formData.purchase_price)) / parseFloat(formData.price)) * 100).toFixed(1)}%)
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="quantity">Quantité *</Label>
                        <Input
                          id="quantity"
                          type="number"
                          step="0.01"
                          required
                          value={formData.quantity}
                          onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                          placeholder="0"
                        />
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="alert_threshold">Seuil d'alerte *</Label>
                    <Input
                      id="alert_threshold"
                      type="number"
                      required
                      value={formData.alert_threshold}
                      onChange={(e) => setFormData({...formData, alert_threshold: e.target.value})}
                      placeholder="10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="is_active">Statut</Label>
                    <Select
                      value={formData.is_active ? 'true' : 'false'}
                      onValueChange={(value) => setFormData({...formData, is_active: value === 'true'})}
                    >
                      <SelectTrigger className="pointer-events-auto">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="pointer-events-auto z-[150]">
                        <SelectItem value="true">Actif</SelectItem>
                        <SelectItem value="false">Inactif</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sale_type">Type de vente *</Label>
                    <Select
                      value={formData.sale_type}
                      onValueChange={(value: 'retail' | 'wholesale') => setFormData({...formData, sale_type: value})}
                    >
                      <SelectTrigger className="pointer-events-auto">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="pointer-events-auto z-[150]">
                        <SelectItem value="retail">Détail</SelectItem>
                        <SelectItem value="wholesale">Gros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Ceramic-specific fields */}
                {formData.category === 'ceramique' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
                    <div className="col-span-1 sm:col-span-2">
                      <h3 className="font-semibold text-sm mb-2">🏺 Configuration Céramique</h3>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dimension">Dimension *</Label>
                      <Input
                        id="dimension"
                        required
                        value={formData.dimension}
                        onChange={(e) => setFormData({...formData, dimension: e.target.value})}
                        placeholder="Ex: 60x60, 40x40"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="surface_par_boite">Surface par boîte (m²) *</Label>
                      <Input
                        id="surface_par_boite"
                        type="number"
                        step="0.01"
                        required
                        value={formData.surface_par_boite}
                        onChange={(e) => setFormData({...formData, surface_par_boite: e.target.value})}
                        placeholder="1.44"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="prix_m2">Prix de vente par m² (HTG) *</Label>
                      <Input
                        id="prix_m2"
                        type="number"
                        step="0.01"
                        required
                        value={formData.prix_m2}
                        onChange={(e) => setFormData({...formData, prix_m2: e.target.value})}
                        placeholder="1200.00"
                      />
                      <p className="text-xs text-muted-foreground">Prix de revente au client</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="prix_achat_m2">Prix d'achat par m² (HTG) *</Label>
                      <Input
                        id="prix_achat_m2"
                        type="number"
                        step="0.01"
                        required
                        value={formData.prix_achat_m2}
                        onChange={(e) => {
                          const prixAchat = e.target.value;
                          setFormData({...formData, prix_achat_m2: prixAchat});
                        }}
                        placeholder="840.00"
                      />
                      <p className="text-xs text-muted-foreground">Coût unitaire payé par le magasin</p>
                      {formData.prix_achat_m2 && formData.prix_m2 && (
                        <p className="text-xs font-medium text-success">
                          Bénéfice: {(parseFloat(formData.prix_m2) - parseFloat(formData.prix_achat_m2)).toFixed(2)} HTG/m²
                          ({(((parseFloat(formData.prix_m2) - parseFloat(formData.prix_achat_m2)) / parseFloat(formData.prix_m2)) * 100).toFixed(1)}%)
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stock_boite">Stock (boîtes) *</Label>
                      <Input
                        id="stock_boite"
                        type="number"
                        step="0.01"
                        required
                        value={formData.stock_boite}
                        onChange={(e) => setFormData({...formData, stock_boite: e.target.value})}
                        placeholder="24"
                      />
                      <p className="text-xs text-muted-foreground">Accepte les décimales</p>
                    </div>
                  </div>
                )}

                {/* Iron bar-specific fields */}
                {formData.category === 'fer' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
                    <div className="col-span-1 sm:col-span-2">
                      <h3 className="font-semibold text-sm mb-2">🔩 Configuration Fer / Acier</h3>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="diametre">Diamètre *</Label>
                      <Select
                        value={formData.diametre}
                        onValueChange={(value) => {
                          // Auto-set bars_per_ton based on diameter
                          let barsPerTon = '';
                          if (value === '1/2"') barsPerTon = '110';
                          else if (value === '3/8"') barsPerTon = '195';
                          else if (value === '1/4"') barsPerTon = '660';
                          setFormData({...formData, diametre: value, bars_per_ton: barsPerTon});
                        }}
                      >
                        <SelectTrigger className="pointer-events-auto">
                          <SelectValue placeholder="Sélectionner le diamètre" />
                        </SelectTrigger>
                        <SelectContent className="pointer-events-auto z-[150]">
                          <SelectItem value='1/2"'>1/2 pouce (110 barres/tonne)</SelectItem>
                          <SelectItem value='3/8"'>3/8 pouce (195 barres/tonne)</SelectItem>
                          <SelectItem value='1/4"'>1/4 pouce (660 barres/tonne)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bars_per_ton">Barres par tonne 🔢</Label>
                      <Input
                        id="bars_per_ton"
                        type="number"
                        value={formData.bars_per_ton}
                        readOnly
                        className="bg-muted cursor-not-allowed"
                        placeholder="Calculé automatiquement"
                      />
                      <p className="text-xs text-muted-foreground">Calculé selon le diamètre</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="longueur_barre_ft">Longueur barre (pieds) *</Label>
                      <Select
                        value={formData.longueur_barre_ft}
                        onValueChange={(value) => setFormData({...formData, longueur_barre_ft: value})}
                      >
                        <SelectTrigger className="pointer-events-auto">
                          <SelectValue placeholder="Sélectionner la longueur" />
                        </SelectTrigger>
                        <SelectContent className="pointer-events-auto z-[150]">
                          <SelectItem value="27">27 ft</SelectItem>
                          <SelectItem value="30">30 ft</SelectItem>
                          <SelectItem value="32">32 ft</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="prix_par_barre">Prix par barre (HTG) *</Label>
                      <Input
                        id="prix_par_barre"
                        type="number"
                        step="0.01"
                        required
                        value={formData.prix_par_barre}
                        onChange={(e) => setFormData({...formData, prix_par_barre: e.target.value})}
                        placeholder="750.00"
                      />
                      <p className="text-xs text-muted-foreground">Prix unitaire d'une barre</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stock_barre">Stock (barres) *</Label>
                      <Input
                        id="stock_barre"
                        type="number"
                        step="0.01"
                        required
                        value={formData.stock_barre}
                        onChange={(e) => setFormData({...formData, stock_barre: e.target.value})}
                        placeholder="50"
                      />
                      <p className="text-xs text-muted-foreground">Accepte les décimales pour les fractions de tonne</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="purchase_price">Prix d'achat par barre (HTG)</Label>
                      <Input
                        id="purchase_price"
                        type="number"
                        step="0.01"
                        value={formData.purchase_price}
                        onChange={(e) => setFormData({...formData, purchase_price: e.target.value})}
                        placeholder="525.00"
                      />
                      <p className="text-xs text-muted-foreground">Coût unitaire payé par le magasin</p>
                    </div>
                  </div>
                )}

                {/* Energy-specific fields */}
                {formData.category === 'energie' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
                    <div className="col-span-1 sm:col-span-2">
                      <h3 className="font-semibold text-sm mb-2">⚡ Configuration Énergie / Solaire</h3>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="type_energie">Type d'énergie</Label>
                      <Select
                        value={formData.type_energie}
                        onValueChange={(value) => setFormData({...formData, type_energie: value})}
                      >
                        <SelectTrigger className="pointer-events-auto">
                          <SelectValue placeholder="Sélectionner le type" />
                        </SelectTrigger>
                        <SelectContent className="pointer-events-auto z-[150]">
                          <SelectItem value="solaire">Solaire</SelectItem>
                          <SelectItem value="batterie">Batterie</SelectItem>
                          <SelectItem value="generateur">Générateur</SelectItem>
                          <SelectItem value="gaz">Gaz</SelectItem>
                          <SelectItem value="essence">Essence</SelectItem>
                          <SelectItem value="diesel">Diesel</SelectItem>
                          <SelectItem value="petrole">Pétrole lampant</SelectItem>
                          <SelectItem value="charbon">Charbon de bois</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="puissance">Puissance (W ou kW)</Label>
                      <Input
                        id="puissance"
                        type="number"
                        step="0.01"
                        value={formData.puissance}
                        onChange={(e) => setFormData({...formData, puissance: e.target.value})}
                        placeholder="Ex: 300 (pour panneaux solaires)"
                      />
                      <p className="text-xs text-muted-foreground">Pour panneaux solaires, générateurs</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="voltage">Voltage (V)</Label>
                      <Input
                        id="voltage"
                        type="number"
                        step="0.1"
                        value={formData.voltage}
                        onChange={(e) => setFormData({...formData, voltage: e.target.value})}
                        placeholder="Ex: 12, 24, 220"
                      />
                      <p className="text-xs text-muted-foreground">Pour batteries, équipements électriques</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="capacite">Capacité</Label>
                      <Input
                        id="capacite"
                        type="number"
                        step="0.01"
                        value={formData.capacite}
                        onChange={(e) => setFormData({...formData, capacite: e.target.value})}
                        placeholder="Ex: 100 (Ah pour batteries, kg pour gaz)"
                      />
                      <p className="text-xs text-muted-foreground">Ah pour batteries, kg pour bonbonnes, litres pour carburants</p>
                    </div>
                  </div>
                )}

                {/* Blocs-specific fields */}
                {formData.category === 'blocs' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
                    <div className="col-span-1 sm:col-span-2">
                      <h3 className="font-semibold text-sm mb-2">🧱 Configuration Blocs</h3>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bloc_type">Type de bloc *</Label>
                      <Select
                        value={formData.bloc_type}
                        onValueChange={(value) => setFormData({...formData, bloc_type: value})}
                      >
                        <SelectTrigger className="pointer-events-auto">
                          <SelectValue placeholder="Sélectionner le type" />
                        </SelectTrigger>
                        <SelectContent className="pointer-events-auto z-[150]">
                          <SelectItem value="4_pouces">Bloc 4"</SelectItem>
                          <SelectItem value="5_pouces">Bloc 5"</SelectItem>
                          <SelectItem value="6_pouces">Bloc 6"</SelectItem>
                          <SelectItem value="20_pouces">Bloc 20"</SelectItem>
                          <SelectItem value="creux">Bloc Creux</SelectItem>
                          <SelectItem value="plein">Bloc Plein</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bloc_poids">Poids (kg) - Optionnel</Label>
                      <Input
                        id="bloc_poids"
                        type="number"
                        step="0.01"
                        value={formData.bloc_poids}
                        onChange={(e) => setFormData({...formData, bloc_poids: e.target.value})}
                        placeholder="Ex: 12.5"
                      />
                      <p className="text-xs text-muted-foreground">Poids approximatif par bloc</p>
                    </div>
                  </div>
                )}

                {/* Vêtements-specific fields */}
                {formData.category === 'vetements' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
                    <div className="col-span-1 sm:col-span-2">
                      <h3 className="font-semibold text-sm mb-2">👕 Configuration Vêtements</h3>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vetement_taille">Taille *</Label>
                      <Select
                        value={formData.vetement_taille}
                        onValueChange={(value) => setFormData({...formData, vetement_taille: value})}
                      >
                        <SelectTrigger className="pointer-events-auto">
                          <SelectValue placeholder="Sélectionner la taille" />
                        </SelectTrigger>
                        <SelectContent className="pointer-events-auto z-[150]">
                          <SelectItem value="S">S</SelectItem>
                          <SelectItem value="M">M</SelectItem>
                          <SelectItem value="L">L</SelectItem>
                          <SelectItem value="XL">XL</SelectItem>
                          <SelectItem value="XXL">XXL</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vetement_genre">Genre *</Label>
                      <Select
                        value={formData.vetement_genre}
                        onValueChange={(value) => setFormData({...formData, vetement_genre: value})}
                      >
                        <SelectTrigger className="pointer-events-auto">
                          <SelectValue placeholder="Sélectionner le genre" />
                        </SelectTrigger>
                        <SelectContent className="pointer-events-auto z-[150]">
                          <SelectItem value="homme">Homme</SelectItem>
                          <SelectItem value="femme">Femme</SelectItem>
                          <SelectItem value="enfant">Enfant</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 col-span-1 sm:col-span-2">
                      <Label htmlFor="vetement_couleur">Couleur *</Label>
                      <Input
                        id="vetement_couleur"
                        type="text"
                        value={formData.vetement_couleur}
                        onChange={(e) => setFormData({...formData, vetement_couleur: e.target.value})}
                        placeholder="Ex: Rouge, Bleu, Noir"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Description du produit (optionnel)"
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" className="min-w-[120px]">
                    {editingProduct ? 'Mettre à jour' : 'Créer le produit'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <div className="relative mt-4">
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
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Unité</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Prix</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Aucun produit trouvé
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {categories.find(c => c.value === product.category)?.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{product.unit}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={product.sale_type === 'retail' ? "default" : "secondary"}>
                        {product.sale_type === 'retail' ? 'Détail' : 'Gros'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-success font-medium">
                      {product.price.toFixed(2)} HTG
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {product.quantity}
                        {product.quantity <= product.alert_threshold && (
                          <AlertCircle className="w-4 h-4 text-warning" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={product.is_active ? "default" : "secondary"}>
                        {product.is_active ? "Actif" : "Inactif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {isAdmin ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(product)}
                            title="Modifier"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteClick(product.id, product.name)}
                            className="hover:bg-destructive hover:text-destructive-foreground"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Admin seulement</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => 
        setDeleteDialog({open, productId: null, productName: ''})
      }>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce produit ?</AlertDialogTitle>
            <AlertDialogDescription>
              Vous êtes sur le point de supprimer <strong>{deleteDialog.productName}</strong>.
              {' '}Si ce produit est utilisé dans des ventes existantes, il sera désactivé au lieu d'être supprimé définitivement.
              {' '}Sinon, cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};