import { useState, useEffect, useCallback } from "react";
import { useWsClient } from "../transport/wsClient.js";
import type { MarketplaceEntry, PluginMeta } from "@squadquarium/core";

interface Props {
  onClose: () => void;
  onPluginInstalled?: (pluginName: string, marketplace: string) => void;
}

type PanelView = "list" | "browse";

interface InstallStatus {
  [key: string]: "idle" | "installing" | "done" | "error";
}

export default function MarketplacePanel({ onClose, onPluginInstalled }: Props) {
  const { send, on } = useWsClient();
  const [view, setView] = useState<PanelView>("list");
  const [marketplaces, setMarketplaces] = useState<MarketplaceEntry[] | null>(null);
  const [activeMp, setActiveMp] = useState<string | null>(null);
  const [plugins, setPlugins] = useState<PluginMeta[]>([]);
  const [installStatus, setInstallStatus] = useState<InstallStatus>({});
  const [installOutput, setInstallOutput] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // Request marketplace list on mount
  useEffect(() => {
    setLoading(true);
    send({ kind: "marketplace-list-req", clientSeq: 0 });
  }, [send]);

  useEffect(() => {
    const off = on("marketplace-list", (frame) => {
      setMarketplaces(frame.marketplaces);
      setLoading(false);
    });
    return off;
  }, [on]);

  useEffect(() => {
    const off = on("marketplace-browse", (frame) => {
      setPlugins(frame.plugins);
      setLoading(false);
    });
    return off;
  }, [on]);

  useEffect(() => {
    const off = on("marketplace-install", (frame) => {
      const key = `${frame.marketplace}/${frame.plugin}`;
      const succeeded = (frame.exitCode ?? 1) === 0;
      setInstallStatus((s) => ({ ...s, [key]: succeeded ? "done" : "error" }));
      setInstallOutput((s) => ({ ...s, [key]: frame.output }));
      if (succeeded && onPluginInstalled) {
        onPluginInstalled(frame.plugin, frame.marketplace);
      }
    });
    return off;
  }, [on, onPluginInstalled]);

  const browseMp = useCallback(
    (name: string) => {
      setActiveMp(name);
      setView("browse");
      setLoading(true);
      setPlugins([]);
      send({ kind: "marketplace-browse-req", clientSeq: 0, marketplace: name });
    },
    [send],
  );

  const installPlugin = useCallback(
    (plugin: PluginMeta) => {
      const key = `${plugin.marketplace}/${plugin.name}`;
      setInstallStatus((s) => ({ ...s, [key]: "installing" }));
      send({
        kind: "marketplace-install-req",
        clientSeq: 0,
        marketplace: plugin.marketplace,
        plugin: plugin.name,
      });
    },
    [send],
  );

  const isEmpty = marketplaces !== null && marketplaces.length === 0;

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <span>
          {view === "browse" && activeMp ? `[ marketplace: ${activeMp} ]` : "[ marketplace ]"}
        </span>
        <div style={{ display: "flex", gap: "8px" }}>
          {view === "browse" && (
            <button onClick={() => setView("list")} style={btnStyle}>
              [←back]
            </button>
          )}
          <button onClick={onClose} style={btnStyle}>
            [×]
          </button>
        </div>
      </div>

      <div style={{ padding: "8px", overflowY: "auto", maxHeight: "65vh" }}>
        {loading && <div style={dimStyle}>loading…</div>}

        {/* Empty state */}
        {isEmpty && !loading && (
          <div style={{ display: "grid", gap: "8px" }}>
            <div style={dimStyle}>no marketplaces configured</div>
            <div style={{ border: "1px solid var(--skin-dim)", padding: "6px", fontSize: "12px" }}>
              <div style={{ color: "var(--skin-accent)", marginBottom: "4px" }}>
                add a marketplace:
              </div>
              <code style={{ userSelect: "all", fontSize: "11px" }}>
                squad plugin marketplace add &lt;url&gt;
              </code>
            </div>
          </div>
        )}

        {/* Marketplace list */}
        {view === "list" && !loading && (marketplaces ?? []).length > 0 && (
          <div style={{ display: "grid", gap: "6px" }}>
            {(marketplaces ?? []).map((mp) => (
              <div key={mp.name} style={cardStyle}>
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <span>{mp.name}</span>
                  <button onClick={() => browseMp(mp.name)} style={actionBtnStyle}>
                    [browse]
                  </button>
                </div>
                {mp.description && <div style={dimStyle}>{mp.description}</div>}
                {mp.url && <div style={{ ...dimStyle, fontSize: "11px" }}>src: {mp.url}</div>}
              </div>
            ))}
          </div>
        )}

        {/* Plugin grid (browse view) */}
        {view === "browse" && !loading && (
          <div style={{ display: "grid", gap: "6px" }}>
            {plugins.length === 0 && <div style={dimStyle}>no plugins in this marketplace</div>}
            {plugins.map((plugin) => {
              const key = `${plugin.marketplace}/${plugin.name}`;
              const status = installStatus[key] ?? "idle";
              const output = installOutput[key];

              return (
                <div key={key} style={cardStyle}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <div>
                      <div>{plugin.name}</div>
                      {plugin.version && (
                        <div style={{ ...dimStyle, fontSize: "11px" }}>v{plugin.version}</div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                      {status === "idle" && (
                        <button onClick={() => installPlugin(plugin)} style={actionBtnStyle}>
                          [install]
                        </button>
                      )}
                      {status === "installing" && (
                        <span style={{ color: "var(--skin-accent)" }}>installing…</span>
                      )}
                      {status === "done" && (
                        <span style={{ color: "var(--skin-fg)" }}>✓ installed</span>
                      )}
                      {status === "error" && (
                        <span style={{ color: "var(--skin-alert)" }}>✗ failed</span>
                      )}
                    </div>
                  </div>
                  {plugin.description && (
                    <div style={{ ...dimStyle, marginTop: "3px" }}>{plugin.description}</div>
                  )}
                  {plugin.author && (
                    <div style={{ ...dimStyle, fontSize: "11px" }}>by {plugin.author}</div>
                  )}
                  {/* role badge */}
                  <div style={{ display: "flex", gap: "4px", marginTop: "4px", flexWrap: "wrap" }}>
                    <span style={chipStyle}>from:{plugin.marketplace}</span>
                  </div>
                  {/* install output */}
                  {output && (
                    <pre
                      style={{
                        ...dimStyle,
                        fontSize: "10px",
                        marginTop: "4px",
                        whiteSpace: "pre-wrap",
                        maxHeight: "80px",
                        overflow: "auto",
                      }}
                    >
                      {output}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  position: "absolute",
  left: "50%",
  top: "8%",
  transform: "translateX(-50%)",
  width: "440px",
  background: "var(--skin-bg, #001f1c)",
  border: "1px solid var(--skin-fg, #00bfa5)",
  color: "var(--skin-fg, #00bfa5)",
  fontFamily: "var(--skin-font-family, monospace)",
  fontSize: "var(--skin-font-size, 14px)",
  zIndex: 500,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  borderBottom: "1px solid var(--skin-dim, #004d40)",
  padding: "4px 8px",
};

const btnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--skin-dim, #004d40)",
  fontFamily: "inherit",
  cursor: "pointer",
};

const actionBtnStyle: React.CSSProperties = {
  background: "none",
  border: "1px solid var(--skin-dim, #004d40)",
  color: "var(--skin-fg, #00bfa5)",
  fontFamily: "inherit",
  cursor: "pointer",
  padding: "0 4px",
  fontSize: "12px",
};

const cardStyle: React.CSSProperties = {
  border: "1px solid var(--skin-dim, #004d40)",
  padding: "6px",
};

const chipStyle: React.CSSProperties = {
  border: "1px solid var(--skin-dim, #004d40)",
  color: "var(--skin-accent, #80cbc4)",
  padding: "1px 3px",
  fontSize: "10px",
};

const dimStyle: React.CSSProperties = {
  color: "var(--skin-dim, #004d40)",
  fontSize: "12px",
};
