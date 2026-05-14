export { slackHandoffModule } from "../../framework/src/builtin-modules.js";
export { slackHandoffProvider } from "../../framework/src/providers.js";

export interface TrellisSlackOperatorOptions {
  botToken: string;
  signingSecret: string;
  userName?: string;
  onSlashCommand?: (event: unknown) => Promise<void> | void;
  onAction?: (event: unknown) => Promise<void> | void;
}

export async function createTrellisSlackOperatorBot(options: TrellisSlackOperatorOptions) {
  const dynamicImport = new Function("specifier", "return import(specifier)") as (
    specifier: string,
  ) => Promise<Record<string, unknown>>;
  const chatModule = await dynamicImport("chat");
  const slackModule = await dynamicImport("@chat-adapter/slack");
  const Chat = chatModule.Chat as new (config: Record<string, unknown>) => Record<string, unknown>;
  const createSlackAdapter = slackModule.createSlackAdapter as (config?: Record<string, unknown>) => unknown;
  const bot = new Chat({
    userName: options.userName ?? "trellis",
    adapters: {
      slack: createSlackAdapter({
        botToken: options.botToken,
        signingSecret: options.signingSecret,
      }),
    },
    streamingUpdateIntervalMs: 1_000,
    fallbackStreamingPlaceholderText: "Watching Trellis...",
    logger: "warn",
  });

  if (options.onSlashCommand && typeof bot.onSlashCommand === "function") {
    (bot.onSlashCommand as (command: string, handler: (event: unknown) => Promise<void>) => void)(
      "/trellis",
      async (event) => {
        await options.onSlashCommand?.(event);
      },
    );
  }

  if (options.onAction && typeof bot.onAction === "function") {
    (bot.onAction as (actions: string[], handler: (event: unknown) => Promise<void>) => void)(
      ["approve", "reject"],
      async (event) => {
        await options.onAction?.(event);
      },
    );
  }

  return bot;
}
