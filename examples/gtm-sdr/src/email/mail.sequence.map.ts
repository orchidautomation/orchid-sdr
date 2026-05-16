import type { TrellisMailSequenceMap } from "@trellis/gtm";

const mailSequenceMap = {
  provider: "mail",
  stopOn: ["reply.received", "unsubscribe", "bounce", "manual.pause", "kill_switch"],
  steps: [
    {
      id: "initial",
      operation: "email.send",
      draftSkill: "sdr-copy",
      approval: "required",
    },
    {
      id: "follow_up_1",
      operation: "email.reply",
      draftSkill: "sdr-copy",
      delay: "3 days",
      condition: "no_reply",
      approval: "required",
    },
    {
      id: "follow_up_2",
      operation: "email.reply",
      draftSkill: "sdr-copy",
      delay: "5 days",
      condition: "no_reply",
      approval: "required",
    },
  ],
} satisfies TrellisMailSequenceMap;

export default mailSequenceMap;
