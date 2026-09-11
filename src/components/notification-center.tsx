"use client";

import { useState } from "react";
import type { WorkNotification } from "@/lib/notifications";

export default function NotificationCenter({ notifications, projectName, onOpen }: {
  notifications: WorkNotification[];
  projectName: (id: string) => string;
  onOpen: (notification: WorkNotification) => void;
}) {
  const [filter, setFilter] = useState("All");
  const filtered = notifications.filter(item => filter === "All" || item.kind === filter);
  return <div className="space-y-5">
    <div><h2 className="text-2xl font-bold">Notifications</h2><p className="mt-2 text-sm text-slate-500">Your current work alerts. Urgent items appear first and refresh automatically while the app is open.</p></div>
    <div className="flex flex-wrap gap-2" aria-label="Notification filters">
      {["All", "Deadlines", "Messages", "Assignments", "Reviews"].map(kind => <button type="button" key={kind} aria-pressed={filter === kind} onClick={() => setFilter(kind)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${filter === kind ? "bg-indigo-600 text-white" : "bg-white text-slate-600 border border-slate-200"}`}>{kind} ({notifications.filter(item => kind === "All" || item.kind === kind).length})</button>)}
    </div>
    {filtered.length ? <ul className="space-y-3">{filtered.map(item => <li key={item.id}><button type="button" onClick={() => onOpen(item)} className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-indigo-400 focus-visible:outline-2 focus-visible:outline-indigo-500">
      <div className="flex flex-wrap items-center gap-2"><span className={`text-xs font-bold ${item.urgent ? "text-orange-500" : "text-indigo-600"}`}>{item.label}</span><span className="text-xs text-slate-500">{projectName(item.projectId)}</span></div>
      <p className="mt-2 break-words font-semibold">{item.title}</p>
      <p className="mt-2 text-xs text-slate-500">{item.kind === "Deadlines" ? `Due ${item.date}` : item.kind === "Messages" ? "Open chat" : "View task details"} →</p>
    </button></li>)}</ul> : <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">No {filter === "All" ? "current alerts" : filter.toLowerCase() + " alerts"}. You’re up to date.</div>}
    <p className="text-xs text-slate-500">Message alerts clear when you read the chat. Deadline and review alerts clear when resolved. Recent assignments remain here for 7 days. These are in-app alerts; email and push delivery are not enabled.</p>
  </div>;
}
