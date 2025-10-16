import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Campaigns from "./pages/Campaigns";
import CampaignDetail from "./pages/CampaignDetail";
import CampaignWizard from "./pages/campaign-wizard/CampaignWizard";
import FollowCampaigns from "./pages/FollowCampaigns";
import FollowCampaignDetail from "./pages/FollowCampaignDetail";
import FollowCampaignWizard from "./pages/follow-wizard/FollowCampaignWizard";
import Accounts from "./pages/Accounts";
import Settings from "./pages/Settings";
import Plans from "./pages/Plans";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Auth />} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/campaigns/new" element={<CampaignWizard />} />
            <Route path="/campaigns/wizard" element={<CampaignWizard />} />
            <Route path="/campaigns/:id" element={<CampaignDetail />} />
            <Route path="/follow-campaigns" element={<FollowCampaigns />} />
            <Route path="/follow-campaigns/new" element={<FollowCampaignWizard />} />
            <Route path="/follow-campaigns/wizard" element={<FollowCampaignWizard />} />
            <Route path="/follow-campaigns/:id" element={<FollowCampaignDetail />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/plans" element={<Plans />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
