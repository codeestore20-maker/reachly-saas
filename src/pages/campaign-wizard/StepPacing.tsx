import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ArrowLeft, ArrowRight, AlertTriangle } from 'lucide-react';
import { CampaignDraft } from './CampaignWizard';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Props {
  draft: CampaignDraft;
  updateDraft: (updates: Partial<CampaignDraft>) => void;
  onNext: () => void;
  onBack: () => void;
}

export const StepPacing = ({ draft, updateDraft, onNext, onBack }: Props) => {
  const updatePacing = (key: string, value: number) => {
    updateDraft({
      pacing: { ...draft.pacing, [key]: value }
    });
  };

  const avgDelay = (draft.pacing.delayMin + draft.pacing.delayMax) / 2;
  const estimatedDailyCap = Math.floor(86400 / avgDelay);
  const showHighPacingWarning = draft.pacing.perMinute > 20 || avgDelay < 10;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Pacing & Limits</h2>
        <p className="text-muted-foreground">Control how messages are sent to avoid spam detection</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Messages per Minute: {draft.pacing.perMinute}</Label>
              <Slider
                value={[draft.pacing.perMinute]}
                onValueChange={([value]) => updatePacing('perMinute', value)}
                min={10}
                max={30}
                step={1}
              />
              <p className="text-xs text-muted-foreground">
                Recommended: 15-20 messages per minute
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="delayMin">Min Delay (seconds)</Label>
                <Input
                  id="delayMin"
                  type="number"
                  value={draft.pacing.delayMin}
                  onChange={(e) => updatePacing('delayMin', parseInt(e.target.value) || 0)}
                  min={5}
                  max={120}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="delayMax">Max Delay (seconds)</Label>
                <Input
                  id="delayMax"
                  type="number"
                  value={draft.pacing.delayMax}
                  onChange={(e) => updatePacing('delayMax', parseInt(e.target.value) || 0)}
                  min={5}
                  max={120}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Random jitter between messages makes sending appear more natural
            </p>
          </div>

          <div className="space-y-2">
            <Label>Retry Attempts: {draft.pacing.retryAttempts}</Label>
            <Slider
              value={[draft.pacing.retryAttempts]}
              onValueChange={([value]) => updatePacing('retryAttempts', value)}
              min={0}
              max={2}
              step={1}
            />
            <p className="text-xs text-muted-foreground">
              Number of retry attempts for failed messages (0 = no retries)
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <Card className="bg-muted p-6">
            <h3 className="mb-4 font-semibold text-foreground">Estimated Timeline</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Messages per minute:</span>
                <span className="font-medium text-foreground">
                  {draft.pacing.perMinute}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Messages per hour:</span>
                <span className="font-medium text-foreground">
                  ~{draft.pacing.perMinute * 60}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estimated daily capacity:</span>
                <span className="font-medium text-foreground">
                  ~{Math.floor((86400 / ((draft.pacing.delayMin + draft.pacing.delayMax) / 2)))} messages
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg. delay:</span>
                <span className="font-medium text-foreground">
                  {Math.round((draft.pacing.delayMin + draft.pacing.delayMax) / 2)}s
                </span>
              </div>
            </div>
          </Card>

          {showHighPacingWarning && (
            <Alert className="border-warning bg-warning/10">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <AlertDescription className="text-sm">
                <strong>High pacing detected:</strong> Sending too many messages too quickly may
                trigger spam filters. Consider reducing your pacing for better deliverability.
              </AlertDescription>
            </Alert>
          )}

          <Card className="border-primary bg-primary/10 p-4">
            <h4 className="mb-2 text-sm font-semibold text-foreground">🛡️ Safety Recommendations</h4>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>• Start with 15 messages/min and 15-30s delays</li>
              <li>• Random delays make sending appear natural</li>
              <li>• Monitor for rate limit errors</li>
              <li>• Adjust based on account age and reputation</li>
            </ul>
          </Card>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button onClick={onNext} className="bg-gradient-primary">
          Review Campaign
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
