import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Crown, Mail } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  price: number;
  features: string[];
}

const plans: Plan[] = [
  { id: 'basic', name: 'Basic', price: 19, features: ['5 utilisateurs', '200 produits', 'Support email'] },
  { id: 'pro', name: 'Pro', price: 39, features: ['15 utilisateurs', '1000 produits', 'Support prioritaire'] },
  { id: 'premium', name: 'Premium', price: 59, features: ['Utilisateurs illimités', 'Produits illimités', 'Support dédié'] },
];

interface ExpiredScreenProps {
  companyName: string;
  currentPlan: string;
  onLogout: () => void;
}

export const ExpiredScreen = ({ companyName, currentPlan, onLogout }: ExpiredScreenProps) => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-3xl w-full space-y-6">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold">
            {currentPlan === 'trial' ? 'Votre période d\'essai est terminée' : 'Votre abonnement a expiré'}
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            L'accès à <span className="font-semibold">{companyName}</span> est temporairement suspendu. 
            Choisissez un plan pour continuer.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <Card key={plan.id} className={plan.id === 'pro' ? 'border-primary shadow-lg ring-1 ring-primary' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  {plan.id === 'pro' && (
                    <Badge className="bg-primary text-primary-foreground">
                      <Crown className="w-3 h-3 mr-1" />
                      Populaire
                    </Badge>
                  )}
                </div>
                <p className="text-3xl font-bold">${plan.price}<span className="text-sm text-muted-foreground font-normal">/mois</span></p>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-2 text-sm">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button className="w-full" variant={plan.id === 'pro' ? 'default' : 'outline'} disabled>
                  Bientôt disponible
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center space-y-3">
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Mail className="w-4 h-4" />
            Contactez-nous pour activer votre abonnement manuellement
          </p>
          <Button variant="outline" onClick={onLogout}>
            Se déconnecter
          </Button>
        </div>
      </div>
    </div>
  );
};
