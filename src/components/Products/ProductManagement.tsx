import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
  prix_par_metre?: number;
  prix_par_barre?: number;
  stock_barre?: number;
  decimal_autorise?: boolean;
}

type ProductCategory = 'alimentaires' | 'boissons' | 'gazeuses' | 'electronique' | 'autres' | 'ceramique' | 'fer' | 'materiaux_de_construction' | 'energie';

export const ProductManagement = () => {
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  const [formData, setFormData] = useState<{
    name: string;
    category: ProductCategory;
    unit: string;
    price: string;
    quantity: string;
    alert_threshold: string;
    description: string;
    is_active: boolean;
    sale_type: 'retail' | 'wholesale';
    dimension: string;
    surface_par_boite: string;
    prix_m2: string;
    stock_boite: string;
    diametre: string;
    longueur_barre: string;
    prix_par_metre: string;
    prix_par_barre: string;
    stock_barre: string;
    decimal_autorise: boolean;
  }>({
    name: '',
    category: 'alimentaires',
    unit: 'unité',
    price: '',
    quantity: '',
    alert_threshold: '10',
    description: '',
    is_active: true,
    sale_type: 'retail',
    dimension: '',
    surface_par_boite: '',
    prix_m2: '',
    stock_boite: '',
    diametre: '',
    longueur_barre: '12',
    prix_par_metre: '',
    prix_par_barre: '',
    stock_barre: '',
    decimal_autorise: true
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
      quantity: '',
      alert_threshold: '10',
      description: '',
      is_active: true,
      sale_type: 'retail',
      dimension: '',
      surface_par_boite: '',
      prix_m2: '',
      stock_boite: '',
      diametre: '',
      longueur_barre: '12',
      prix_par_metre: '',
      prix_par_barre: '',
      stock_barre: '',
      decimal_autorise: true
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
      quantity: product.quantity.toString(),
      alert_threshold: product.alert_threshold.toString(),
      description: product.description || '',
      is_active: product.is_active,
      sale_type: product.sale_type,
      dimension: product.dimension || '',
      surface_par_boite: product.surface_par_boite?.toString() || '',
      prix_m2: product.prix_m2?.toString() || '',
      stock_boite: product.stock_boite?.toString() || '',
      diametre: product.diametre || '',
      longueur_barre: product.longueur_barre?.toString() || '12',
      prix_par_metre: product.prix_par_metre?.toString() || '',
      prix_par_barre: product.prix_par_barre?.toString() || '',
      stock_barre: product.stock_barre?.toString() || '',
      decimal_autorise: product.decimal_autorise !== false
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
      if (!formData.dimension || !formData.surface_par_boite || !formData.prix_m2 || !formData.stock_boite) {
        toast({
          title: "Erreur de validation",
          description: "Veuillez remplir tous les champs obligatoires pour la céramique",
          variant: "destructive"
        });
        return;
      }
    }

    // Validation for iron products
    if (formData.category === 'fer') {
      if (!formData.diametre || !formData.longueur_barre || !formData.prix_par_metre || !formData.stock_barre) {
        toast({
          title: "Erreur de validation",
          description: "Veuillez remplir tous les champs obligatoires pour le fer",
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
        decimal_autorise: formData.decimal_autorise
      };

      // Map values based on category
      if (formData.category === 'ceramique') {
        // Use ceramic-specific values
        productData.price = parseFloat(formData.prix_m2);
        productData.quantity = parseInt(formData.stock_boite);
        productData.dimension = formData.dimension;
        productData.surface_par_boite = parseFloat(formData.surface_par_boite);
        productData.prix_m2 = parseFloat(formData.prix_m2);
        productData.stock_boite = parseInt(formData.stock_boite);
      } else if (formData.category === 'fer') {
        // Use iron bar-specific values
        productData.price = parseFloat(formData.prix_par_barre);
        productData.quantity = parseInt(formData.stock_barre);
        productData.diametre = formData.diametre;
        productData.longueur_barre = parseFloat(formData.longueur_barre);
        productData.prix_par_metre = parseFloat(formData.prix_par_metre);
        productData.prix_par_barre = parseFloat(formData.prix_par_barre);
        productData.stock_barre = parseInt(formData.stock_barre);
      } else {
        // Use standard values
        productData.price = parseFloat(formData.price);
        productData.quantity = parseInt(formData.quantity);
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
      } else {
        // Create new product
        const { error } = await supabase
          .from('products')
          .insert([productData]);

        if (error) throw error;

        toast({
          title: "Produit créé",
          description: "Le produit a été ajouté avec succès"
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

  const handleDelete = async (id: string) => {
    if (!isAdmin) {
      toast({
        title: "Action non autorisée",
        description: "Seuls les administrateurs peuvent supprimer les produits",
        variant: "destructive"
      });
      return;
    }
    
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Produit supprimé",
        description: "Le produit a été supprimé avec succès"
      });

      fetchProducts();
    } catch (error: any) {
      console.error('Error deleting product:', error);
      
      // Check for RLS policy violation
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
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
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
                  {formData.category !== 'ceramique' && formData.category !== 'fer' && (
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
                        <Label htmlFor="price">Prix (HTG) *</Label>
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
                        <Label htmlFor="quantity">Quantité *</Label>
                        <Input
                          id="quantity"
                          type="number"
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
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
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
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
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
                      <Label htmlFor="prix_m2">Prix au m² (HTG) *</Label>
                      <Input
                        id="prix_m2"
                        type="number"
                        step="0.01"
                        required
                        value={formData.prix_m2}
                        onChange={(e) => setFormData({...formData, prix_m2: e.target.value})}
                        placeholder="1200.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stock_boite">Stock (boîtes) *</Label>
                      <Input
                        id="stock_boite"
                        type="number"
                        required
                        value={formData.stock_boite}
                        onChange={(e) => setFormData({...formData, stock_boite: e.target.value})}
                        placeholder="24"
                      />
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
                      <Input
                        id="diametre"
                        required
                        value={formData.diametre}
                        onChange={(e) => setFormData({...formData, diametre: e.target.value})}
                        placeholder="Ex: Ø 3/8&quot;, Ø 1/2&quot;"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="longueur_barre">Longueur barre (m) *</Label>
                      <Input
                        id="longueur_barre"
                        type="number"
                        step="0.01"
                        required
                        value={formData.longueur_barre}
                        onChange={(e) => {
                          const longueur = e.target.value;
                          const prixMetre = parseFloat(formData.prix_par_metre) || 0;
                          const prixBarre = prixMetre && longueur ? (prixMetre * parseFloat(longueur)).toFixed(2) : '';
                          setFormData({
                            ...formData, 
                            longueur_barre: longueur,
                            prix_par_barre: prixBarre
                          });
                        }}
                        placeholder="12"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="prix_par_metre">Prix par mètre (HTG) *</Label>
                      <Input
                        id="prix_par_metre"
                        type="number"
                        step="0.01"
                        required
                        value={formData.prix_par_metre}
                        onChange={(e) => {
                          const prixMetre = e.target.value;
                          const longueur = parseFloat(formData.longueur_barre) || 12;
                          const prixBarre = prixMetre ? (parseFloat(prixMetre) * longueur).toFixed(2) : '';
                          setFormData({
                            ...formData, 
                            prix_par_metre: prixMetre,
                            prix_par_barre: prixBarre
                          });
                        }}
                        placeholder="62.50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="prix_par_barre">Prix par barre (HTG) 🔢</Label>
                      <Input
                        id="prix_par_barre"
                        type="number"
                        step="0.01"
                        value={formData.prix_par_barre}
                        readOnly
                        className="bg-muted cursor-not-allowed"
                        placeholder="Calculé automatiquement"
                      />
                      <p className="text-xs text-muted-foreground">Calculé: Prix/m × Longueur</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stock_barre">Stock (barres) *</Label>
                      <Input
                        id="stock_barre"
                        type="number"
                        required
                        value={formData.stock_barre}
                        onChange={(e) => setFormData({...formData, stock_barre: e.target.value})}
                        placeholder="50"
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
                            onClick={() => handleDelete(product.id)}
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
    </Card>
  );
};