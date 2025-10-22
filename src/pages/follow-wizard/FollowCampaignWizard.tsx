import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, Save, Check } from 'lucide-react';
import { StepBasics } from './StepBasics';
import { StepTargets } from './StepTargets';
import { StepSettings } from './StepSettings';
import { StepReview } from './StepReview';
import { toast } from 'sonner';

export interface FollowCampaignDraft {
  name: string;
  accountId: string;
  targetSource: 'manual' | 'followers';
  manualTargets: string;
  followerUsername: string;
  followerQuantity: number;
  selectedFollowers: any[];
  settings: {
    followsPerMinute: number;
    dailyCap: number;
    randomDelay: boolean;
    autoPauseOnHighFailure: boolean;
  };
}

const steps = [
  { id: 1, name: 'Basics' },
  { id: 2, name: 'Targets' },
  { id: 3, name: 'Settings' },
  { id: 4, name: 'Review' },
];

export default function FollowCampaignWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(!!editId);
  const [draft, setDraft] = useState<FollowCampaignDraft>({
    name: '',
    accountId: '',
    targetSource: 'manual',
    manualTargets: '',
    followerUsername: '',
    followerQuantity: 100,
    selectedFollowers: [],
    settings: {
      followsPerMinute: 3,
      dailyCap: 50,
      randomDelay: true,
      autoPauseOnHighFailure: true,
    },
  });

  useEffect(() => {
    console.log('FollowCampaignWizard editId:', editId);
    if (editId) {
      loadDraft(editId);
    }
  }, [editId]);

  const loadDraft = async (id: string) => {
    try {
      console.log('Loading follow draft with ID:', id);
      const { followCampaigns } = await import('@/lib/api');
      const campaign = await followCampaigns.get(Number(id));
      console.log('Loaded follow campaign:', campaign);
      
      setDraft({
        name: campaign.name || '',
        accountId: campaign.account_id?.toString() || '',
        targetSource: campaign.target_source || 'manual',
        manualTargets: '',
        followerUsername: '',
        followerQuantity: 100,
        selectedFollowers: campaign.targets || [],
        settings: {
          followsPerMinute: campaign.pacing_per_minute || 3,
          dailyCap: campaign.pacing_daily_cap || 50,
          randomDelay: true,
          autoPauseOnHighFailure: true,
        },
      });
      toast.success('Draft loaded successfully!');
    } catch (error) {
      console.error('Error loading draft:', error);
      toast.error('Failed to load draft');
    } finally {
      setLoading(false);
    }
  };

  const updateDraft = (updates: Partial<FollowCampaignDraft>) => {
    setDraft(prev => ({ ...prev, ...updates }));
  };

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSaveDraft = async () => {
    try {
      const { followCampaigns } = await import('@/lib/api');
      const draftData = {
        name: draft.name || 'Untitled Follow Campaign',
        accountId: draft.accountId,
        targetSource: draft.targetSource,
        manualTargets: draft.manualTargets,
        selectedFollowers: draft.selectedFollowers,
        pacing: {
          perMinute: draft.settings.followsPerMinute,
          delayMin: 15,
          delayMax: 30,
          dailyCap: draft.settings.dailyCap,
          retryAttempts: 2
        },
        isDraft: true // Save as draft
      };
      
      let savedCampaign;
      if (editId) {
        savedCampaign = await followCampaigns.update(Number(editId), draftData);
        toast.success('Draft updated successfully!');
      } else {
        savedCampaign = await followCampaigns.create(draftData);
        toast.success('Draft saved successfully!');
      }
      console.log('Saved campaign:', savedCampaign);
      localStorage.removeItem('follow_campaign_draft');
      navigate('/follow-campaigns');
    } catch (error) {
      console.error('Error saving draft:', error);
      toast.error('Failed to save draft');
    }
  };

  const progress = (currentStep / 4) * 100;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate('/follow-campaigns')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">
              Create Follow Campaign - Step {currentStep}: {steps[currentStep - 1].name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {currentStep === 1 && 'Set up basic campaign information'}
              {currentStep === 2 && 'Choose your target audience'}
              {currentStep === 3 && 'Configure pacing and limits'}
              {currentStep === 4 && 'Review and launch'}
              <span className="ml-2 text-xs opacity-50">• Tip: Press Ctrl+S to save draft</span>
            </p>
          </div>
          <Button variant="outline" onClick={handleSaveDraft} className="gap-2">
            <Save className="h-4 w-4" />
            Save Draft
          </Button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            {steps.map((step, idx) => (
              <div key={step.id} className="flex items-center">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full border-2 font-semibold transition-colors ${
                      currentStep === step.id
                        ? 'border-primary bg-primary text-primary-foreground'
                        : currentStep > step.id
                        ? 'border-success bg-success text-success-foreground'
                        : 'border-muted bg-background text-muted-foreground'
                    }`}
                  >
                    {step.id}
                  </div>
                  <span
                    className={`hidden text-sm font-medium md:block ${
                      currentStep >= step.id ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {step.name}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div className="mx-4 h-0.5 w-12 bg-muted md:w-16" />
                )}
              </div>
            ))}
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <Card className="p-8 shadow-lg">
          {currentStep === 1 && <StepBasics draft={draft} updateDraft={updateDraft} onNext={handleNext} />}
          {currentStep === 2 && <StepTargets draft={draft} updateDraft={updateDraft} onNext={handleNext} onBack={handleBack} />}
          {currentStep === 3 && <StepSettings draft={draft} updateDraft={updateDraft} onNext={handleNext} onBack={handleBack} />}
          {currentStep === 4 && <StepReview draft={draft} onBack={handleBack} />}
        </Card>
      </div>
    </div>
  );
}
