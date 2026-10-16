"use client";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Compass, CornerDownLeft, Download, LayoutGrid, Link2, ListChecks, Moon, Orbit, Plus, Route, Settings2 } from "lucide-react";
import type { Workspace } from "@/lib/domain/types";
import { confirmLeave } from "./ui";

type Item = { id: string; group: string; title: string; hint?: string; icon: ReactNode; run: () => void };

/** ⌘K: one keyboard-first entry point to every screen, section, open task and workspace action. */
type Props = { onClose: () => void; workspace: Workspace; base: string; actions: { copyLink: () => void; toggleTheme: () => void; preferences: () => void } };
export function CommandPalette({ open, ...props }: Props & { open: boolean }) {
  return <AnimatePresence>{open && <PaletteBody {...props}/>}</AnimatePresence>;
}

function download(href: string) { const a = document.createElement("a"); a.href = href; a.download = ""; document.body.append(a); a.click(); a.remove(); }

/** Mounted fresh on every open, so the query and selection always start empty. */
function PaletteBody({ onClose, workspace, base, actions }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const go = (href: string) => () => { if (confirmLeave()) router.push(href); };

  const items = useMemo<Item[]>(() => {
    const nav: Item[] = [
      { id: "o", group: "Go to", title: "Overview", hint: "G O", icon: <Orbit size={16}/>, run: go(base) },
      { id: "s", group: "Go to", title: "Strategy", hint: "G S", icon: <Compass size={16}/>, run: go(`${base}/strategy`) },
      { id: "d", group: "Go to", title: "Dashboard", hint: "G D", icon: <LayoutGrid size={16}/>, run: go(`${base}/dashboard`) },
      { id: "r", group: "Go to", title: "Roadmap", hint: "G R", icon: <Route size={16}/>, run: go(`${base}/roadmap`) },
    ];
    const sections: Item[] = workspace.completion.sections.map(s => ({
      id: `sec-${s.key}`, group: "Strategy sections", title: s.title, hint: s.complete ? "Complete" : `${s.missing.length} missing`,
      icon: <span className={`pal-dot ${s.complete ? "on" : ""}`}/>, run: go(`${base}/strategy?section=${s.key}`),
    }));
    const tasks: Item[] = workspace.tasks.filter(t => !t.archived && (t.status === "todo" || t.status === "in_progress")).sort((a, b) => a.week - b.week).map(t => ({
      id: `task-${t.id}`, group: "Open tasks", title: t.title, hint: `Week ${t.week}`, icon: <ListChecks size={16}/>, run: go(`${base}/roadmap#task-${t.id}`),
    }));
    const commands: Item[] = [
      { id: "add", group: "Actions", title: "Add a custom task", icon: <Plus size={16}/>, run: go(`${base}/roadmap?add=1`) },
      { id: "copy", group: "Actions", title: "Copy workspace link", icon: <Link2 size={16}/>, run: actions.copyLink },
      { id: "export", group: "Actions", title: "Export workspace as JSON", icon: <Download size={16}/>, run: () => download(`/api/startups/${workspace.startup.id}/export`) },
      { id: "theme", group: "Actions", title: "Toggle light / dark", icon: <Moon size={16}/>, run: actions.toggleTheme },
      { id: "custom", group: "Actions", title: "Customize dashboard", icon: <LayoutGrid size={16}/>, run: go(`${base}/dashboard?customize=1`) },
      { id: "prefs", group: "Actions", title: "Workspace preferences", hint: "?", icon: <Settings2 size={16}/>, run: actions.preferences },
    ];
    return [...nav, ...sections, ...tasks, ...commands];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace, base]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    const words = q.split(/\s+/);
    return items.filter(i => words.every(w => `${i.title} ${i.group} ${i.hint ?? ""}`.toLowerCase().includes(w)));
  }, [items, query]);

  useEffect(() => { requestAnimationFrame(() => input.current?.focus()); }, []);
  useEffect(() => { document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" }); }, [active, listId]);

  function run(item: Item | undefined) { if (!item) return; onClose(); item.run(); }
  function key(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(filtered.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); run(filtered[active]); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  }
  let lastGroup = "";
  return <motion.div className="palette-scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.12 } }}>
    <motion.div className="palette" role="dialog" aria-modal="true" aria-label="Command menu"
      initial={{ opacity: 0, y: -16, scale: 0.97, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.12 } }} transition={{ type: "spring", stiffness: 480, damping: 34 }}>
      <div className="palette-input">
        <ArrowRight size={18} aria-hidden/>
        <input ref={input} value={query} onChange={e => { setQuery(e.target.value); setActive(0); }} onKeyDown={key} placeholder="Jump to a screen, section, task or action…"
          role="combobox" aria-expanded="true" aria-controls={listId} aria-activedescendant={filtered.length ? `${listId}-${active}` : undefined} aria-label="Search commands"/>
        <kbd>Esc</kbd>
      </div>
      <ul className="palette-list" id={listId} role="listbox" aria-label="Results">
        {filtered.map((item, i) => {
          const header = item.group !== lastGroup ? item.group : null; lastGroup = item.group;
          return <li key={item.id} role="presentation">
            {header && <p className="palette-group" aria-hidden>{header}</p>}
            <div id={`${listId}-${i}`} role="option" aria-selected={i === active} className={`palette-item ${i === active ? "active" : ""}`}
              onMouseMove={() => setActive(i)} onClick={() => run(item)}>
              {i === active && <motion.span layoutId="palette-active" className="palette-active" transition={{ type: "spring", stiffness: 600, damping: 40 }}/>}
              <span className="palette-icon" aria-hidden>{item.icon}</span>
              <span className="palette-title">{item.title}</span>
              {item.hint && <span className="palette-hint">{item.hint}</span>}
              {i === active && <CornerDownLeft size={14} className="palette-enter" aria-hidden/>}
            </div>
          </li>;
        })}
        {!filtered.length && <li className="palette-empty">Nothing matches “{query}”.</li>}
      </ul>
    </motion.div>
  </motion.div>;
}
