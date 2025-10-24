import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { User, Mail, Phone, Save, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const Profile = () => {
  const { user, profile, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: ''
  });
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [pwdLoading, setPwdLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/auth');
      return;
    }

    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        phone: profile.phone || ''
      });
    }
  }, [user, profile, navigate, authLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          phone: formData.phone
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Profil mis à jour",
        description: "Vos informations ont été modifiées avec succès"
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le profil",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async () => {
    if (!user) return;
    if (!passwordData.newPassword || passwordData.newPassword.length < 6) {
      toast({
        title: 'Mot de passe trop court',
        description: 'Minimum 6 caractères',
        variant: 'destructive'
      });
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: 'Confirmation invalide',
        description: 'Les mots de passe ne correspondent pas',
        variant: 'destructive'
      });
      return;
    }

    setPwdLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordData.newPassword });
      if (error) throw error;

      // Log password update
      await (supabase as any).from('activity_logs').insert({
        user_id: user.id,
        action_type: 'user_update_password',
        entity_type: 'auth',
        description: `Mot de passe modifié`,
        metadata: { email: user.email }
      });

      toast({
        title: 'Mot de passe mis à jour',
        description: 'Votre mot de passe a été modifié avec succès'
      });
      setPasswordData({ newPassword: '', confirmPassword: '' });
    } catch (error) {
      console.error('Error updating password:', error);
      toast({
        title: 'Erreur',
        description: "Impossible de mettre à jour le mot de passe",
        variant: 'destructive'
      });
    } finally {
      setPwdLoading(false);
    }
  };

  const handleBack = () => {
    if (role === 'admin') {
      navigate('/admin');
    } else {
      navigate('/seller');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-light via-background to-secondary p-4 sm:p-8">
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Mon Profil
              </CardTitle>
              <Badge variant={role === 'admin' ? 'default' : 'secondary'}>
                {role === 'admin' ? 'Administrateur' : 'Vendeur'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email (read-only) */}
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  L'email ne peut pas être modifié
                </p>
              </div>

              {/* Full Name */}
              <div className="space-y-2">
                <Label htmlFor="full_name" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Nom Complet
                </Label>
                <Input
                  id="full_name"
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Votre nom complet"
                  required
                />
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Téléphone
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Votre numéro de téléphone"
                />
              </div>

              {/* Changer le mot de passe */}
              <div className="space-y-2 border-t pt-4">
                <Label htmlFor="new_password" className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Nouveau mot de passe
                </Label>
                <Input
                  id="new_password"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  placeholder="******"
                />
                <Label htmlFor="confirm_password" className="sr-only">Confirmer le mot de passe</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  placeholder="Confirmer le mot de passe"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePasswordUpdate}
                  disabled={pwdLoading}
                  className="w-full sm:w-auto"
                >
                  {pwdLoading ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
                </Button>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  className="flex-1"
                >
                  Retour
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 gap-2"
                >
                  <Save className="w-4 h-4" />
                  {loading ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;
