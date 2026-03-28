const INTERRUPTION_PHRASES = [
  "wait",
  "one second",
  "hold on",
  "hang on",
  "give me a second",
  "let me think",
  "sorry",
  "hold up",
];

type TurnTimingInput = {
  text: string;
  interruptedRecently?: boolean;
};

export function getAutoSubmitDelayMs(input: TurnTimingInput) {
  const normalized = normalizeUtterance(input.text);
  if (!normalized || shouldIgnoreInterruptedUtterance(normalized, input.interruptedRecently)) {
    return null;
  }

  const wordCount = countWords(normalized);
  const endsSentence = /[.!?]$/.test(normalized);

  if (endsSentence && wordCount >= 8) {
    return 650;
  }

  if (wordCount <= 3) {
    return input.interruptedRecently ? 1700 : 1450;
  }

  if (wordCount <= 8) {
    return input.interruptedRecently ? 1500 : 1200;
  }

  return input.interruptedRecently ? 1250 : 950;
}

export function getFinalChunkCommitDelayMs(input: TurnTimingInput) {
  const normalized = normalizeUtterance(input.text);
  if (!normalized || shouldIgnoreInterruptedUtterance(normalized, input.interruptedRecently)) {
    return null;
  }

  if (/[.!?]$/.test(normalized)) {
    return 120;
  }

  const wordCount = countWords(normalized);
  if (wordCount <= 3) {
    return input.interruptedRecently ? 1200 : 900;
  }

  return input.interruptedRecently ? 750 : 420;
}

export function shouldIgnoreInterruptedUtterance(text: string, interruptedRecently = false) {
  const normalized = normalizeUtterance(text);
  if (!normalized) {
    return true;
  }

  if (!interruptedRecently) {
    return false;
  }

  return INTERRUPTION_PHRASES.some((phrase) => normalized === phrase || normalized.startsWith(`${phrase} `));
}

export function normalizeUtterance(text: string) {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function countWords(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}
