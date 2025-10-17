import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Play, Pause, StopCircle, Users, UserCheck, UserX, Clock } from 'lucide-react';
import { DetailSkeleton } from '@/components/loading/PageSkeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';

export default function FollowCampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadCampaign();
      const interval = setInterval(loadCampaign, 5000);
      return () => clearInterval(interval);
    }
  }, []); // Only run once on mount

  const loadCampaign = async () => {
    try {
      const { followCampaigns } = await import('@/lib/api');
      const data = await followCampaigns.get(Number(id));
      
      // تحويل settings من database format إلى UI format
      const formattedData = {
        ...data,
        settings: {
          followsPerMinute: data.settings_follows_per_minute,
          dailyCap: data.settings_daily_cap,
          randomDelay: data.settings_random_delay === 1,
          autoPauseOnHighFailure: data.settings_auto_pause === 1,
        }
      };
      
      setCampaign(formattedData);
    } catch (error) {
      console.error('Error loading campaign:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    try {
      const { followCampaigns } = await import('@/lib/api');
      await followCampaigns.start(Number(id));
      toast.success('Follow campaign started!');
      loadCampaign();
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handlePause = async () => {
    try {
      const { followCampaigns } = await import('@/lib/api');
      await followCampaigns.pause(Number(id));
      toast.success('Follow campaign paused');
      loadCampaign();
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleStop = async () => {
    if (!confirm('Are you sure you want to stop this follow campaign?')) return;
    try {
      const { followCampaigns } = await import('@/lib/api');
      await followCampaigns.stop(Number(id));
      toast.success('Follow campaign stopped');
      loadCampaign();
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleExportCSV = () => {
    if (!campaign || !campaign.targets) return;

    const headers = ['Username', 'Handle', 'Name', 'Status', 'Last Attempt', 'Error Message'];
    const rows = campaign.targets.map((t: any) => [
      t.username,
      t.handle,
      t.name || '',
      t.status,
      t.last_attempt_at || '',
      t.error_message || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `follow-campaign-${campaign.id}-targets.csv`;
    link.click();

    toast.success('CSV exported successfully!');
  };

  if (loading) {
    return <DetailSkeleton />;
  }

  if (!campaign) {
    return <div className="p-8">Campaign not found</div>;
  }

  const followedCount = campaign.targets.filter((t: any) => t.status === 'followed').length;
  const pendingCount = campaign.targets.filter((t: any) => t.status === 'pending').length;
  const failedCount = campaign.targets.filter((t: any) => t.status === 'failed').length;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate('/follow-campaigns')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-foreground">{campaign.name}</h1>
              <Badge variant={
                campaign.status === 'active' ? 'default' :
                campaign.status === 'paused' ? 'secondary' :
                'outline'
              }>
                {campaign.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Account: {campaign.account_handle} • Created {new Date(campaign.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportCSV} title="Export targets to CSV">
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            {campaign.status === 'draft' ? (
              <Button 
                variant="default" 
                className="bg-gradient-primary"
                onClick={() => {
                  console.log('Draft follow campaign ID from detail:', campaign.id);
                  if (!campaign.id) {
                    console.error('Campaign ID is missing!', campaign);
                    return;
                  }
                  navigate(`/follow-campaigns/wizard?edit=${campaign.id}`);
                }}
                title="Continue editing draft"
              >
                <Edit className="mr-2 h-4 w-4" />
                Continue Setup
              </Button>
            ) : (
              <>
                {campaign.status !== 'active' && campaign.status !== 'completed' && (
                  <Button variant="outline" size="icon" onClick={handleStart} title="Start campaign">
                    <Play className="h-4 w-4" />
                  </Button>
                )}
                {campaign.status === 'active' && (
                  <Button variant="outline" size="icon" onClick={handlePause} title="Pause campaign">
                    <Pause className="h-4 w-4" />
                  </Button>
                )}
                {campaign.status !== 'completed' && (
                  <Button variant="outline" size="icon" onClick={handleStop} title="Stop campaign">
                    <StopCircle className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-4">
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Total Targets</p>
            <p className="mt-2 text-3xl font-bold text-foreground">{campaign.stats_total}</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Followed</p>
            <p className="mt-2 text-3xl font-bold text-primary">{campaign.stats_followed || 0}</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="mt-2 text-3xl font-bold text-warning">{pendingCount}</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Failed</p>
            <p className="mt-2 text-3xl font-bold text-destructive">{campaign.stats_failed}</p>
          </Card>
        </div>

        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Campaign Progress</span>
              <span className="font-medium text-foreground">
                {campaign.stats_total > 0 ? (((campaign.stats_followed || 0) / campaign.stats_total) * 100).toFixed(1) : 0}%
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-gradient-primary transition-all"
                style={{ width: `${campaign.stats_total > 0 ? ((campaign.stats_followed || 0) / campaign.stats_total) * 100 : 0}%` }}
              />
            </div>
          </div>
        </Card>

        <Card>
          <div className="border-b border-border p-6">
            <h2 className="text-xl font-semibold text-foreground">Campaign Settings</h2>
          </div>
          <div className="grid gap-6 p-6 md:grid-cols-2">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Follows per minute:</span>
                <span className="font-medium text-foreground">{campaign.settings.followsPerMinute}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Daily cap:</span>
                <span className="font-medium text-foreground">{campaign.settings.dailyCap}</span>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Random delays:</span>
                <span className="font-medium text-foreground">
                  {campaign.settings.randomDelay ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Auto-pause:</span>
                <span className="font-medium text-foreground">
                  {campaign.settings.autoPauseOnHighFailure ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="border-b border-border p-6">
            <h2 className="text-xl font-semibold text-foreground">Target List</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Attempt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaign.targets.map((target: any) => (
                <TableRow key={target.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={target.avatar} />
                        <AvatarFallback>{target.name[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-foreground">{target.name}</p>
                        <p className="text-sm text-muted-foreground">{target.handle}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      target.status === 'followed' ? 'default' :
                      target.status === 'failed' ? 'destructive' :
                      'outline'
                    }>
                      {target.status}
                    </Badge>
                    {target.error_message && (
                      <p className="text-xs text-muted-foreground mt-1">{target.error_message}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {target.last_attempt_at ? new Date(target.last_attempt_at).toLocaleString() : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
