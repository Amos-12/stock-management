import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Users, UserCheck, Mail, Calendar, Search, UserPlus, RefreshCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface User {
  id: string;
  full_name: string;
  email: string;
  role: 'admin' | 'seller';
  is_active: boolean;
  created_at: string;
}

export const UserManagementPanel = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [emailToPromote, setEmailToPromote] = useState('');
  const [isPromoting, setIsPromoting] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Fetch user roles and statuses
      const { data: userRoles, error } = await supabase
        .from('user_roles')
        .select('user_id, role, is_active');

      if (error) throw error;

      const userIds = userRoles?.map((ur) => ur.user_id) || [];
      if (userIds.length === 0) {
        setUsers([]);
        return;
      }

      // Fetch profiles with emails in a single query
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, created_at')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      const profileMap = new Map(
        (profilesData || []).map((p: any) => [p.user_id, p])
      );

      const usersData = (userRoles || []).map((userRole: any) => {
        const profile = profileMap.get(userRole.user_id);
        return {
          id: userRole.user_id,
          full_name: profile?.full_name || 'Nom non défini',
          email: profile?.email || 'Email non défini',
          role: userRole.role,
          is_active: userRole.is_active,
          created_at: profile?.created_at || new Date().toISOString(),
        };
      });

      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les utilisateurs",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ is_active: !currentStatus })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "Succès",
        description: !currentStatus ? "Vendeur activé avec succès" : "Vendeur désactivé"
      });

      fetchUsers();
    } catch (error) {
      console.error('Error toggling user status:', error);
      toast({
        title: "Erreur",
        description: "Impossible de modifier le statut",
        variant: "destructive"
      });
    }
  };

  const handlePromoteToAdmin = async () => {
    if (!emailToPromote.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez saisir une adresse email",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsPromoting(true);
      
      const { data, error } = await supabase.rpc('promote_user_to_admin', {
        user_email: emailToPromote.trim()
      });

      if (error) throw error;

      toast({
        title: "Succès",
        description: "Utilisateur promu administrateur avec succès"
      });

      setEmailToPromote('');
      fetchUsers();
    } catch (error) {
      console.error('Error promoting user:', error);
      toast({
        title: "Erreur",
        description: "Impossible de promouvoir l'utilisateur",
        variant: "destructive"
      });
    } finally {
      setIsPromoting(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalUsers = users.length;
  const adminUsers = users.filter(u => u.role === 'admin').length;
  const sellerUsers = users.filter(u => u.role === 'seller').length;

  if (loading) {
    return (
      <Card className="shadow-lg">
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <Users className="w-8 h-8 text-primary animate-pulse mr-2" />
            <span className="text-muted-foreground">Chargement des utilisateurs...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Utilisateurs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Administrateurs</CardTitle>
            <UserCheck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{adminUsers}</div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendeurs</CardTitle>
            <Users className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{sellerUsers}</div>
          </CardContent>
        </Card>
      </div>

      {/* User Management */}
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Gestion des Utilisateurs
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={fetchUsers} title="Rafraîchir">
                <RefreshCcw className="w-4 h-4" />
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="default" className="bg-primary hover:bg-primary-hover">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Promouvoir Admin
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Promouvoir un utilisateur</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="email" className="text-sm font-medium">
                        Email de l'utilisateur
                      </label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="user@example.com"
                        value={emailToPromote}
                        onChange={(e) => setEmailToPromote(e.target.value)}
                      />
                    </div>
                    <Button 
                      onClick={handlePromoteToAdmin}
                      disabled={isPromoting}
                      className="w-full"
                    >
                      {isPromoting ? 'Promotion...' : 'Promouvoir Admin'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Rechercher par nom ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Users Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead className="hidden sm:table-cell">Email</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="hidden md:table-cell">Créé le</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      <div>
                        <div className="font-medium">{user.full_name}</div>
                        <div className="text-sm text-muted-foreground sm:hidden">
                          {user.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {user.email}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={user.role === 'admin' ? 'default' : 'secondary'}
                        className={user.role === 'admin' ? 'bg-primary' : ''}
                      >
                        {user.role === 'admin' ? 'Admin' : 'Vendeur'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.role === 'seller' ? (
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={user.is_active}
                            onCheckedChange={() => handleToggleActive(user.id, user.is_active)}
                          />
                          <span className="text-sm text-muted-foreground">
                            {user.is_active ? 'Actif' : 'Inactif'}
                          </span>
                        </div>
                      ) : (
                        <Badge variant="outline">Admin</Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4 mr-1" />
                        {new Date(user.created_at).toLocaleDateString('fr-FR')}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Aucun utilisateur trouvé</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};