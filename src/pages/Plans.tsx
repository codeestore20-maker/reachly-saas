import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Sparkles } from 'lucide-react';
import { subscription } from '@/lib/api';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

export default function Plans() {
  const [plans, setPlans] = useState<any[]>([]);
  const [currentPlan, setCurrentPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const [plansData, subData] = await Promise.all([
        subscription.getPlans(),
        subscription.get().catch(() => null)
      ]);
      setPlans(plansData);
      setCurrentPlan(subData);
    } catch (error) {
      console.error('Error loading plans:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <Skeleton className="h-12 w-64 mx-auto" />
          <Skeleton className="h-6 w-96 mx-auto" />
          <div className="grid gap-6 md:grid-cols-3 mt-12">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="p-8">
                <Skeleton className="h-8 w-32 mb-4" />
                <Skeleton className="h-16 w-full mb-6" />
                <div className="space-y-3">
                  {[...Array(6)].map((_, j) => (
                    <Skeleton key={j} className="h-6 w-full" />
                  ))}
                </div>
                <Skeleton className="h-12 w-full mt-8" />
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold text-foreground">Choose Your Plan</h1>
          <p className="text-xl text-muted-foreground">
            Scale your outreach with the perfect plan for your needs
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = currentPlan?.plan_id === plan.id;
            const isRecommended = plan.name === 'Starter';
            
            return (
              <Card
                key={plan.id}
                className={`relative p-8 shadow-lg transition-all hover:shadow-xl ${
                  isRecommended ? 'border-2 border-primary' : ''
                }`}
              >
                {isRecommended && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-primary">
                    <Sparkles className="mr-1 h-3 w-3" />
                    Recommended
                  </Badge>
                )}
                {isCurrent && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-success">
                    Current Plan
                  </Badge>
                )}

                <div className="mb-6 text-center">
                  <h3 className="mb-2 text-2xl font-bold text-foreground">{plan.name}</h3>
                  <div className="mb-2 flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold text-foreground">${plan.price}</span>
                    <span className="text-muted-foreground">per month</span>
                  </div>
                </div>

                <ul className="mb-8 space-y-4">
                  <li className="flex items-start gap-3">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-success/20">
                      <Check className="h-3 w-3 text-success" />
                    </div>
                    <span className="text-sm text-foreground">{plan.max_accounts} connected account{plan.max_accounts > 1 ? 's' : ''}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-success/20">
                      <Check className="h-3 w-3 text-success" />
                    </div>
                    <span className="text-sm text-foreground">{plan.max_dms_per_month} DMs per month</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-success/20">
                      <Check className="h-3 w-3 text-success" />
                    </div>
                    <span className="text-sm text-foreground">{plan.max_follows_per_month} follows per month</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-success/20">
                      <Check className="h-3 w-3 text-success" />
                    </div>
                    <span className="text-sm text-foreground">
                      {plan.max_active_dm_campaigns === 999 ? 'Unlimited' : plan.max_active_dm_campaigns} DM campaign{plan.max_active_dm_campaigns !== 1 ? 's' : ''}
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-success/20">
                      <Check className="h-3 w-3 text-success" />
                    </div>
                    <span className="text-sm text-foreground">
                      {plan.max_active_follow_campaigns === 999 ? 'Unlimited' : plan.max_active_follow_campaigns} follow campaign{plan.max_active_follow_campaigns !== 1 ? 's' : ''}
                    </span>
                  </li>
                </ul>

                <Button
                  className={`w-full ${
                    isRecommended ? 'bg-gradient-primary' : ''
                  }`}
                  variant={isRecommended ? 'default' : 'outline'}
                  disabled
                >
                  {isCurrent ? 'Current Plan' : 'Upgrade'}
                </Button>
              </Card>
            );
          })}
        </div>

        <Card className="bg-gradient-primary p-8 text-center">
          <h2 className="mb-2 text-2xl font-bold text-primary-foreground">
            Need a custom solution?
          </h2>
          <p className="mb-6 text-primary-foreground/90">
            Contact our sales team for enterprise pricing and custom features
          </p>
          <Button variant="secondary" size="lg" disabled>
            Contact Sales
          </Button>
        </Card>
      </div>
    </div>
  );
}
