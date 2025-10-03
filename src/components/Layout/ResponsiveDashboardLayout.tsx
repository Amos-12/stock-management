import { ReactNode, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
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
  PackagePlus
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

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

  const adminNavItems = [
    { icon: Home, label: 'Dashboard', value: 'dashboard' },
    { icon: Package, label: 'Produits', value: 'products' },
    { icon: ShoppingCart, label: 'Ventes', value: 'sales' },
    { icon: Users, label: 'Utilisateurs', value: 'users' },
    { icon: PackagePlus, label: 'Réapprovisionnement', value: 'restock', route: '/restock' },
    { icon: TrendingUp, label: 'Rapports', value: 'reports' },
    { icon: Bell, label: 'Notifications', value: 'notifications' }
  ];

  const sellerNavItems = [
    { icon: Home, label: 'Dashboard', value: 'dashboard' },
    { icon: ShoppingCart, label: 'Nouvelle vente', value: 'sale' },
    { icon: TrendingUp, label: 'Mes ventes', value: 'history' }
  ];

  const navItems = role === 'admin' ? adminNavItems : sellerNavItems;

  const handleNavClick = (value: string, route?: string) => {
    if (route) {
      navigate(route);
    } else {
      onSectionChange?.(value);
    }
    setIsMobileMenuOpen(false);
  };

  const SidebarContent = () => (
    <div className="p-6 space-y-6">
      <div className="text-center border-b border-border pb-4">
        <Package className="w-8 h-8 text-primary mx-auto mb-2" />
        <h2 className="font-semibold text-foreground">{title}</h2>
        <Badge variant={role === 'admin' ? 'default' : 'secondary'} className="mt-2">
          {role === 'admin' ? 'Administrateur' : 'Vendeur'}
        </Badge>
      </div>
      
      <nav className="space-y-2">
        {navItems.map((item: any) => {
          const Icon = item.icon;
          return (
            <Button
              key={item.value}
              variant={currentSection === item.value ? 'default' : 'ghost'}
              className={cn(
                "w-full justify-start transition-smooth",
                currentSection === item.value 
                  ? "bg-primary text-primary-foreground shadow-primary" 
                  : "hover:bg-primary/10 hover:text-primary"
              )}
              onClick={() => handleNavClick(item.value, item.route)}
            >
              <Icon className="w-4 h-4 mr-3" />
              {item.label}
            </Button>
          );
        })}
      </nav>
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
                <Package className="w-8 h-8 text-primary mr-3" />
                <h1 className="text-xl font-bold text-primary hidden sm:block">GF Distribution & Multi-Services</h1>
              </div>
            </div>

            {/* Right side - User info and actions */}
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="hidden sm:flex items-center gap-2 text-sm">
                <User className="w-4 h-4" />
                <span className="font-medium">{profile?.full_name}</span>
              </div>

               <Button 
                variant="ghost" 
                size="icon"
                className="hover:bg-primary/10 relative"
                onClick={() => onSectionChange?.('notifications')}
              >
                <Bell className="w-4 h-4" />
                <span className="absolute -top-1 -right-1 bg-warning text-warning-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  3
                </span>
              </Button>

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
          <aside className="w-64 flex-shrink-0 hidden lg:block bg-white border-r border-border h-[calc(100vh-64px)] sticky top-16">
            <SidebarContent />
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