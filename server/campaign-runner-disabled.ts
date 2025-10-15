// Campaign runner temporarily disabled for deployment
// Will be updated to use PostgreSQL later

export function startCampaign(campaignId: number) {
  console.log(`Campaign ${campaignId} - temporarily disabled`);
}

export function pauseCampaign(campaignId: number) {
  console.log(`Campaign ${campaignId} paused`);
}

export function stopCampaign(campaignId: number) {
  console.log(`Campaign ${campaignId} stopped`);
}

export function resumeActiveCampaigns() {
  console.log('Resume campaigns - temporarily disabled');
}
