import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Send, Users, TrendingUp, Target, UserPlus, Settings, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { dashboard, campaigns as campaignsAPI } from '@/lib/api';
import { DashboardSkeleton } from '@/components/loading/PageSkeleton';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>({ totalDMs: 0, activeCampaigns: 0, connectedAccounts: 0, totalTargets: 0 });
  const [recentCampaigns, setRecentCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    try {
      const [statsData, campaignsData] = await Promise.all([
        dashboard.stats(),
        campaignsAPI.list()
      ]);
      setStats(statsData);
      setRecentCampaigns(campaignsData.slice(0, 5));
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return <DashboardSkeleton />;
  }
  
  const totalDMs = stats.totalDMs;
  const activeCampaigns = stats.activeCampaigns;
  const totalAccounts = stats.connectedAccounts;
  const totalTargets = stats.totalTargets;

  const statsDisplay = [
    { label: 'Total DMs Sent', value: totalDMs, icon: Send, color: 'text-primary' },
    { label: 'Active Campaigns', value: activeCampaigns, icon: TrendingUp, color: 'text-success' },
    { label: 'Connected Accounts', value: totalAccounts, icon: Users, color: 'text-warning' },
    { label: 'Total Targets', value: totalTargets, icon: Target, color: 'text-info' },
  ];
  
  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">Welcome back! Here's your outreach overview.</p>
          </div>
          <Button onClick={() => navigate('/campaigns/new')} className="bg-gradient-primary">
            Create Campaign
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statsDisplay.map((stat) => (
            <Card key={stat.label} className="p-4 shadow-md transition-all hover:shadow-lg cursor-pointer">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{stat.value}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Recent Activity */}
          <Card className="shadow-md overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <h2 className="text-base font-semibold text-foreground">Recent Activity</h2>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/campaigns')}
                className="text-xs h-8"
              >
                View All →
              </Button>
            </div>
            <div className="p-3">
              {recentCampaigns.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="mx-auto w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                    <Send className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">No campaigns yet</p>
                  <p className="text-xs text-muted-foreground mb-4">Create your first campaign to get started</p>
                  <Button 
                    size="sm" 
                    className="bg-gradient-primary"
                    onClick={() => navigate('/campaigns/new')}
                  >
                    <Plus className="mr-2 h-3 w-3" />
                    Create Campaign
                  </Button>
                </div>
              ) : (
                <div className="space-y-1">
                  {recentCampaigns.map((campaign) => (
                    <div 
                      key={campaign.id} 
                      className="group flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-all"
                      onClick={() => navigate(`/campaigns/${campaign.id}`)}
                    >
                      <div className={`h-2 w-2 rounded-full shrink-0 ${
                        campaign.status === 'active' ? 'bg-success animate-pulse' : 'bg-muted-foreground/30'
                      }`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                          {campaign.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-muted-foreground">
                            {campaign.stats_sent}/{campaign.stats_total}
                          </p>
                          <span className="text-xs text-muted-foreground">•</span>
                          <Badge 
                            variant={campaign.status === 'active' ? 'default' : campaign.status === 'paused' ? 'secondary' : 'outline'} 
                            className="text-xs h-4 px-1.5"
                          >
                            {campaign.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Quick Actions */}
          <Card className="shadow-md overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Send className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-base font-semibold text-foreground">Quick Actions</h2>
            </div>
            <div className="p-3 space-y-2">
              <button
                onClick={() => navigate('/campaigns/new')}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-all group text-left"
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <Send className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                    Create DM Campaign
                  </p>
                  <p className="text-xs text-muted-foreground">Send direct messages</p>
                </div>
              </button>

              <button
                onClick={() => navigate('/follow-campaigns/new')}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-all group text-left"
              >
                <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center shrink-0 group-hover:bg-success/20 transition-colors">
                  <UserPlus className="h-5 w-5 text-success" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground group-hover:text-success transition-colors">
                    Create Follow Campaign
                  </p>
                  <p className="text-xs text-muted-foreground">Auto-follow users</p>
                </div>
              </button>

              <button
                onClick={() => navigate('/accounts')}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-all group text-left"
              >
                <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center shrink-0 group-hover:bg-warning/20 transition-colors">
                  <Users className="h-5 w-5 text-warning" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground group-hover:text-warning transition-colors">
                    Manage Accounts
                  </p>
                  <p className="text-xs text-muted-foreground">Connect Twitter accounts</p>
                </div>
              </button>

              <button
                onClick={() => navigate('/settings')}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-all group text-left"
              >
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-muted/80 transition-colors">
                  <Settings className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground group-hover:text-foreground transition-colors">
                    Account Settings
                  </p>
                  <p className="text-xs text-muted-foreground">Update preferences</p>
                </div>
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
