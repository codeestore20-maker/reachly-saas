// Follow runner temporarily disabled for deployment
// Will be updated to use PostgreSQL later

export function startFollowCampaign(campaignId: number) {
  console.log(`Follow campaign ${campaignId} - temporarily disabled`);
}

export function pauseFollowCampaign(campaignId: number) {
  console.log(`Follow campaign ${campaignId} paused`);
}

export function stopFollowCampaign(campaignId: number) {
  console.log(`Follow campaign ${campaignId} stopped`);
}

export function resumeActiveFollowCampaigns() {
  console.log('Resume follow campaigns - temporarily disabled');
}
