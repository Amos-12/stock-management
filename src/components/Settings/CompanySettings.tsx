import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Building2, Save, Loader2 } from 'lucide-react';

interface CompanySettings {
  id: string;
  company_name: string;
  company_description: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  tva_rate: number;
  payment_terms: string;
  logo_url?: string;
}

export const CompanySettings = () => {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .limit(1)
        .single();

      if (error) throw error;
      setSettings(data);
    } catch (error) {
      console.error('Error fetching company settings:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les paramètres de l'entreprise",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('company_settings')
        .update({
          company_name: settings.company_name,
          company_description: settings.company_description,
          address: settings.address,
          city: settings.city,
          phone: settings.phone,
          email: settings.email,
          tva_rate: settings.tva_rate,
          payment_terms: settings.payment_terms,
        })
        .eq('id', settings.id);

      if (error) throw error;

      toast({
        title: "Paramètres enregistrés",
        description: "Les paramètres de l'entreprise ont été mis à jour avec succès",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer les paramètres",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!settings) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-muted-foreground">
            Aucun paramètre trouvé
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          <CardTitle>Paramètres de l'entreprise</CardTitle>
        </div>
        <CardDescription>
          Gérer les informations de votre entreprise affichées sur les factures et reçus
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="company_name">Nom de l'entreprise</Label>
            <Input
              id="company_name"
              value={settings.company_name}
              onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
              placeholder="Système Management!"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company_description">Description</Label>
            <Input
              id="company_description"
              value={settings.company_description}
              onChange={(e) => setSettings({ ...settings, company_description: e.target.value })}
              placeholder="Vente de produit alimentaire"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Adresse</Label>
            <Input
              id="address"
              value={settings.address}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              placeholder="123 Rue Principale"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">Ville</Label>
            <Input
              id="city"
              value={settings.city}
              onChange={(e) => setSettings({ ...settings, city: e.target.value })}
              placeholder="Aux Cayes 8110"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Téléphone</Label>
            <Input
              id="phone"
              value={settings.phone}
              onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              placeholder="+509 1234-5678"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={settings.email}
              onChange={(e) => setSettings({ ...settings, email: e.target.value })}
              placeholder="contact@sysmanagement.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tva_rate">Taux de TVA (%)</Label>
            <Input
              id="tva_rate"
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={settings.tva_rate}
              onChange={(e) => setSettings({ ...settings, tva_rate: parseFloat(e.target.value) || 0 })}
              placeholder="10.0"
            />
            <p className="text-xs text-muted-foreground">
              Taux de TVA appliqué sur les factures (ex: 10.0 pour 10%)
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="payment_terms">Conditions de paiement</Label>
          <Textarea
            id="payment_terms"
            value={settings.payment_terms}
            onChange={(e) => setSettings({ ...settings, payment_terms: e.target.value })}
            placeholder="Paiement comptant ou à crédit selon accord"
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            Conditions de paiement affichées sur les factures
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Enregistrer les modifications
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
