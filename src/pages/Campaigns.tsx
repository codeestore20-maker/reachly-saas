import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, Play, Pause, StopCircle } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { campaigns as campaignsAPI } from '@/lib/api';

export default function Campaigns() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'active' | 'paused' | 'completed' | 'draft'>('all');
  const [search, setSearch] = useState('');
  const [campaignsList, setCampaignsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadCampaigns();
    
    // Auto-refresh every 5 seconds
    const interval = setInterval(() => {
      loadCampaigns();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []); // Empty dependency array - only run once on mount
  
  const loadCampaigns = async () => {
    try {
      const data = await campaignsAPI.list();
      setCampaignsList(data);
    } catch (error) {
      console.error('Error loading campaigns:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleStart = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await campaignsAPI.start(id);
      loadCampaigns();
    } catch (error) {
      console.error('Error starting campaign:', error);
    }
  };
  
  const handlePause = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await campaignsAPI.pause(id);
      loadCampaigns();
    } catch (error) {
      console.error('Error pausing campaign:', error);
    }
  };
  
  const handleStop = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to stop this campaign?')) return;
    try {
      await campaignsAPI.stop(id);
      loadCampaigns();
    } catch (error) {
      console.error('Error stopping campaign:', error);
    }
  };

  const filteredCampaigns = campaignsList.filter(c => {
    const matchesFilter = filter === 'all' || c.status === filter;
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });
  
  if (loading) {
    return <div className="min-h-screen bg-background p-8"><div className="text-center">Loading...</div></div>;
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Campaigns</h1>
            <p className="text-muted-foreground">Manage your outreach campaigns</p>
          </div>
          <Button onClick={() => navigate('/campaigns/new')} className="bg-gradient-primary">
            <Plus className="mr-2 h-4 w-4" />
            New Campaign
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search campaigns..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="paused">Paused</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="draft">Draft</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid gap-4">
          {filteredCampaigns.map((campaign) => (
            <Card
              key={campaign.id}
              className="cursor-pointer p-6 shadow-md transition-all hover:shadow-lg"
              onClick={() => navigate(`/campaigns/${campaign.id}`)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-semibold text-foreground">{campaign.name}</h3>
                    <Badge variant={
                      campaign.status === 'active' ? 'default' :
                      campaign.status === 'paused' ? 'secondary' :
                      'outline'
                    }>
                      {campaign.status}
                    </Badge>
                    {campaign.tags && JSON.parse(campaign.tags).map((tag: string) => (
                      <Badge key={tag} variant="outline">{tag}</Badge>
                    ))}
                  </div>

                  <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    <span>Account: {campaign.account_username}</span>
                    <span>Created: {new Date(campaign.created_at).toLocaleDateString()}</span>
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <p className="text-2xl font-bold text-foreground">{campaign.stats_total}</p>
                      <p className="text-xs text-muted-foreground">Total Targets</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-primary">{campaign.stats_sent}</p>
                      <p className="text-xs text-muted-foreground">Sent</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-success">{campaign.stats_replied}</p>
                      <p className="text-xs text-muted-foreground">Replied</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-destructive">{campaign.stats_failed}</p>
                      <p className="text-xs text-muted-foreground">Failed</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium text-foreground">
                        {campaign.stats_total > 0 ? ((campaign.stats_sent / campaign.stats_total) * 100).toFixed(0) : 0}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-gradient-primary transition-all"
                        style={{ width: `${campaign.stats_total > 0 ? (campaign.stats_sent / campaign.stats_total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2 ml-4">
                  {campaign.status !== 'active' && campaign.status !== 'completed' && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={(e) => handleStart(campaign.id, e)}
                      title="Start campaign"
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Start
                    </Button>
                  )}
                  {campaign.status === 'active' && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={(e) => handlePause(campaign.id, e)}
                      title="Pause campaign"
                    >
                      <Pause className="h-3 w-3 mr-1" />
                      Pause
                    </Button>
                  )}
                  {campaign.status !== 'completed' && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={(e) => handleStop(campaign.id, e)}
                      title="Stop campaign"
                    >
                      <StopCircle className="h-3 w-3 mr-1" />
                      Stop
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}

          {filteredCampaigns.length === 0 && (
            <Card className="p-12 text-center">
              <div className="mx-auto max-w-sm space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Filter className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">No campaigns found</h3>
                <p className="text-muted-foreground">
                  {search ? 'Try adjusting your search' : 'Create your first campaign to get started'}
                </p>
                {!search && (
                  <Button onClick={() => navigate('/campaigns/new')} className="bg-gradient-primary">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Campaign
                  </Button>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
