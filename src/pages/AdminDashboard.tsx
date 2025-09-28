import { useState, useEffect } from 'react';
import { StatsCard } from '@/components/Dashboard/StatsCard';
import { AdminDashboardCharts } from '@/components/Dashboard/AdminDashboardCharts';
import { ResponsiveDashboardLayout } from '@/components/Layout/ResponsiveDashboardLayout';
import { UserManagementPanel } from '@/components/UserManagement/UserManagementPanel';
import { AdvancedReports } from '@/components/Reports/AdvancedReports';
import { StockAlerts } from '@/components/Notifications/StockAlerts';
import { 
  Package, 
  AlertTriangle, 
  ShoppingCart, 
  DollarSign,
  TrendingUp,
  Calendar
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface DashboardStats {
  totalProducts: number;
  lowStockProducts: number;
  todaySales: number;
  todayRevenue: number;
  weekSales: number;
  weekRevenue: number;
  monthSales: number;
  monthRevenue: number;
  totalRevenue: number;
  salesGrowth: number;
  revenueGrowth: number;
}

const AdminDashboard = () => {
  const [currentSection, setCurrentSection] = useState('dashboard');
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    lowStockProducts: 0,
    todaySales: 0,
    todayRevenue: 0,
    weekSales: 0,
    weekRevenue: 0,
    monthSales: 0,
    monthRevenue: 0,
    totalRevenue: 0,
    salesGrowth: 0,
    revenueGrowth: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Get current date periods
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
      const lastWeekStart = new Date(weekAgo.getTime() - 7 * 24 * 60 * 60 * 1000);
      const lastMonthStart = new Date(monthAgo.getFullYear(), monthAgo.getMonth() - 1, monthAgo.getDate());

      // Fetch products data
      const { data: productsData } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      // Fetch all sales for analytics
      const { data: allSalesData } = await supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false });

      // Calculate product stats
      const totalProducts = productsData?.length || 0;
      const lowStockProducts = productsData?.filter(p => p.quantity <= p.alert_threshold).length || 0;

      // Calculate time-based stats
      const todaySales = allSalesData?.filter(sale => 
        new Date(sale.created_at) >= today
      ) || [];
      
      const weekSales = allSalesData?.filter(sale => 
        new Date(sale.created_at) >= weekAgo
      ) || [];
      
      const monthSales = allSalesData?.filter(sale => 
        new Date(sale.created_at) >= monthAgo
      ) || [];

      const lastWeekSales = allSalesData?.filter(sale => {
        const saleDate = new Date(sale.created_at);
        return saleDate >= lastWeekStart && saleDate < weekAgo;
      }) || [];

      const lastMonthSales = allSalesData?.filter(sale => {
        const saleDate = new Date(sale.created_at);
        return saleDate >= lastMonthStart && saleDate < monthAgo;
      }) || [];

      // Calculate revenues
      const todayRevenue = todaySales.reduce((sum, sale) => sum + sale.total_amount, 0);
      const weekRevenue = weekSales.reduce((sum, sale) => sum + sale.total_amount, 0);
      const monthRevenue = monthSales.reduce((sum, sale) => sum + sale.total_amount, 0);
      const totalRevenue = allSalesData?.reduce((sum, sale) => sum + sale.total_amount, 0) || 0;
      
      const lastWeekRevenue = lastWeekSales.reduce((sum, sale) => sum + sale.total_amount, 0);
      const lastMonthRevenue = lastMonthSales.reduce((sum, sale) => sum + sale.total_amount, 0);

      // Calculate growth percentages
      const salesGrowth = lastWeekSales.length > 0 
        ? ((weekSales.length - lastWeekSales.length) / lastWeekSales.length) * 100 
        : weekSales.length > 0 ? 100 : 0;

      const revenueGrowth = lastMonthRevenue > 0 
        ? ((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
        : monthRevenue > 0 ? 100 : 0;

      setStats({
        totalProducts,
        lowStockProducts,
        todaySales: todaySales.length,
        todayRevenue,
        weekSales: weekSales.length,
        weekRevenue,
        monthSales: monthSales.length,
        monthRevenue,
        totalRevenue,
        salesGrowth: Math.round(salesGrowth * 10) / 10,
        revenueGrowth: Math.round(revenueGrowth * 10) / 10,
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
            {/* Période Stats - 2 cartes par ligne selon l'importance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <StatsCard
                title="Ventes du Jour"
                value={`${stats.todaySales} vente${stats.todaySales > 1 ? 's' : ''}`}
                icon={Calendar}
                change={{
                  value: stats.salesGrowth,
                  isPositive: stats.salesGrowth >= 0,
                  label: 'vs semaine'
                }}
                variant="default"
              />
              <StatsCard
                title="CA du Jour"
                value={`${stats.todayRevenue.toFixed(2)} €`}
                icon={DollarSign}
                change={{
                  value: Math.abs(stats.revenueGrowth),
                  isPositive: stats.revenueGrowth >= 0,
                  label: 'vs mois'
                }}
                variant="success"
              />
            </div>

            {/* Période étendue - 4 cartes */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatsCard
                title="Ventes Semaine"
                value={`${stats.weekSales}`}
                icon={ShoppingCart}
                variant="default"
              />
              <StatsCard
                title="CA Semaine"
                value={`${stats.weekRevenue.toFixed(2)} €`}
                icon={DollarSign}
                variant="success"
              />
              <StatsCard
                title="Ventes Mois"
                value={`${stats.monthSales}`}
                icon={TrendingUp}
                variant="default"
              />
              <StatsCard
                title="CA Mois"
                value={`${stats.monthRevenue.toFixed(2)} €`}
                icon={DollarSign}
                variant="success"
              />
            </div>

            {/* Inventaire et Alertes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <StatsCard
                title="Total Produits"
                value={stats.totalProducts}
                icon={Package}
                variant="default"
              />
              <StatsCard
                title="Alertes Stock"
                value={stats.lowStockProducts}
                icon={AlertTriangle}
                variant={stats.lowStockProducts > 0 ? "warning" : "default"}
              />
            </div>

            {/* Graphiques et Analytics */}
            <AdminDashboardCharts />
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