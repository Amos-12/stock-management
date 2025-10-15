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

export const ProductManagement = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  const [formData, setFormData] = useState<{
    name: string;
    category: 'alimentaires' | 'boissons' | 'gazeuses' | 'electronique' | 'autres' | 'ceramique' | 'fer';
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
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category: product.category as 'alimentaires' | 'boissons' | 'gazeuses' | 'electronique' | 'autres' | 'ceramique' | 'fer',
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

    try {
      const productData: any = {
        name: formData.name,
        category: formData.category,
        unit: formData.unit,
        price: parseFloat(formData.price),
        quantity: parseInt(formData.quantity),
        alert_threshold: parseInt(formData.alert_threshold),
        description: formData.description || null,
        is_active: formData.is_active,
        sale_type: formData.sale_type,
        created_by: user.id,
        decimal_autorise: formData.decimal_autorise
      };

      // Add ceramic-specific fields
      if (formData.category === 'ceramique') {
        productData.dimension = formData.dimension || null;
        productData.surface_par_boite = formData.surface_par_boite ? parseFloat(formData.surface_par_boite) : null;
        productData.prix_m2 = formData.prix_m2 ? parseFloat(formData.prix_m2) : null;
        productData.stock_boite = formData.stock_boite ? parseInt(formData.stock_boite) : 0;
      }

      // Add iron bar-specific fields
      if (formData.category === 'fer') {
        productData.diametre = formData.diametre || null;
        productData.longueur_barre = formData.longueur_barre ? parseFloat(formData.longueur_barre) : 12;
        productData.prix_par_metre = formData.prix_par_metre ? parseFloat(formData.prix_par_metre) : null;
        productData.prix_par_barre = formData.prix_par_barre ? parseFloat(formData.prix_par_barre) : null;
        productData.stock_barre = formData.stock_barre ? parseInt(formData.stock_barre) : 0;
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
    } catch (error) {
      console.error('Error saving product:', error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder le produit",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string) => {
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
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le produit",
        variant: "destructive"
      });
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
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Nouveau produit
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingProduct ? 'Modifier le produit' : 'Nouveau produit'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nom du produit *</Label>
                    <Input
                      id="name"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="Nom du produit"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Catégorie *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value: 'alimentaires' | 'boissons' | 'gazeuses' | 'electronique' | 'autres') => setFormData({...formData, category: value})}
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
                  <div className="space-y-2">
                    <Label htmlFor="unit">Unité de mesure *</Label>
                    <Input
                      id="unit"
                      required
                      value={formData.unit}
                      onChange={(e) => setFormData({...formData, unit: e.target.value})}
                      placeholder="Ex: m², barre, sac, livre..."
                    />
                  </div>
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
                  <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
                    <div className="col-span-2">
                      <h3 className="font-semibold text-sm mb-2">Configuration Céramique</h3>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dimension">Dimension *</Label>
                      <Input
                        id="dimension"
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
                        value={formData.stock_boite}
                        onChange={(e) => setFormData({...formData, stock_boite: e.target.value})}
                        placeholder="24"
                      />
                    </div>
                  </div>
                )}

                {/* Iron bar-specific fields */}
                {formData.category === 'fer' && (
                  <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
                    <div className="col-span-2">
                      <h3 className="font-semibold text-sm mb-2">Configuration Fer / Acier</h3>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="diametre">Diamètre *</Label>
                      <Input
                        id="diametre"
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
                        value={formData.longueur_barre}
                        onChange={(e) => setFormData({...formData, longueur_barre: e.target.value})}
                        placeholder="12"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="prix_par_metre">Prix par mètre (HTG) *</Label>
                      <Input
                        id="prix_par_metre"
                        type="number"
                        step="0.01"
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
                      <Label htmlFor="prix_par_barre">Prix par barre (HTG)</Label>
                      <Input
                        id="prix_par_barre"
                        type="number"
                        step="0.01"
                        value={formData.prix_par_barre}
                        readOnly
                        className="bg-muted"
                        placeholder="Calculé automatiquement"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stock_barre">Stock (barres) *</Label>
                      <Input
                        id="stock_barre"
                        type="number"
                        value={formData.stock_barre}
                        onChange={(e) => setFormData({...formData, stock_barre: e.target.value})}
                        placeholder="50"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Description du produit"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button type="submit">
                    {editingProduct ? 'Mettre à jour' : 'Créer'}
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
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(product)}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(product.id)}
                          className="hover:bg-destructive hover:text-destructive-foreground"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
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