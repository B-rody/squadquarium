import { useState, useEffect, useCallback } from "react";
import { loadSkin, type SkinAssets } from "./loader.js";

const DEFAULT_SKIN = "aquarium";

function getActiveSkinFromHash(): string {
  if (typeof window === "undefined") return DEFAULT_SKIN;
  const match = location.hash.match(/[#&]skin=([a-z][a-z0-9-]*)/);
  return match ? match[1] : DEFAULT_SKIN;
}

export interface SkinRegistry {
  activeSkin: string;
  skinAssets: SkinAssets | null;
  skinError: Error | null;
  skinLoading: boolean;
  setActiveSkin: (name: string) => void;
  availableSkins: string[];
}

export function useSkinRegistry(availableSkins: string[]): SkinRegistry {
  const [activeSkin, setActiveSkinState] = useState(getActiveSkinFromHash);
  const [skinAssets, setSkinAssets] = useState<SkinAssets | null>(null);
  const [skinError, setSkinError] = useState<Error | null>(null);
  const [skinLoading, setSkinLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setSkinLoading(true);
    setSkinError(null);
    loadSkin(activeSkin)
      .then((assets) => {
        if (!cancelled) {
          setSkinAssets(assets);
          setSkinLoading(false);
          applyTokensCSS(assets.tokensCSS, activeSkin);
          if (typeof window !== "undefined") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).__squadquarium = {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ...(window as any).__squadquarium,
              skinManifestValid: true,
              activeSkin,
            };
          }
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setSkinError(err);
          setSkinLoading(false);
          if (typeof window !== "undefined") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).__squadquarium = {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ...(window as any).__squadquarium,
              skinManifestValid: false,
            };
          }
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeSkin]);

  const setActiveSkin = useCallback((name: string) => {
    location.hash = `skin=${name}`;
    setActiveSkinState(name);
  }, []);

  return {
    activeSkin,
    skinAssets,
    skinError,
    skinLoading,
    setActiveSkin,
    availableSkins: availableSkins.length > 0 ? availableSkins : [DEFAULT_SKIN],
  };
}

let styleEl: HTMLStyleElement | null = null;

function applyTokensCSS(css: string, skinName: string) {
  void skinName;
  if (typeof document === "undefined") return;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "skin-tokens";
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = css;
}
