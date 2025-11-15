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

  // Calculate actual target count
  const targetCount = draft.selectedFollowers?.length || 0;
  
  // Calculate timing based on delays (this is what actually controls speed)
  const avgDelay = (draft.pacing.delayMin + draft.pacing.delayMax) / 2;
  
  // Messages per minute limit affects how many we can send in a minute
  // But actual speed is controlled by avgDelay
  const messagesPerMinuteByDelay = Math.floor(60 / avgDelay);
  const effectivePerMinute = Math.min(draft.pacing.perMinute, messagesPerMinuteByDelay);
  
  // Calculate actual speed considering both delay and per-minute limit
  // We need to wait either avgDelay OR ensure we don't exceed perMinute
  const effectiveDelay = Math.max(avgDelay, 60 / draft.pacing.perMinute);
  
  // Theoretical capacity (if unlimited targets)
  const theoreticalHourlyCap = Math.floor(3600 / effectiveDelay);
  const theoreticalDailyCap = Math.floor(86400 / effectiveDelay);
  
  // Actual estimates based on target count
  const actualMessagesPerHour = targetCount > 0 ? Math.min(theoreticalHourlyCap, targetCount) : theoreticalHourlyCap;
  
  // Time to complete all targets
  const totalTimeSeconds = targetCount > 0 ? targetCount * effectiveDelay : 0;
  const hoursToComplete = totalTimeSeconds > 0 ? (totalTimeSeconds / 3600).toFixed(1) : 0;
  
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
            {targetCount > 0 ? (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total targets:</span>
                  <span className="font-medium text-foreground">
                    {targetCount} users
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg. delay per message:</span>
                  <span className="font-medium text-foreground">
                    {Math.round(avgDelay)}s
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Messages per hour:</span>
                  <span className="font-medium text-foreground">
                    ~{actualMessagesPerHour}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Time to complete:</span>
                  <span className="font-medium text-foreground">
                    ~{hoursToComplete} hours
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-muted-foreground font-semibold">Campaign will send:</span>
                  <span className="font-bold text-foreground">
                    {targetCount} messages
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg. delay per message:</span>
                  <span className="font-medium text-foreground">
                    {Math.round(avgDelay)}s
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Theoretical capacity/hour:</span>
                  <span className="font-medium text-foreground">
                    ~{Math.floor(3600 / avgDelay)} messages
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Theoretical capacity/day:</span>
                  <span className="font-medium text-foreground">
                    ~{theoreticalDailyCap} messages
                  </span>
                </div>
                <div className="text-xs text-muted-foreground italic mt-2">
                  Add targets in previous step to see actual timeline
                </div>
              </div>
            )}
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
