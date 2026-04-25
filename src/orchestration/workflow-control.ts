import type { ControlFlags } from "../repository.js";

export function getAutomationPauseReason(controlFlags: ControlFlags, campaignId: string) {
  if (controlFlags.globalKillSwitch) {
    return "global kill switch enabled";
  }

  const pausedCampaignIds = Array.isArray(controlFlags.pausedCampaignIds)
    ? controlFlags.pausedCampaignIds
    : [];

  if (pausedCampaignIds.includes(campaignId)) {
    return "campaign is paused";
  }

  return null;
}

export function isAutomationPaused(controlFlags: ControlFlags, campaignId: string) {
  return getAutomationPauseReason(controlFlags, campaignId) !== null;
}
