import type { TrellisMailSequenceMap } from "@trellis/gtm";

const agentmailSequenceMap = {
  provider: "agentmail",
  defaultInboxId: "env:AGENTMAIL_INBOX_ID",
  stopOn: ["reply.received", "unsubscribe", "bounce", "manual.pause", "kill_switch"],
  steps: [
    {
      id: "initial",
      operation: "mail.send",
      draftSkill: "sdr-copy",
      approval: "required",
    },
    {
      id: "follow_up_1",
      operation: "mail.reply",
      draftSkill: "sdr-copy",
      delay: "3 days",
      condition: "no_reply",
      approval: "required",
    },
    {
      id: "follow_up_2",
      operation: "mail.reply",
      draftSkill: "sdr-copy",
      delay: "5 days",
      condition: "no_reply",
      approval: "required",
    },
  ],
} satisfies TrellisMailSequenceMap;

export default agentmailSequenceMap;
