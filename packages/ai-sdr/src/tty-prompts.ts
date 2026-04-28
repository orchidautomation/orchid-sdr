import { clearScreenDown, cursorTo, emitKeypressEvents, moveCursor } from "node:readline";
import process from "node:process";

type Keypress = {
  name?: string;
  ctrl?: boolean;
};

export type PromptOption<T extends string> = {
  value: T;
  label: string;
  hint?: string;
};

export async function promptSelect<T extends string>(input: {
  message: string;
  hint?: string;
  options: Array<PromptOption<T>>;
  initialValue?: T;
}) {
  let cursor = Math.max(0, input.options.findIndex((option) => option.value === input.initialValue));
  if (cursor < 0 || cursor >= input.options.length) {
    cursor = 0;
  }

  return await runPrompt({
    render: () => renderSelect({
      message: input.message,
      hint: input.hint,
      options: input.options,
      cursor,
    }),
    onKeypress: (keypress) => {
      switch (keypress.name) {
        case "up":
        case "k":
          cursor = cursor > 0 ? cursor - 1 : input.options.length - 1;
          return { action: "render" };
        case "down":
        case "j":
          cursor = cursor < input.options.length - 1 ? cursor + 1 : 0;
          return { action: "render" };
        case "return":
        case "enter":
          return { action: "resolve", value: input.options[cursor]?.value ?? input.options[0]?.value };
        default:
          return { action: "noop" };
      }
    },
  });
}

export async function promptMultiSelect<T extends string>(input: {
  message: string;
  hint?: string;
  options: Array<PromptOption<T>>;
  initialValues?: T[];
}) {
  let cursor = 0;
  const selected = new Set<T>(input.initialValues ?? []);

  return await runPrompt({
    render: () => renderMultiSelect({
      message: input.message,
      hint: input.hint,
      options: input.options,
      cursor,
      selected,
    }),
    onKeypress: (keypress) => {
      switch (keypress.name) {
        case "up":
        case "k":
          cursor = cursor > 0 ? cursor - 1 : input.options.length - 1;
          return { action: "render" };
        case "down":
        case "j":
          cursor = cursor < input.options.length - 1 ? cursor + 1 : 0;
          return { action: "render" };
        case "space":
          toggleSelected(selected, input.options[cursor]?.value);
          return { action: "render" };
        case "a":
          if (selected.size === input.options.length) {
            selected.clear();
          } else {
            for (const option of input.options) {
              selected.add(option.value);
            }
          }
          return { action: "render" };
        case "return":
        case "enter":
          return { action: "resolve", value: input.options.map((option) => option.value).filter((value) => selected.has(value)) };
        default:
          return { action: "noop" };
      }
    },
  });
}

async function runPrompt<T>(input: {
  render: () => string;
  onKeypress: (keypress: Keypress) => { action: "render" | "resolve" | "noop"; value?: T };
}) {
  const stdin = process.stdin;
  const stdout = process.stdout;

  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error("Interactive terminal controls require a TTY.");
  }

  emitKeypressEvents(stdin);
  const hadRawMode = Boolean(stdin.isRaw);
  stdin.setRawMode(true);

  let renderedLineCount = 0;
  stdout.write("\x1B[?25l");

  return await new Promise<T>((resolve, reject) => {
    const render = () => {
      if (renderedLineCount > 0) {
        cursorTo(stdout, 0);
        if (renderedLineCount > 1) {
          moveCursor(stdout, 0, -(renderedLineCount - 1));
        }
      }
      clearScreenDown(stdout);
      const text = input.render();
      renderedLineCount = countLines(text);
      stdout.write(text);
    };

    const cleanup = () => {
      stdin.off("keypress", onKeypress);
      if (!hadRawMode) {
        stdin.setRawMode(false);
      }
      stdout.write("\x1B[?25h");
      stdout.write("\n");
    };

    const onKeypress = (_sequence: string, key: Keypress) => {
      if (key.ctrl && key.name === "c") {
        cleanup();
        reject(new Error("Prompt cancelled."));
        return;
      }

      const outcome = input.onKeypress(key);
      if (outcome.action === "render") {
        render();
        return;
      }
      if (outcome.action === "resolve") {
        cleanup();
        resolve(outcome.value as T);
      }
    };

    stdin.on("keypress", onKeypress);
    render();
  });
}

function renderSelect<T extends string>(input: {
  message: string;
  hint?: string;
  options: Array<PromptOption<T>>;
  cursor: number;
}) {
  const width = resolvePromptWidth();
  const selectedOption = input.options[input.cursor];
  const lines = renderPromptHeader({
    message: input.message,
    hint: input.hint ?? "up/down move, Enter continues",
    width,
  });

  for (const [index, option] of input.options.entries()) {
    const prefix = index === input.cursor ? ">" : " ";
    lines.push(formatOptionLine(`${prefix} ${option.label}`, width));
  }

  if (selectedOption?.hint) {
    lines.push("");
    lines.push(formatMetaLine(`About: ${selectedOption.hint}`, width));
  }

  return lines.join("\n");
}

function renderMultiSelect<T extends string>(input: {
  message: string;
  hint?: string;
  options: Array<PromptOption<T>>;
  cursor: number;
  selected: Set<T>;
}) {
  const width = resolvePromptWidth();
  const selectedOption = input.options[input.cursor];
  const lines = renderPromptHeader({
    message: input.message,
    hint: input.hint ?? "up/down move, Space selects, Enter continues, a selects all",
    width,
  });

  for (const [index, option] of input.options.entries()) {
    const cursorPrefix = index === input.cursor ? ">" : " ";
    const selectedPrefix = input.selected.has(option.value) ? "[x]" : "[ ]";
    lines.push(formatOptionLine(`${cursorPrefix} ${selectedPrefix} ${option.label}`, width));
  }

  lines.push("");
  lines.push(formatMetaLine(`Selected: ${input.selected.size}`, width));
  if (selectedOption?.hint) {
    lines.push(formatMetaLine(`About: ${selectedOption.hint}`, width));
  }

  return lines.join("\n");
}

function renderPromptHeader(input: {
  message: string;
  hint: string;
  width: number;
}) {
  return [
    truncateText(input.message, input.width),
    formatMetaLine(input.hint, input.width),
    "",
  ];
}

function resolvePromptWidth() {
  const columns = process.stdout.columns ?? 80;
  return Math.max(24, Math.min(columns - 2, 88));
}

function formatOptionLine(text: string, width: number) {
  return truncateText(text, width);
}

function formatMetaLine(text: string, width: number) {
  return truncateText(`  ${text}`, width);
}

function truncateText(text: string, width: number) {
  if (visibleWidth(text) <= width) {
    return text;
  }

  if (width <= 3) {
    return Array.from(text).slice(0, width).join("");
  }

  return `${Array.from(text).slice(0, width - 3).join("")}...`;
}

function countLines(text: string) {
  return text.split("\n").length;
}

function visibleWidth(text: string) {
  return Array.from(text).length;
}

function toggleSelected<T extends string>(selected: Set<T>, value: T | undefined) {
  if (!value) {
    return;
  }
  if (selected.has(value)) {
    selected.delete(value);
  } else {
    selected.add(value);
  }
}
