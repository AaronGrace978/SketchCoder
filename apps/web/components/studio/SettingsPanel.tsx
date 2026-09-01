"use client";

import { useEffect, useState } from "react";
import {
  applyProviderPreset,
  loadSettings,
  PROVIDER_PRESETS,
  saveSettings,
  type ModelProvider,
  type ModelSettings,
} from "@/lib/settings";

export function SettingsPanel() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<ModelSettings>(() => loadSettings());
  const [models, setModels] = useState<string[]>([]);
  const [modelsStatus, setModelsStatus] = useState<"idle" | "loading" | "error">("idle");
  const [modelsError, setModelsError] = useState("");

  useEffect(() => {
    if (!open) return;
    setSettings(loadSettings());
    setModels([]);
    setModelsStatus("idle");
    setModelsError("");
  }, [open]);

  const update = (patch: Partial<ModelSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  };

  const setProvider = (provider: ModelProvider) => {
    setSettings((prev) => {
      const next = applyProviderPreset(provider, prev);
      saveSettings(next);
      return next;
    });
    setModels([]);
    setModelsStatus("idle");
  };

  const loadModels = async () => {
    if (!settings.apiKey.trim()) {
      setModelsError("Add an API key first.");
      setModelsStatus("error");
      return;
    }
    setModelsStatus("loading");
    setModelsError("");
    try {
      const res = await fetch("/api/models", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          apiKey: settings.apiKey.trim(),
          baseUrl: settings.baseUrl.trim(),
        }),
      });
      const json = (await res.json()) as { models?: string[]; error?: string };
      if (!res.ok) throw new Error(json.error || "Could not list models");
      setModels(json.models ?? []);
      setModelsStatus("idle");
    } catch (err) {
      setModelsStatus("error");
      setModelsError(err instanceof Error ? err.message : "Could not list models");
    }
  };

  const preset = PROVIDER_PRESETS[settings.provider];

  return (
    <>
      <button
        type="button"
        title="Model settings"
        onClick={() => setOpen(true)}
        className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted hover:text-bone"
      >
        Settings
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg border border-line bg-graphite"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="settings-title"
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div>
                <p
                  id="settings-title"
                  className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted"
                >
                  Model settings
                </p>
                <p className="mt-1 text-[15px] text-bone">Vision + scaffold provider</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted hover:text-bone"
              >
                Close
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                  Provider
                </span>
                <select
                  value={settings.provider}
                  onChange={(e) => setProvider(e.target.value as ModelProvider)}
                  className="mt-1.5 w-full border border-line bg-ink px-3 py-2 font-mono text-[13px] text-bone outline-none"
                >
                  {(Object.keys(PROVIDER_PRESETS) as ModelProvider[]).map((id) => (
                    <option key={id} value={id}>
                      {PROVIDER_PRESETS[id].label}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-[12px] leading-relaxed text-muted">{preset.hint}</p>
              </label>

              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                  API key
                </span>
                <input
                  type="password"
                  value={settings.apiKey}
                  onChange={(e) => update({ apiKey: e.target.value })}
                  placeholder={
                    settings.provider === "ollama-cloud"
                      ? "OLLAMA_API_KEY from ollama.com"
                      : "sk-..."
                  }
                  autoComplete="off"
                  className="mt-1.5 w-full border border-line bg-ink px-3 py-2 font-mono text-[13px] text-bone outline-none placeholder:text-muted/60"
                />
              </label>

              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                  Base URL
                </span>
                <input
                  value={settings.baseUrl}
                  onChange={(e) => update({ baseUrl: e.target.value })}
                  placeholder={preset.baseUrl}
                  className="mt-1.5 w-full border border-line bg-ink px-3 py-2 font-mono text-[13px] text-bone outline-none placeholder:text-muted/60"
                />
              </label>

              <div>
                <label className="block">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                    Model
                  </span>
                  <input
                    value={settings.model}
                    onChange={(e) => update({ model: e.target.value })}
                    placeholder={preset.model}
                    className="mt-1.5 w-full border border-line bg-ink px-3 py-2 font-mono text-[13px] text-bone outline-none placeholder:text-muted/60"
                  />
                </label>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={loadModels}
                    disabled={modelsStatus === "loading"}
                    className="border border-line px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted hover:text-bone disabled:opacity-40"
                  >
                    {modelsStatus === "loading" ? "Loading…" : "Load models"}
                  </button>
                  {settings.provider === "ollama-cloud" ? (
                    <span className="font-mono text-[10px] text-muted">
                      Try vision models like qwen3.5:cloud
                    </span>
                  ) : null}
                </div>
                {modelsError ? (
                  <p className="mt-2 text-[12px] text-brass">{modelsError}</p>
                ) : null}
                {models.length ? (
                  <div className="mt-2 max-h-32 overflow-auto border border-line">
                    {models.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => update({ model: m })}
                        className={`block w-full px-3 py-1.5 text-left font-mono text-[11px] hover:bg-paper ${
                          settings.model === m ? "text-brass" : "text-bone/80"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <p className="border-t border-line pt-3 text-[12px] leading-relaxed text-muted">
                Stored on this device only. Generate uses this for board vision and optional
                scaffold polish. Without a key, OCR + templates still work.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
