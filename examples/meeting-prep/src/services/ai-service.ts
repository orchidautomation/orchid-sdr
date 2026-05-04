import { createGatewayProvider } from "@ai-sdk/gateway";
import { generateObject } from "ai";

import { prepBriefSchema, type MeetingBookingPayload, type PrepBrief } from "../domain/types.js";
import { getConfig } from "../config.js";
import { getFrameworkRuntimeConfig } from "./framework-stack.js";

const DEFAULT_GATEWAY_MODEL = "openai/gpt-5.4-mini";

export class AiStructuredService {
  private readonly config = getConfig();
  private readonly frameworkConfig = getFrameworkRuntimeConfig().config;
  private readonly provider = createGatewayProvider({
    apiKey: this.config.gatewayApiKey,
  });

  async buildArtifact(input: {
    payload: MeetingBookingPayload;
    knowledgeContext: string;
  }): Promise<PrepBrief> {
    if (!this.config.gatewayApiKey) {
      return heuristicArtifact(input.payload);
    }

    try {
      const result = await generateObject({
        model: this.provider(
          this.frameworkConfig.modelRouting?.defaultModel
            ?? this.frameworkConfig.modelRouting?.sandbox?.defaultModel
            ?? DEFAULT_GATEWAY_MODEL,
        ),
        schema: prepBriefSchema,
        prompt: [
          "You are a Trellis meeting prep agent.",
          "Create a high-signal operator brief from a structured booking payload plus knowledge context.",
          "Use public-company, attendee, and meeting details already present in the payload and knowledge context.",
          "If something is unclear, reflect that as a risk or a better question to ask instead of guessing.",
          "Return only JSON matching the requested shape.",
          "",
          "Knowledge context:",
          input.knowledgeContext || "No matching knowledge snippets found.",
          "",
          "Payload:",
          JSON.stringify(input.payload, null, 2),
        ].join("\n"),
      });

      return result.object;
    } catch {
      return heuristicBrief(input.payload);
    }
  }
}

function heuristicBrief(payload: MeetingBookingPayload): PrepBrief {
  const meeting = payload.meeting;
  const attendees = meeting.attendees ?? [];
  return {
    summary: `${meeting.title} starts at ${meeting.startsAt}.`,
    accountContext: [
      ...(meeting.accountName ? [`Account: ${meeting.accountName}`] : []),
      ...(meeting.organizerEmail ? [`Organizer: ${meeting.organizerEmail}`] : []),
    ],
    attendeeHighlights: attendees.map((attendee) =>
      [attendee.fullName, attendee.role, attendee.company].filter(Boolean).join(" - "),
    ),
    questionsToAsk: ["What outcome should this meeting produce?"],
    risks: attendees.length === 0 ? ["No attendees were provided in the booking payload."] : [],
    confidence: attendees.length > 0 ? 0.65 : 0.45,
  };
}
