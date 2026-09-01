export type ModelProvider = "openai" | "ollama-cloud" | "custom";

export type ModelSettings = {
  provider: ModelProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
};

const STORAGE_KEY = "sketchcoder.model-settings.v1";

export const PROVIDER_PRESETS: Record<
  ModelProvider,
  { label: string; baseUrl: string; model: string; hint: string }
> = {
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    hint: "Vision + scaffold polish. Uses your OpenAI API key.",
  },
  "ollama-cloud": {
    label: "Ollama Cloud",
    baseUrl: "https://ollama.com/v1",
    model: "qwen3.5:cloud",
    hint: "Hosted Ollama models. Get a key at ollama.com. Pick a vision-capable model for handwriting.",
  },
  custom: {
    label: "Custom (OpenAI-compatible)",
    baseUrl: "http://localhost:11434/v1",
    model: "llama3.2-vision",
    hint: "Any OpenAI-compatible /v1 endpoint (local Ollama, LM Studio, etc.).",
  },
};

export const DEFAULT_SETTINGS: ModelSettings = {
  provider: "ollama-cloud",
  apiKey: "",
  baseUrl: PROVIDER_PRESETS["ollama-cloud"].baseUrl,
  model: PROVIDER_PRESETS["ollama-cloud"].model,
};

export function loadSettings(): ModelSettings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<ModelSettings>;
    return {
      provider: parsed.provider ?? DEFAULT_SETTINGS.provider,
      apiKey: parsed.apiKey ?? "",
      baseUrl: parsed.baseUrl ?? DEFAULT_SETTINGS.baseUrl,
      model: parsed.model ?? DEFAULT_SETTINGS.model,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: ModelSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function applyProviderPreset(
  provider: ModelProvider,
  current: ModelSettings
): ModelSettings {
  const preset = PROVIDER_PRESETS[provider];
  const switchedProvider = current.provider !== provider;
  return {
    provider,
    apiKey: current.apiKey,
    baseUrl: switchedProvider ? preset.baseUrl : current.baseUrl || preset.baseUrl,
    model: switchedProvider ? preset.model : current.model || preset.model,
  };
}

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/$/, "");
}

export function settingsForApi(settings: ModelSettings): {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
} {
  const apiKey = settings.apiKey.trim();
  if (!apiKey) return {};
  return {
    apiKey,
    baseUrl: normalizeBaseUrl(settings.baseUrl),
    model: settings.model.trim() || undefined,
  };
}
