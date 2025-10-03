import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveDashboardLayout } from '@/components/Layout/ResponsiveDashboardLayout';
import { SellerWorkflow } from '@/components/Seller/SellerWorkflow';
import { SellerDashboardStats } from '@/components/Dashboard/SellerDashboardStats';
import { StockAlerts } from '@/components/Notifications/StockAlerts';
import { ProductManagement } from '@/components/Products/ProductManagement';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  TrendingUp,
  Receipt,
  ShoppingCart,
  Package,
  Home,
  AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Sale {
  id: string;
  customer_name?: string;
  total_amount: number;
  payment_method: string;
  created_at: string;
}

const SellerDashboard = () => {
  const { user, loading: authLoading, role } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [currentSection, setCurrentSection] = useState('dashboard');
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [loadingApproval, setLoadingApproval] = useState(true);

  useEffect(() => {
    if (user && !authLoading) {
      checkApprovalStatus();
      fetchMySales();
    }
  }, [user, authLoading]);

  const checkApprovalStatus = async () => {
    if (!user) return;
    
    try {
      setLoadingApproval(true);
      const { data, error } = await supabase
        .from('user_roles')
        .select('is_active')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setIsApproved(data?.is_active ?? false);
    } catch (error) {
      console.error('Error checking approval status:', error);
      setIsApproved(false);
    } finally {
      setLoadingApproval(false);
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

  const renderContent = () => {
    switch (currentSection) {
      case 'dashboard':
        return <SellerDashboardStats />;
      case 'sale':
        return <SellerWorkflow onSaleComplete={fetchMySales} />;
      case 'products':
        return <ProductManagement />;
      case 'notifications':
        return <StockAlerts />;
      case 'history':
        return (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Mes Dernières Ventes (10 plus récentes)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sales.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Receipt className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Aucune vente enregistrée</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sales.map((sale) => (
                    <div key={sale.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-smooth">
                      <div>
                        <div className="font-medium">
                          {sale.customer_name || 'Client non renseigné'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(sale.created_at).toLocaleString('fr-FR')} • {sale.payment_method}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-success">{sale.total_amount.toFixed(2)} HTG</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      default:
        return <SellerWorkflow onSaleComplete={fetchMySales} />;
    }
  };

  if (authLoading || loadingApproval) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary-light via-background to-secondary">
        <div className="text-center">
          <Package className="w-12 h-12 text-primary animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary-light via-background to-secondary">
        <div className="text-center">
          <p className="text-muted-foreground">Veuillez vous connecter</p>
        </div>
      </div>
    );
  }

  // If seller not approved yet
  if (isApproved === false) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary-light via-background to-secondary p-4">
        <Card className="max-w-md shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-6 h-6 text-warning" />
              Compte en attente d'approbation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                Votre compte vendeur a été créé avec succès, mais il doit être approuvé par un administrateur avant que vous puissiez accéder au tableau de bord.
              </AlertDescription>
            </Alert>
            <p className="text-sm text-muted-foreground">
              Veuillez contacter votre administrateur pour activer votre compte.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <ResponsiveDashboardLayout 
      title="Espace Vendeur" 
      role="seller" 
      currentSection={currentSection} 
      onSectionChange={setCurrentSection}
    >
      <div className="space-y-6">
        {renderContent()}
      </div>
    </ResponsiveDashboardLayout>
  );
};

export default SellerDashboard;
