import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Package, ArrowRight, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useState } from 'react';
import AdminDashboard from './AdminDashboard';
import SellerDashboard from './SellerDashboard';

const Index = () => {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);

  const handleCreateAdmin = async () => {
    if (!user?.email) return;
    
    try {
      setIsCreatingAdmin(true);
      const { error } = await supabase.rpc('promote_user_to_admin', {
        user_email: user.email
      });

      if (error) throw error;

      toast({
        title: "Compte admin créé",
        description: "Vous êtes maintenant administrateur. Veuillez actualiser la page.",
      });
      
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error('Error creating admin:', error);
      toast({
        title: "Erreur",
        description: "Impossible de créer le compte admin",
        variant: "destructive"
      });
    } finally {
      setIsCreatingAdmin(false);
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-light to-background">
        <div className="text-center">
          <Package className="w-12 h-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Chargement de votre espace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-light to-background p-4">
        <Card className="max-w-md w-full shadow-lg">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Package className="w-12 h-12 text-primary mr-3" />
              <CardTitle className="text-2xl">GF Distribution</CardTitle>
            </div>
            <p className="text-muted-foreground">
              Système de gestion de stock et de vente
            </p>
          </CardHeader>
          <CardContent className="text-center">
            <p className="mb-6">Veuillez vous connecter pour accéder à votre espace de travail.</p>
            <Button 
              onClick={() => navigate('/auth')} 
              variant="hero" 
              className="w-full"
            >
              Se connecter
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Redirect based on user role
  if (profile?.role === 'admin') {
    return <AdminDashboard />;
  } else if (profile?.role === 'seller') {
    return <SellerDashboard />;
  }

  // Fallback for users without a role (shouldn't happen with proper setup)
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-light to-background">
      <Card className="max-w-md w-full shadow-lg">
        <CardHeader className="text-center">
          <CardTitle>Configuration en cours</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="mb-4">Votre compte est en cours de configuration...</p>
          <div className="space-y-2">
            <Button onClick={() => window.location.reload()} variant="outline" className="w-full">
              Actualiser
            </Button>
            <Button 
              onClick={handleCreateAdmin} 
              variant="default" 
              className="w-full"
              disabled={isCreatingAdmin}
            >
              <Shield className="w-4 h-4 mr-2" />
              {isCreatingAdmin ? 'Création...' : 'Créer le compte admin'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
