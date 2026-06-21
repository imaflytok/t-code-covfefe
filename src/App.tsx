import { useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { Main } from "./components/Main";
import { SettingsModal } from "./components/SettingsModal";
import { useSettings } from "./store/settings";

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const hydrateKeys = useSettings((s) => s.hydrateKeys);
  const hydrateOauth = useSettings((s) => s.hydrateOauth);

  useEffect(() => {
    hydrateKeys();
    // Hydrate OAuth connection status so the UI reflects existing logins.
    hydrateOauth();
  }, [hydrateKeys, hydrateOauth]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar onOpenSettings={() => setSettingsOpen(true)} />
      <Main />
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
