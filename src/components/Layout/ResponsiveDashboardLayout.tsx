import { ReactNode, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Package, 
  ShoppingCart, 
  Users, 
  TrendingUp, 
  LogOut, 
  Settings,
  Bell,
  User,
  Menu,
  Home,
  PackagePlus,
  ClipboardList
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import logo from '@/assets/logo.png';

interface ResponsiveDashboardLayoutProps {
  children: ReactNode;
  title: string;
  role: 'admin' | 'seller';
  currentSection?: string;
  onSectionChange?: (section: string) => void;
}

export const ResponsiveDashboardLayout = ({ 
  children, 
  title, 
  role, 
  currentSection = 'dashboard',
  onSectionChange 
}: ResponsiveDashboardLayoutProps) => {
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    const fetchCompanySettings = async () => {
      const { data } = await supabase
        .from('company_settings')
        .select('*')
        .single();
      if (data) {
        setCompanySettings(data);
      }
    };
    
    fetchCompanySettings();
  }, []);

  useEffect(() => {
    const fetchNotifications = async () => {
      if (role !== 'admin') return;
      
      try {
        // Count low stock products
        const { data: products } = await supabase
          .from('products')
          .select('id, quantity, alert_threshold')
          .eq('is_active', true);
        
        const lowStockCount = products?.filter(p => p.quantity <= p.alert_threshold).length || 0;
        
        // Count sales from last 24 hours
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count: salesCount } = await supabase
          .from('sales')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', oneDayAgo);
        
        setNotificationCount(lowStockCount + (salesCount || 0));
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }
    };
    
    fetchNotifications();
    
    // Refresh notifications every minute
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [role]);

  const adminNavItems = [
    { icon: Home, label: 'Dashboard', value: 'dashboard' },
    { icon: Package, label: 'Produits', value: 'products' },
    { icon: ShoppingCart, label: 'Ventes', value: 'sales' },
    { icon: Users, label: 'Utilisateurs', value: 'users' },
    { icon: PackagePlus, label: 'Réapprovisionnement', value: 'restock', route: '/restock' },
    { icon: TrendingUp, label: 'Rapports', value: 'reports' },
    { icon: ClipboardList, label: "Logs d'activité", value: 'activity' },
    { icon: Bell, label: 'Notifications', value: 'notifications' },
    { icon: Settings, label: 'Paramètres', value: 'settings' }
  ];

  const sellerNavItems = [
    { icon: Home, label: 'Dashboard', value: 'dashboard' },
    { icon: ShoppingCart, label: 'Nouvelle vente', value: 'sale' },
    { icon: TrendingUp, label: 'Mes ventes', value: 'history' }
  ];

  const navItems = role === 'admin' ? adminNavItems : sellerNavItems;

  const handleNavClick = (value: string, route?: string) => {
    setIsMobileMenuOpen(false);
    if (route) {
      navigate(route);
      return;
    }
    if (onSectionChange) {
      onSectionChange(value);
    } else {
      if (role === 'admin') {
        navigate(`/admin?section=${value}`);
      } else if (role === 'seller') {
        navigate(`/seller?section=${value}`);
      }
    }
  };

  const SidebarContent = ({ isDesktop = false }: { isDesktop?: boolean }) => (
    <div className={cn("h-full flex flex-col", isDesktop && sidebarCollapsed && "")}>
      <div className={cn(
        "border-b border-border pb-4 pt-6 px-6",
        isDesktop && sidebarCollapsed ? "text-center px-3" : "text-center"
      )}>
        {companySettings?.logo_url ? (
          <img 
            src={companySettings.logo_url} 
            alt="Logo" 
            className={cn(
              "object-contain mx-auto mb-2",
              isDesktop && sidebarCollapsed ? "w-10 h-10" : "w-16 h-16"
            )} 
          />
        ) : (
          <img 
            src={logo} 
            alt="Logo" 
            className={cn(
              "object-contain mx-auto mb-2",
              isDesktop && sidebarCollapsed ? "w-10 h-10" : "w-16 h-16"
            )} 
          />
        )}
        {!(isDesktop && sidebarCollapsed) && (
          <>
            <h2 className={cn(
              "font-semibold text-foreground",
              (companySettings?.company_name || title).length > 30 ? "text-sm" : "text-base"
            )}>
              {companySettings?.company_name || title}
            </h2>
            <Badge variant={role === 'admin' ? 'default' : 'secondary'} className="mt-2">
              {role === 'admin' ? 'Administrateur' : 'Vendeur'}
            </Badge>
          </>
        )}
      </div>
      
      <ScrollArea className="flex-1 px-6 py-4">
        <nav className="space-y-2">
          {navItems.map((item: any) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.value}
                variant={currentSection === item.value ? 'default' : 'ghost'}
                className={cn(
                  "w-full transition-smooth",
                  isDesktop && sidebarCollapsed ? "justify-center px-2" : "justify-start",
                  currentSection === item.value 
                    ? "bg-primary text-primary-foreground shadow-primary" 
                    : "hover:bg-primary/10 hover:text-primary"
                )}
                onClick={() => handleNavClick(item.value, item.route)}
                title={isDesktop && sidebarCollapsed ? item.label : undefined}
              >
                <Icon className={cn("w-4 h-4", !(isDesktop && sidebarCollapsed) && "mr-3")} />
                {!(isDesktop && sidebarCollapsed) && item.label}
              </Button>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Toggle Button for Desktop */}
      {isDesktop && (
        <div className="px-6 pb-6 pt-4 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full"
            title={sidebarCollapsed ? 'Étendre le menu' : 'Réduire le menu'}
          >
            {sidebarCollapsed ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
                Réduire
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-light via-background to-secondary">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-border shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left side - Mobile menu button + Logo */}
            <div className="flex items-center">
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden mr-2">
                    <Menu className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80 p-0">
                  <SidebarContent />
                </SheetContent>
              </Sheet>
              
              <div className="flex items-center">
                {companySettings?.logo_url ? (
                  <img 
                    src={companySettings.logo_url} 
                    alt="Logo" 
                    className="w-10 h-10 object-contain mr-3" 
                  />
                ) : (
                  <img 
                    src={logo} 
                    alt="Logo" 
                    className="w-10 h-10 object-contain mr-3" 
                  />
                )}
                <h1 className={cn(
                  "font-bold text-primary hidden sm:block",
                  (companySettings?.company_name || 'GF Distribution & Multi-Services').length > 30 
                    ? "text-lg" 
                    : "text-xl"
                )}>
                  {companySettings?.company_name || 'GF Distribution & Multi-Services'}
                </h1>
              </div>
            </div>

            {/* Right side - User info and actions */}
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="hidden sm:flex items-center gap-2 text-sm">
                <User className="w-4 h-4" />
                <span className="font-medium">{profile?.full_name}</span>
              </div>

              {role === 'admin' && (
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="hover:bg-primary/10 relative"
                  onClick={() => {
                    if (onSectionChange) {
                      onSectionChange('notifications');
                    } else {
                      navigate('/admin?section=notifications');
                    }
                  }}
                >
                  <Bell className="w-4 h-4" />
                  {notificationCount > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                    >
                      {notificationCount > 99 ? '99+' : notificationCount}
                    </Badge>
                  )}
                </Button>
              )}

              <Button 
                variant="ghost" 
                size="icon"
                className="hover:bg-primary/10"
                onClick={() => navigate('/profile')}
                title="Profil"
              >
                <User className="w-4 h-4" />
              </Button>

              <Button 
                variant="outline"
                size="sm"
                onClick={signOut}
                className="hover:bg-destructive hover:text-destructive-foreground transition-smooth"
              >
                <LogOut className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Déconnexion</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        <div className="flex w-full">
          {/* Desktop Sidebar */}
          <aside className={cn(
            "flex-shrink-0 hidden lg:block bg-white border-r border-border h-[calc(100vh-64px)] sticky top-16 transition-all duration-300",
            sidebarCollapsed ? "w-20" : "w-64"
          )}>
            <SidebarContent isDesktop={true} />
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};