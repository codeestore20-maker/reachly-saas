import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, Save, Sparkles, Check } from 'lucide-react';
import { StepBasics } from './StepBasics';
import { StepTargets } from './StepTargets';
import { StepMessage } from './StepMessage';
import { StepPacing } from './StepPacing';
import { StepReview } from './StepReview';
import { toast } from 'sonner';

export interface CampaignDraft {
  name: string;
  accountId: string;
  tags: string[];
  targetSource: 'manual' | 'followers';
  manualTargets: string;
  followerUsername: string;
  followerQuantity: number;
  selectedFollowers: any[];
  message: string;
  pacing: {
    perMinute: number;
    delayMin: number;
    delayMax: number;
    dailyCap: number;
    retryAttempts: number;
  };
}

const steps = [
  { id: 1, name: 'Basics' },
  { id: 2, name: 'Targets' },
  { id: 3, name: 'Message' },
  { id: 4, name: 'Pacing' },
  { id: 5, name: 'Review' },
];

export default function CampaignWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(!!editId);
  const [draft, setDraft] = useState<CampaignDraft>({
    name: '',
    accountId: '',
    tags: [],
    targetSource: 'manual',
    manualTargets: '',
    followerUsername: '',
    followerQuantity: 100,
    selectedFollowers: [],
    message: '',
    pacing: {
      perMinute: 3,
      delayMin: 15,
      delayMax: 30,
      dailyCap: 50,
      retryAttempts: 2,
    },
  });

  useEffect(() => {
    console.log('CampaignWizard editId:', editId);
    if (editId) {
      loadDraft(editId);
    }
  }, [editId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 's') {
          e.preventDefault();
          handleSaveDraft();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [draft]);

  const loadDraft = async (id: string) => {
    try {
      console.log('Loading draft with ID:', id);
      const { campaigns } = await import('@/lib/api');
      const campaign = await campaigns.get(Number(id));
      console.log('Loaded campaign:', campaign);
      
      setDraft({
        name: campaign.name || '',
        accountId: campaign.account_id?.toString() || '',
        tags: campaign.tags ? JSON.parse(campaign.tags) : [],
        targetSource: campaign.target_source || 'manual',
        manualTargets: '',
        followerUsername: '',
        followerQuantity: 100,
        selectedFollowers: campaign.targets || [],
        message: campaign.message_template || '',
        pacing: {
          perMinute: campaign.pacing_per_minute || 3,
          delayMin: campaign.pacing_delay_min || 15,
          delayMax: campaign.pacing_delay_max || 30,
          dailyCap: campaign.pacing_daily_cap || 50,
          retryAttempts: campaign.pacing_retry_attempts ?? 0,
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

  const updateDraft = (updates: Partial<CampaignDraft>) => {
    setDraft(prev => ({ ...prev, ...updates }));
  };

  const handleNext = () => {
    if (currentStep < 5) {
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
      const { campaigns } = await import('@/lib/api');
      const draftData = {
        name: draft.name || 'Untitled Campaign',
        accountId: draft.accountId,
        tags: draft.tags,
        targetSource: draft.targetSource,
        manualTargets: draft.manualTargets,
        selectedFollowers: draft.selectedFollowers,
        message: draft.message || 'Draft message',
        pacing: draft.pacing
      };
      
      let savedCampaign;
      if (editId) {
        savedCampaign = await campaigns.update(Number(editId), draftData);
        toast.success('Draft updated successfully!');
      } else {
        savedCampaign = await campaigns.create(draftData);
        toast.success('Draft saved successfully!');
      }
      console.log('Saved campaign:', savedCampaign);
      localStorage.removeItem('campaign_draft');
      navigate('/campaigns');
    } catch (error) {
      console.error('Error saving draft:', error);
      toast.error('Failed to save draft');
    }
  };

  const progress = (currentStep / 5) * 100;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate('/campaigns')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">
              Create Campaign - Step {currentStep}: {steps[currentStep - 1].name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {currentStep === 1 && 'Set up basic campaign information'}
              {currentStep === 2 && 'Choose your target audience'}
              {currentStep === 3 && 'Craft your message'}
              {currentStep === 4 && 'Configure pacing and limits'}
              {currentStep === 5 && 'Review and launch'}
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
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={() => currentStep > step.id && setCurrentStep(step.id)}
                    disabled={currentStep < step.id}
                    className={`flex h-10 w-10 items-center justify-center rounded-full border-2 font-semibold transition-all ${
                      currentStep === step.id
                        ? 'border-primary bg-primary text-primary-foreground scale-110 shadow-lg'
                        : currentStep > step.id
                        ? 'border-success bg-success text-success-foreground cursor-pointer hover:scale-105'
                        : 'border-muted bg-background text-muted-foreground cursor-not-allowed'
                    }`}
                  >
                    {currentStep > step.id ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      step.id
                    )}
                  </button>
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
          {currentStep === 3 && <StepMessage draft={draft} updateDraft={updateDraft} onNext={handleNext} onBack={handleBack} />}
          {currentStep === 4 && <StepPacing draft={draft} updateDraft={updateDraft} onNext={handleNext} onBack={handleBack} />}
          {currentStep === 5 && <StepReview draft={draft} onBack={handleBack} />}
        </Card>
      </div>
    </div>
  );
}
