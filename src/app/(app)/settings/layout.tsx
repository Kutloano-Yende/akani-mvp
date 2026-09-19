import { SettingsNav } from "./settings-nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
      </div>
      <SettingsNav />
      {children}
    </div>
  );
}
