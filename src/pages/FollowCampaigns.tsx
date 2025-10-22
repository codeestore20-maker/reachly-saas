import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, Play, Pause, StopCircle, UserPlus, Edit } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CampaignsSkeleton } from '@/components/loading/PageSkeleton';

export default function FollowCampaigns() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'active' | 'paused' | 'completed' | 'draft'>('all');
  const [search, setSearch] = useState('');
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCampaigns();
    
    // Poll every 5 seconds only if there are active campaigns
    const interval = setInterval(() => {
      loadCampaigns();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []); // Empty dependency array - only run once on mount
  
  const loadCampaigns = async () => {
    try {
      const { followCampaigns } = await import('@/lib/api');
      const data = await followCampaigns.list();
      setCampaigns(data);
    } catch (error) {
      console.error('Error loading follow campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCampaigns = campaigns.filter(c => {
    const matchesFilter = filter === 'all' || c.status === filter;
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleStart = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { followCampaigns } = await import('@/lib/api');
      await followCampaigns.start(id);
      loadCampaigns();
    } catch (error) {
      console.error('Error starting campaign:', error);
    }
  };

  const handlePause = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { followCampaigns } = await import('@/lib/api');
      await followCampaigns.pause(id);
      loadCampaigns();
    } catch (error) {
      console.error('Error pausing campaign:', error);
    }
  };

  const handleStop = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to stop this follow campaign?')) return;
    try {
      const { followCampaigns } = await import('@/lib/api');
      await followCampaigns.stop(id);
      loadCampaigns();
    } catch (error) {
      console.error('Error stopping campaign:', error);
    }
  };
  
  if (loading) {
    return <CampaignsSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Follow Campaigns</h1>
            <p className="text-muted-foreground">
              Automate following targeted Twitter accounts
              <span className="ml-2 text-xs opacity-50">• Auto-refreshing every 5s</span>
            </p>
          </div>
          <Button onClick={() => navigate('/follow-campaigns/new')} className="bg-gradient-primary">
            <Plus className="mr-2 h-4 w-4" />
            New Follow Campaign
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search follow campaigns..."
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

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCampaigns.length === 0 ? (
            <Card className="p-12 text-center md:col-span-2 lg:col-span-3">
              <div className="mx-auto w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <UserPlus className="h-12 w-12 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {search || filter !== 'all' ? 'No campaigns found' : 'No follow campaigns yet'}
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                {search || filter !== 'all' 
                  ? 'Try adjusting your search or filters' 
                  : 'Start your first follow campaign and grow your network automatically'}
              </p>
              {!search && filter === 'all' && (
                <div className="flex gap-3 justify-center">
                  <Button className="bg-gradient-primary" onClick={() => navigate('/follow-campaigns/new')}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Follow Campaign
                  </Button>
                </div>
              )}
            </Card>
          ) : (
            filteredCampaigns.map((campaign) => (
            <Card
              key={campaign.id}
              className="cursor-pointer p-4 shadow-md transition-all hover:shadow-lg flex flex-col"
              onClick={() => navigate(`/follow-campaigns/${campaign.id}`)}
            >
              <div className="space-y-3 flex-1">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-foreground truncate">{campaign.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1">@{campaign.account_username}</p>
                    </div>
                  </div>
                  <Badge 
                    variant={
                      campaign.status === 'active' ? 'default' :
                      campaign.status === 'paused' ? 'secondary' :
                      'outline'
                    }
                    className="shrink-0"
                  >
                    {campaign.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-2 rounded-lg bg-muted/50">
                    <p className="text-lg font-bold text-foreground">{campaign.stats_total}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-primary/10">
                    <p className="text-lg font-bold text-primary">{campaign.stats_followed || 0}</p>
                    <p className="text-xs text-muted-foreground">Followed</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-success/10">
                    <p className="text-lg font-bold text-success">{campaign.stats_followed || 0}</p>
                    <p className="text-xs text-muted-foreground">Success</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-destructive/10">
                    <p className="text-lg font-bold text-destructive">{campaign.stats_failed}</p>
                    <p className="text-xs text-muted-foreground">Failed</p>
                  </div>
                  </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-semibold text-foreground">
                      {campaign.stats_total > 0 ? (((campaign.stats_followed || 0) / campaign.stats_total) * 100).toFixed(0) : 0}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-gradient-primary transition-all duration-500"
                      style={{ width: `${campaign.stats_total > 0 ? ((campaign.stats_followed || 0) / campaign.stats_total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                  {campaign.status === 'draft' ? (
                    <Button 
                      size="sm" 
                      variant="default"
                      className="bg-gradient-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('Draft follow campaign ID:', campaign.id);
                        if (!campaign.id) {
                          console.error('Campaign ID is missing!', campaign);
                          return;
                        }
                        navigate(`/follow-campaigns/wizard?edit=${campaign.id}`);
                      }}
                      title="Continue editing draft"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                  ) : (
                    <>
                      {campaign.status !== 'active' && campaign.status !== 'completed' && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={(e) => handleStart(campaign.id, e)}
                          title="Start campaign"
                        >
                          <Play className="h-3 w-3" />
                        </Button>
                      )}
                      {campaign.status === 'active' && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={(e) => handlePause(campaign.id, e)}
                          title="Pause campaign"
                        >
                          <Pause className="h-3 w-3" />
                        </Button>
                      )}
                      {campaign.status !== 'completed' && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={(e) => handleStop(campaign.id, e)}
                          title="Stop campaign"
                        >
                          <StopCircle className="h-3 w-3" />
                        </Button>
                      )}
                    </>
                  )}
              </div>
            </Card>
          ))
          )}
        </div>
      </div>
    </div>
  );
}
