"use client";

import { useSyncExternalStore } from "react";
type Theme = "system" | "light" | "dark";
const key = "mellivo-theme";
function readTheme(): Theme {
  try { const value = localStorage.getItem(key); return value === "light" || value === "dark" ? value : "system"; } catch { return "system"; }
}
function subscribe(callback: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const update = () => {
    const value = readTheme();
    document.documentElement.dataset.theme = value === "system" ? (media.matches ? "dark" : "light") : value;
    callback();
  };
  update();
  window.addEventListener("storage", update);
  window.addEventListener("mellivo-theme-change", update);
  media.addEventListener("change", update);
  return () => { window.removeEventListener("storage", update); window.removeEventListener("mellivo-theme-change", update); media.removeEventListener("change", update); };
}
export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "system" as Theme);
  return <label className="mt-4 flex items-center justify-between gap-3 text-xs font-semibold text-slate-500">Appearance
    <select aria-label="Appearance" value={theme} onChange={(event) => {
      const value = event.target.value;
      document.documentElement.dataset.theme = value === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : value;
      try { localStorage.setItem(key, value); } catch { /* Session-only theme when storage is unavailable. */ }
      window.dispatchEvent(new Event("mellivo-theme-change"));
    }} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select>
  </label>;
}
