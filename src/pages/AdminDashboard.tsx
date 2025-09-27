import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ResponsiveDashboardLayout } from '@/components/Layout/ResponsiveDashboardLayout';
import { UserManagementPanel } from '@/components/UserManagement/UserManagementPanel';
import { AdvancedReports } from '@/components/Reports/AdvancedReports';
import { StockAlerts } from '@/components/Notifications/StockAlerts';
import { 
  Package, 
  AlertTriangle, 
  ShoppingCart, 
  Users,
  DollarSign,
  TrendingUp
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface DashboardStats {
  totalProducts: number;
  lowStockProducts: number;
  totalSales: number;
  totalRevenue: number;
}

const AdminDashboard = () => {
  const [currentSection, setCurrentSection] = useState('dashboard');
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    lowStockProducts: 0,
    totalSales: 0,
    totalRevenue: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const { data: productsData } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      const { data: salesData } = await supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      const totalProducts = productsData?.length || 0;
      const lowStockProducts = productsData?.filter(p => p.quantity <= p.alert_threshold).length || 0;
      const totalSales = salesData?.length || 0;
      const totalRevenue = salesData?.reduce((sum, sale) => sum + sale.total_amount, 0) || 0;

      setStats({
        totalProducts,
        lowStockProducts,
        totalSales,
        totalRevenue
      });

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const renderCurrentSection = () => {
    switch (currentSection) {
      case 'users':
        return <UserManagementPanel />;
      case 'reports':
        return <AdvancedReports />;
      case 'notifications':
        return <StockAlerts />;
      default:
        return (
          <div className="space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Produits</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalProducts}</div>
                </CardContent>
              </Card>

              <Card className="shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Stock Faible</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-warning" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-warning">{stats.lowStockProducts}</div>
                </CardContent>
              </Card>

              <Card className="shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Ventes Totales</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalSales}</div>
                </CardContent>
              </Card>

              <Card className="shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Chiffre d'Affaires</CardTitle>
                  <DollarSign className="h-4 w-4 text-success" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-success">
                    {stats.totalRevenue.toFixed(2)} €
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Button
                onClick={() => setCurrentSection('products')}
                variant="outline"
                className="h-20 flex flex-col items-center justify-center hover:bg-primary/10"
              >
                <Package className="w-6 h-6 mb-2" />
                Gérer Produits
              </Button>
              <Button
                onClick={() => setCurrentSection('users')}
                variant="outline"
                className="h-20 flex flex-col items-center justify-center hover:bg-primary/10"
              >
                <Users className="w-6 h-6 mb-2" />
                Utilisateurs
              </Button>
              <Button
                onClick={() => setCurrentSection('reports')}
                variant="outline"
                className="h-20 flex flex-col items-center justify-center hover:bg-primary/10"
              >
                <TrendingUp className="w-6 h-6 mb-2" />
                Rapports
              </Button>
              <Button
                onClick={() => setCurrentSection('notifications')}
                variant="outline"
                className="h-20 flex flex-col items-center justify-center hover:bg-primary/10 relative"
              >
                <AlertTriangle className="w-6 h-6 mb-2" />
                Alertes Stock
                {stats.lowStockProducts > 0 && (
                  <span className="absolute -top-1 -right-1 bg-warning text-warning-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {stats.lowStockProducts}
                  </span>
                )}
              </Button>
            </div>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <ResponsiveDashboardLayout 
        title="Dashboard Administrateur" 
        role="admin"
        currentSection={currentSection}
        onSectionChange={setCurrentSection}
      >
        <div className="flex items-center justify-center h-64">
          <Package className="w-8 h-8 text-primary animate-pulse" />
          <span className="ml-2 text-muted-foreground">Chargement...</span>
        </div>
      </ResponsiveDashboardLayout>
    );
  }

  return (
    <ResponsiveDashboardLayout 
      title="Dashboard Administrateur" 
      role="admin"
      currentSection={currentSection}
      onSectionChange={setCurrentSection}
    >
      {renderCurrentSection()}
    </ResponsiveDashboardLayout>
  );
};

export default AdminDashboard;