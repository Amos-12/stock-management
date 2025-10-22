import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShoppingCart, Search, TrendingUp, Calendar, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { SaleDetailsDialog } from './SaleDetailsDialog';

interface Sale {
  id: string;
  customer_name?: string;
  total_amount: number;
  payment_method: string;
  created_at: string;
  seller_id: string;
  profiles?: {
    full_name: string;
  };
}

export const SalesManagement = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [filteredSales, setFilteredSales] = useState<Sale[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchSales();
  }, []);

  useEffect(() => {
    const filtered = sales.filter(sale =>
      sale.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredSales(filtered);
  }, [searchTerm, sales]);

  const fetchSales = async () => {
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch seller names separately
      const salesWithSellers = await Promise.all(
        (data || []).map(async (sale) => {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', sale.seller_id)
            .single();
          
          return {
            ...sale,
            profiles: profileData || { full_name: 'N/A' }
          };
        })
      );

      setSales(salesWithSellers as Sale[]);

      // Calculate total revenue
      const total = data?.reduce((sum, sale) => sum + parseFloat(sale.total_amount.toString()), 0) || 0;
      setTotalRevenue(total);

      // Calculate today's revenue
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTotal = data?.filter(sale => {
        const saleDate = new Date(sale.created_at);
        saleDate.setHours(0, 0, 0, 0);
        return saleDate.getTime() === today.getTime();
      }).reduce((sum, sale) => sum + parseFloat(sale.total_amount.toString()), 0) || 0;
      setTodayRevenue(todayTotal);

    } catch (error) {
      console.error('Error fetching sales:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les ventes",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <ShoppingCart className="w-8 h-8 text-primary animate-pulse" />
        <span className="ml-2 text-muted-foreground">Chargement...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total des ventes</p>
                <p className="text-2xl font-bold text-primary">{sales.length}</p>
              </div>
              <ShoppingCart className="w-8 h-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Revenu total</p>
                <p className="text-2xl font-bold text-success">{totalRevenue.toFixed(2)} HTG</p>
              </div>
              <TrendingUp className="w-8 h-8 text-success opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Aujourd'hui</p>
                <p className="text-2xl font-bold text-success">{todayRevenue.toFixed(2)} HTG</p>
              </div>
              <Calendar className="w-8 h-8 text-success opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales Table */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            Historique des Ventes
          </CardTitle>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par client ou vendeur..."
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
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Vendeur</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Paiement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Aucune vente trouvée
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-medium">
                        {formatDate(sale.created_at)}
                      </TableCell>
                      <TableCell>
                        {sale.customer_name || <span className="text-muted-foreground italic">Non renseigné</span>}
                      </TableCell>
                      <TableCell>
                        {sale.profiles?.full_name || <span className="text-muted-foreground italic">N/A</span>}
                      </TableCell>
                      <TableCell className="font-bold text-success">
                        {parseFloat(sale.total_amount.toString()).toFixed(2)} HTG
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {sale.payment_method}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};