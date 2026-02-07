import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Building2, UserCheck, Users, ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import logo from '@/assets/logo.png';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const signInSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Min 6 caractères')
});

const createCompanySchema = z.object({
  companyName: z.string().trim().min(2, 'Min 2 caractères').max(100, 'Max 100 caractères'),
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Min 6 caractères'),
  fullName: z.string().trim().min(2, 'Min 2 caractères').max(100, 'Max 100 caractères'),
  phone: z.string().optional()
});

const joinCompanySchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Min 6 caractères'),
  fullName: z.string().trim().min(2, 'Min 2 caractères').max(100, 'Max 100 caractères'),
  phone: z.string().optional()
});

type SignupMode = 'choose' | 'create' | 'join';

const Auth = () => {
  const navigate = useNavigate();
  const { user, loading, signIn, signUp } = useAuth();
  const [activeTab, setActiveTab] = useState('signin');
  const [signupMode, setSignupMode] = useState<SignupMode>('choose');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [resetEmail, setResetEmail] = useState('');
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isResetSubmitting, setIsResetSubmitting] = useState(false);

  const [invitationCode, setInvitationCode] = useState('');
  const [validatedCompany, setValidatedCompany] = useState<{ id: string; name: string } | null>(null);
  const [isValidatingCode, setIsValidatingCode] = useState(false);

  const [signInForm, setSignInForm] = useState({ email: '', password: '' });
  const [createForm, setCreateForm] = useState({ companyName: '', email: '', password: '', fullName: '', phone: '' });
  const [joinForm, setJoinForm] = useState({ email: '', password: '', fullName: '', phone: '' });

  useEffect(() => {
    if (!loading && user) navigate('/');
  }, [user, loading, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    try {
      const data = signInSchema.parse(signInForm);
      setIsSubmitting(true);
      const { error } = await signIn(data.email, data.password);
      if (!error) navigate('/');
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errs: Record<string, string> = {};
        error.errors.forEach((e) => { if (e.path[0]) errs[String(e.path[0])] = e.message; });
        setErrors(errs);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    try {
      const data = createCompanySchema.parse(createForm);
      setIsSubmitting(true);
      const { error } = await signUp(data.email, data.password, data.fullName, data.phone, data.companyName);
      if (!error) {
        toast({
          title: "Entreprise créée !",
          description: "Votre entreprise et compte admin ont été créés. Essai gratuit de 30 jours activé.",
        });
        navigate('/');
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errs: Record<string, string> = {};
        error.errors.forEach((e) => { if (e.path[0]) errs[String(e.path[0])] = e.message; });
        setErrors(errs);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleValidateInvitation = async () => {
    if (!invitationCode.trim()) {
      toast({ title: "Erreur", description: "Veuillez entrer un code d'invitation", variant: "destructive" });
      return;
    }
    setIsValidatingCode(true);
    try {
      const response = await fetch(
        `https://xngppwphedaexwkgfjdv.supabase.co/functions/v1/validate-invitation`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invitation_code: invitationCode.trim() })
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Code invalide");
      setValidatedCompany({ id: result.company_id, name: result.company_name });
      toast({ title: "Code valide !", description: `Vous allez rejoindre ${result.company_name}` });
    } catch (error: any) {
      toast({ title: "Code invalide", description: error.message, variant: "destructive" });
      setValidatedCompany(null);
    } finally {
      setIsValidatingCode(false);
    }
  };

  const handleJoinCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatedCompany) return;
    setErrors({});
    try {
      const data = joinCompanySchema.parse(joinForm);
      setIsSubmitting(true);
      const { error } = await signUp(data.email, data.password, data.fullName, data.phone, undefined, validatedCompany.id);
      if (!error) {
        toast({ title: "Compte créé !", description: "Votre compte nécessite l'approbation d'un administrateur." });
        setActiveTab('signin');
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errs: Record<string, string> = {};
        error.errors.forEach((e) => { if (e.path[0]) errs[String(e.path[0])] = e.message; });
        setErrors(errs);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsResetSubmitting(true);
    try {
      z.string().email().parse(resetEmail);
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      toast({ title: 'Email envoyé', description: 'Vérifiez votre boîte de réception.' });
      setIsResetDialogOpen(false);
      setResetEmail('');
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error instanceof z.ZodError ? 'Email invalide' : (error.message || 'Erreur'),
        variant: 'destructive',
      });
    } finally {
      setIsResetSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <img src={logo} alt="Logo" className="w-14 h-14 object-contain mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 pt-[calc(16px+var(--safe-area-top,0px))] pb-[calc(16px+var(--safe-area-bottom,0px))]">
      <div className="fixed top-0 left-0 right-0 z-[60] bg-background" style={{ height: 'var(--safe-area-top, 0px)' }} />
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <img src={logo} alt="Logo" className="w-24 h-24 object-contain mx-auto mb-3" />
          <h1 className="text-3xl font-bold text-primary">Stock Management</h1>
          <p className="text-muted-foreground">Plateforme SaaS de gestion de stock et ventes</p>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-center">Accéder à la plateforme</CardTitle>
            <CardDescription className="text-center">
              Connectez-vous ou créez votre espace
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(v) => {
              setActiveTab(v);
              setSignupMode('choose');
              setErrors({});
              setValidatedCompany(null);
            }}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin" className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4" />
                  Connexion
                </TabsTrigger>
                <TabsTrigger value="signup" className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Inscription
                </TabsTrigger>
              </TabsList>

              {/* LOGIN TAB */}
              <TabsContent value="signin" className="space-y-4">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="votre@email.com"
                      value={signInForm.email}
                      onChange={(e) => setSignInForm((p) => ({ ...p, email: e.target.value }))}
                      className={errors.email ? 'border-destructive' : ''}
                      required
                    />
                    {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Mot de passe</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="••••••••"
                      value={signInForm.password}
                      onChange={(e) => setSignInForm((p) => ({ ...p, password: e.target.value }))}
                      className={errors.password ? 'border-destructive' : ''}
                      required
                    />
                    {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                  </div>
                  <Button type="submit" className="w-full" disabled={isSubmitting} variant="hero">
                    {isSubmitting ? 'Connexion...' : 'Se connecter'}
                  </Button>
                  <div className="text-center">
                    <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="link" className="text-sm text-muted-foreground hover:text-primary">
                          Mot de passe oublié ?
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
                          <DialogDescription>
                            Nous vous enverrons un lien de réinitialisation.
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handlePasswordReset} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="reset-email">Email</Label>
                            <Input
                              id="reset-email"
                              type="email"
                              placeholder="votre@email.com"
                              value={resetEmail}
                              onChange={(e) => setResetEmail(e.target.value)}
                              required
                            />
                          </div>
                          <Button type="submit" className="w-full" disabled={isResetSubmitting}>
                            {isResetSubmitting ? 'Envoi...' : 'Envoyer le lien'}
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </form>
              </TabsContent>

              {/* SIGNUP TAB */}
              <TabsContent value="signup" className="space-y-4">
                {signupMode === 'choose' && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground text-center">
                      Comment souhaitez-vous commencer ?
                    </p>
                    <Button
                      variant="outline"
                      className="w-full h-auto p-4 flex flex-col items-center gap-2"
                      onClick={() => setSignupMode('create')}
                    >
                      <Building2 className="w-8 h-8 text-primary" />
                      <span className="font-semibold">Créer mon entreprise</span>
                      <span className="text-xs text-muted-foreground">Essai gratuit de 30 jours</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full h-auto p-4 flex flex-col items-center gap-2"
                      onClick={() => setSignupMode('join')}
                    >
                      <Users className="w-8 h-8 text-primary" />
                      <span className="font-semibold">Rejoindre une entreprise</span>
                      <span className="text-xs text-muted-foreground">Avec un code d'invitation</span>
                    </Button>
                  </div>
                )}

                {signupMode === 'create' && (
                  <div className="space-y-4">
                    <Button variant="ghost" size="sm" onClick={() => { setSignupMode('choose'); setErrors({}); }}>
                      <ArrowLeft className="w-4 h-4 mr-1" /> Retour
                    </Button>
                    <div className="bg-primary/5 p-3 rounded-lg text-center">
                      <Building2 className="w-6 h-6 text-primary mx-auto mb-1" />
                      <p className="font-semibold text-sm">Créer votre entreprise</p>
                      <p className="text-xs text-muted-foreground">30 jours d'essai gratuit inclus</p>
                    </div>
                    <form onSubmit={handleCreateCompany} className="space-y-3">
                      <div className="space-y-1">
                        <Label>Nom de l'entreprise *</Label>
                        <Input
                          placeholder="Ma Quincaillerie"
                          value={createForm.companyName}
                          onChange={(e) => setCreateForm((p) => ({ ...p, companyName: e.target.value }))}
                          className={errors.companyName ? 'border-destructive' : ''}
                          required
                        />
                        {errors.companyName && <p className="text-xs text-destructive">{errors.companyName}</p>}
                      </div>
                      <div className="space-y-1">
                        <Label>Votre nom complet *</Label>
                        <Input
                          placeholder="Jean Baptiste"
                          value={createForm.fullName}
                          onChange={(e) => setCreateForm((p) => ({ ...p, fullName: e.target.value }))}
                          className={errors.fullName ? 'border-destructive' : ''}
                          required
                        />
                        {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
                      </div>
                      <div className="space-y-1">
                        <Label>Email *</Label>
                        <Input
                          type="email"
                          placeholder="votre@email.com"
                          value={createForm.email}
                          onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
                          className={errors.email ? 'border-destructive' : ''}
                          required
                        />
                        {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                      </div>
                      <div className="space-y-1">
                        <Label>Téléphone</Label>
                        <Input
                          type="tel"
                          placeholder="+509 XXXX-XXXX"
                          value={createForm.phone}
                          onChange={(e) => setCreateForm((p) => ({ ...p, phone: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Mot de passe *</Label>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          value={createForm.password}
                          onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
                          className={errors.password ? 'border-destructive' : ''}
                          required
                        />
                        {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                      </div>
                      <Button type="submit" className="w-full" disabled={isSubmitting} variant="hero">
                        {isSubmitting ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Création...</>
                        ) : (
                          "Créer mon entreprise"
                        )}
                      </Button>
                    </form>
                  </div>
                )}

                {signupMode === 'join' && (
                  <div className="space-y-4">
                    <Button variant="ghost" size="sm" onClick={() => {
                      setSignupMode('choose');
                      setErrors({});
                      setValidatedCompany(null);
                      setInvitationCode('');
                    }}>
                      <ArrowLeft className="w-4 h-4 mr-1" /> Retour
                    </Button>

                    {!validatedCompany ? (
                      <div className="space-y-4">
                        <div className="bg-primary/5 p-3 rounded-lg text-center">
                          <Users className="w-6 h-6 text-primary mx-auto mb-1" />
                          <p className="font-semibold text-sm">Rejoindre une entreprise</p>
                          <p className="text-xs text-muted-foreground">
                            Entrez le code fourni par votre administrateur
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label>Code d'invitation</Label>
                          <div className="flex gap-2">
                            <Input
                              placeholder="ex: a1b2c3d4"
                              value={invitationCode}
                              onChange={(e) => setInvitationCode(e.target.value)}
                              className="font-mono tracking-wider"
                            />
                            <Button onClick={handleValidateInvitation} disabled={isValidatingCode}>
                              {isValidatingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Vérifier'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-3 rounded-lg flex items-center gap-3">
                          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                          <div>
                            <p className="font-semibold text-sm">Entreprise : {validatedCompany.name}</p>
                            <p className="text-xs text-muted-foreground">Complétez votre inscription ci-dessous</p>
                          </div>
                        </div>
                        <form onSubmit={handleJoinCompany} className="space-y-3">
                          <div className="space-y-1">
                            <Label>Votre nom complet *</Label>
                            <Input
                              placeholder="Jean Baptiste"
                              value={joinForm.fullName}
                              onChange={(e) => setJoinForm((p) => ({ ...p, fullName: e.target.value }))}
                              className={errors.fullName ? 'border-destructive' : ''}
                              required
                            />
                            {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
                          </div>
                          <div className="space-y-1">
                            <Label>Email *</Label>
                            <Input
                              type="email"
                              placeholder="votre@email.com"
                              value={joinForm.email}
                              onChange={(e) => setJoinForm((p) => ({ ...p, email: e.target.value }))}
                              className={errors.email ? 'border-destructive' : ''}
                              required
                            />
                            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                          </div>
                          <div className="space-y-1">
                            <Label>Téléphone</Label>
                            <Input
                              type="tel"
                              placeholder="+509 XXXX-XXXX"
                              value={joinForm.phone}
                              onChange={(e) => setJoinForm((p) => ({ ...p, phone: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Mot de passe *</Label>
                            <Input
                              type="password"
                              placeholder="••••••••"
                              value={joinForm.password}
                              onChange={(e) => setJoinForm((p) => ({ ...p, password: e.target.value }))}
                              className={errors.password ? 'border-destructive' : ''}
                              required
                            />
                            {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                          </div>
                          <div className="bg-muted/30 p-3 rounded-md text-sm text-muted-foreground">
                            <p>⚠️ Votre compte nécessitera l'approbation d'un administrateur.</p>
                          </div>
                          <Button type="submit" className="w-full" disabled={isSubmitting} variant="hero">
                            {isSubmitting ? (
                              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Inscription...</>
                            ) : (
                              "Rejoindre l'entreprise"
                            )}
                          </Button>
                        </form>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
