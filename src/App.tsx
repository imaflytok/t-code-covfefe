import { useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { Main } from "./components/Main";
import { SettingsModal } from "./components/SettingsModal";
import { useSettings } from "./store/settings";

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const hydrateKeys = useSettings((s) => s.hydrateKeys);

  useEffect(() => {
    hydrateKeys();
  }, [hydrateKeys]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar onOpenSettings={() => setSettingsOpen(true)} />
      <Main />
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
