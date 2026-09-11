"use client";
import { useEffect, useRef, type ReactNode } from "react";

export default function TaskDetailsPanel({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => { element?.close(); document.body.style.overflow = previousOverflow; };
  }, []);
  return <dialog ref={dialog} aria-labelledby="task-details-heading" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-full max-w-none border-0 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-black/40 sm:w-[min(760px,90vw)]">
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4"><h2 id="task-details-heading" className="font-bold">Task details</h2><button autoFocus type="button" aria-label="Close task details" onClick={onClose} className="rounded-lg px-3 py-1 text-xl text-slate-500 hover:bg-slate-100">×</button></header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
    </div>
  </dialog>;
}
