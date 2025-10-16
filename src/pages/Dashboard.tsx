import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Send, Users, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { dashboard, campaigns as campaignsAPI } from '@/lib/api';
import { DashboardSkeleton } from '@/components/loading/PageSkeleton';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>({ totalDMs: 0, activeCampaigns: 0, connectedAccounts: 0, replyRate: '0.0' });
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
      setRecentCampaigns(campaignsData.slice(0, 3));
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
  const replyRate = stats.replyRate;

  const statsDisplay = [
    { label: 'Total DMs Sent', value: totalDMs, icon: Send, color: 'text-primary' },
    { label: 'Active Campaigns', value: activeCampaigns, icon: TrendingUp, color: 'text-success' },
    { label: 'Connected Accounts', value: totalAccounts, icon: Users, color: 'text-warning' },
    { label: 'Reply Rate', value: `${replyRate}%`, icon: TrendingUp, color: 'text-primary' },
  ];
  
  if (loading) {
    return <div className="min-h-screen bg-background p-8"><div className="text-center">Loading...</div></div>;
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

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {statsDisplay.map((stat) => (
            <Card key={stat.label} className="p-6 shadow-md transition-shadow hover:shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="mt-2 text-3xl font-bold text-foreground">{stat.value}</p>
                </div>
                <div className={`rounded-lg bg-muted p-3 ${stat.color}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Card className="shadow-md">
          <div className="border-b border-border p-6">
            <h2 className="text-xl font-semibold text-foreground">Recent Activity</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {recentCampaigns.map((campaign) => (
                <div key={campaign.id} className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-primary">
                      <Send className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{campaign.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {campaign.stats_sent} / {campaign.stats_total} messages sent
                      </p>
                    </div>
                  </div>
                  <Badge variant={campaign.status === 'active' ? 'default' : campaign.status === 'paused' ? 'secondary' : 'outline'}>
                    {campaign.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="shadow-md">
            <div className="border-b border-border p-6">
              <h2 className="text-xl font-semibold text-foreground">Quick Actions</h2>
            </div>
            <div className="grid gap-3 p-6">
              <Button onClick={() => navigate('/campaigns/new')} variant="outline" className="justify-start">
                <Send className="mr-2 h-4 w-4" />
                Create New Campaign
              </Button>
              <Button onClick={() => navigate('/accounts')} variant="outline" className="justify-start">
                <Users className="mr-2 h-4 w-4" />
                Manage Accounts
              </Button>
              <Button onClick={() => navigate('/settings')} variant="outline" className="justify-start">
                <Users className="mr-2 h-4 w-4" />
                Account Settings
              </Button>
            </div>
          </Card>

          <Card className="shadow-md">
            <div className="border-b border-border p-6">
              <h2 className="text-xl font-semibold text-foreground">Performance Insights</h2>
            </div>
            <div className="space-y-4 p-6">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Messages Delivered</span>
                <span className="font-medium text-foreground">
                  {totalDMs}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Reply Rate</span>
                <span className="font-medium text-success">{replyRate}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Active Campaigns</span>
                <span className="font-medium text-primary">
                  {activeCampaigns}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
