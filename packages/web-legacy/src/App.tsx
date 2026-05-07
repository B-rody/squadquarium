import { useEffect, useState } from "react";
import { useStore } from "./transport/store.js";
import { useWsClient } from "./transport/wsClient.js";
import { useSkinRegistry } from "./skin/registry.js";
import AppShell from "./components/AppShell.js";
import "./styles/global.css";

export default function App() {
  const { setSnapshot, appendEvent, setConnection, snapshot } = useStore();
  const { status, on } = useWsClient();
  const [crtMode, setCrtMode] = useState<"off" | "scanlines" | "bloom" | "all">("scanlines");

  const skinRegistry = useSkinRegistry(snapshot?.skinNames ?? ["aquarium"]);

  useEffect(() => {
    setConnection({ status });
  }, [status, setConnection]);

  useEffect(() => {
    const offHello = on("hello", (frame) => {
      setConnection({
        squadRoot: frame.squadRoot,
        squadVersion: frame.squadVersion,
        mode: frame.mode,
        squadquariumVersion: frame.squadquariumVersion,
      });
    });

    const offSnapshot = on("snapshot", (frame) => {
      setSnapshot(frame.snapshot);
    });

    const offEvent = on("event", (frame) => {
      appendEvent(frame.event);
    });

    return () => {
      offHello();
      offSnapshot();
      offEvent();
    };
  }, [on, setSnapshot, appendEvent, setConnection]);

  const { skinAssets, skinLoading, skinError, activeSkin, setActiveSkin, availableSkins } =
    skinRegistry;

  if (skinLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          fontFamily: "JetBrains Mono, monospace",
          color: "#00bfa5",
          background: "#001f1c",
        }}
      >
        loading skin…
      </div>
    );
  }

  if (skinError || !skinAssets) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          fontFamily: "JetBrains Mono, monospace",
          color: "#ff5252",
          background: "#001f1c",
          gap: "8px",
        }}
      >
        <span>skin load error</span>
        <span style={{ fontSize: "12px", color: "#004d40" }}>
          {skinError?.message ?? "unknown"}
        </span>
      </div>
    );
  }

  return (
    <AppShell
      skinAssets={skinAssets}
      availableSkins={availableSkins}
      activeSkin={activeSkin}
      setActiveSkin={setActiveSkin}
      crtMode={crtMode}
      setCrtMode={setCrtMode}
    />
  );
}
