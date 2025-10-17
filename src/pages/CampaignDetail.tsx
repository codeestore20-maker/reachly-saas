import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Download, Play, Pause, StopCircle, Edit } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { campaigns } from '@/lib/api';
import { toast } from 'sonner';
import { DetailSkeleton } from '@/components/loading/PageSkeleton';

export default function CampaignDetail() {
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
      const data = await campaigns.get(Number(id));
      setCampaign(data);
    } catch (error) {
      console.error('Error loading campaign:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleStart = async () => {
    try {
      await campaigns.start(Number(id));
      toast.success('Campaign started!');
      loadCampaign();
    } catch (error) {
      toast.error((error as Error).message);
    }
  };
  
  const handlePause = async () => {
    try {
      await campaigns.pause(Number(id));
      toast.success('Campaign paused');
      loadCampaign();
    } catch (error) {
      toast.error((error as Error).message);
    }
  };
  
  const handleStop = async () => {
    if (!confirm('Are you sure you want to stop this campaign?')) return;
    try {
      await campaigns.stop(Number(id));
      toast.success('Campaign stopped');
      loadCampaign();
    } catch (error) {
      toast.error((error as Error).message);
    }
  };
  
  const handleExportCSV = () => {
    if (!campaign || !campaign.targets) return;
    
    // إنشاء CSV
    const headers = ['Username', 'Handle', 'Name', 'Status', 'Attempts', 'Sent At', 'Last Attempt', 'Error Message'];
    const rows = campaign.targets.map((t: any) => [
      t.username,
      t.handle,
      t.name || '',
      t.status,
      t.retry_count || 0,
      t.sent_at || '',
      t.last_attempt_at || '',
      t.error_message || ''
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    // تنزيل الملف
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `campaign-${campaign.id}-targets.csv`;
    link.click();
    
    toast.success('CSV exported successfully!');
  };

  if (loading) {
    return <DetailSkeleton />;
  }

  if (!campaign) {
    return <div className="p-8">Campaign not found</div>;
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate('/campaigns')}>
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
                  console.log('Draft campaign ID from detail:', campaign.id);
                  if (!campaign.id) {
                    console.error('Campaign ID is missing!', campaign);
                    return;
                  }
                  navigate(`/campaigns/wizard?edit=${campaign.id}`);
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
            <p className="text-sm text-muted-foreground">Sent</p>
            <p className="mt-2 text-3xl font-bold text-primary">{campaign.stats_sent}</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Replied</p>
            <p className="mt-2 text-3xl font-bold text-success">{campaign.stats_replied}</p>
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
                {campaign.stats_total > 0 ? ((campaign.stats_sent / campaign.stats_total) * 100).toFixed(1) : 0}%
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-gradient-primary transition-all"
                style={{ width: `${campaign.stats_total > 0 ? (campaign.stats_sent / campaign.stats_total) * 100 : 0}%` }}
              />
            </div>
          </div>
        </Card>

        <Card>
          <div className="border-b border-border p-6">
            <h2 className="text-xl font-semibold text-foreground">Campaign Details</h2>
          </div>
          <div className="grid gap-6 p-6 md:grid-cols-2">
            <div>
              <h3 className="mb-2 font-medium text-foreground">Message Template</h3>
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm text-muted-foreground">{campaign.message_template}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="mb-2 font-medium text-foreground">Pacing & Limits</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Messages per minute:</span>
                    <span className="font-medium text-foreground">{campaign.pacing_per_minute}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Delay range:</span>
                    <span className="font-medium text-foreground">
                      {campaign.pacing_delay_min}s - {campaign.pacing_delay_max}s
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Daily cap:</span>
                    <span className="font-medium text-foreground">{campaign.pacing_daily_cap}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="border-b border-border p-4">
            <h2 className="text-lg font-semibold text-foreground">Target List ({campaign.targets.length})</h2>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Sent At</TableHead>
                <TableHead>Last Attempt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaign.targets.map((target) => (
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
                      target.status === 'replied' ? 'default' :
                      target.status === 'sent' ? 'secondary' :
                      target.status === 'failed' ? 'destructive' :
                      target.status === 'skipped' ? 'outline' :
                      'outline'
                    }>
                      {target.status}
                    </Badge>
                    {target.error_message && (
                      <p className="text-xs text-muted-foreground mt-1">{target.error_message}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    {target.retry_count > 0 ? (
                      <Badge variant="outline">{target.retry_count} {target.retry_count === 1 ? 'attempt' : 'attempts'}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {target.sent_at ? new Date(target.sent_at).toLocaleString() : '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {target.last_attempt_at ? new Date(target.last_attempt_at).toLocaleString() : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}
