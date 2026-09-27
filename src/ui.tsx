import type { ReactNode } from 'react';
import { dueLabel } from './dates';
import { toneOf } from './tones';
import type { Household, Task } from './types';

export type Tab = 'today' | 'upcoming';

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export const Icon = {
  sun: <svg width="24" height="24" viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>,
  cal: <svg width="24" height="24" viewBox="0 0 24 24" {...stroke}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>,
  plus: <svg width="26" height="26" viewBox="0 0 24 24" {...stroke} strokeWidth={2.6}><path d="M12 5v14M5 12h14" /></svg>,
  plusSm: <svg width="22" height="22" viewBox="0 0 24 24" {...stroke} strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>,
  check: <svg width="14" height="14" viewBox="0 0 24 24" {...stroke} stroke="#FFFFFF" strokeWidth={3.2}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>,
  left: <svg width="20" height="20" viewBox="0 0 24 24" {...stroke} strokeWidth={2.4}><path d="M15 5l-7 7 7 7" /></svg>,
  right: <svg width="20" height="20" viewBox="0 0 24 24" {...stroke} strokeWidth={2.4}><path d="M9 5l7 7-7 7" /></svg>,
  close: <svg width="18" height="18" viewBox="0 0 24 24" {...stroke} strokeWidth={2.6}><path d="M6 6l12 12M18 6L6 18" /></svg>,
  pin: <svg width="13" height="13" viewBox="0 0 24 24" {...stroke} strokeWidth={2.2}><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>,
  mic: <svg width="18" height="18" viewBox="0 0 24 24" {...stroke} strokeWidth={2.2}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></svg>,
  spark: <svg width="15" height="15" viewBox="0 0 24 24" {...stroke} strokeWidth={2.2}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></svg>,
  share: <svg width="18" height="18" viewBox="0 0 24 24" {...stroke} strokeWidth={2.2}><path d="M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></svg>,
};

export function Nav({ tab, onTab, onAdd }: { tab: Tab; onTab: (t: Tab) => void; onAdd: () => void }) {
  const item = (id: Tab, label: string, icon: ReactNode) => (
    <button className={`nav-item${tab === id ? ' on' : ''}`} onClick={() => onTab(id)} aria-current={tab === id ? 'page' : undefined}>
      {icon}
      <span>{label}</span>
    </button>
  );
  return (
    <nav className="nav" aria-label="Navigation">
      {item('today', "Aujourd'hui", Icon.sun)}
      <button className="nav-add" aria-label="Ajouter" onClick={onAdd}>{Icon.plus}</button>
      {item('upcoming', 'À venir', Icon.cal)}
    </nav>
  );
}

export function Avatar({ h, owner, size = 30, soft = false }: { h: Household; owner: string; size?: number; soft?: boolean }) {
  const t = toneOf(h, owner);
  return (
    <span
      className="avatar"
      title={t.name}
      style={{ width: size, height: size, fontSize: size * 0.43, background: soft ? t.s : t.c, color: soft ? t.t : '#FFFFFF' }}
    >
      {t.initial}
    </span>
  );
}

export function Check({ h, task, onToggle, square = false }: { h: Household; task: Task; onToggle: () => void; square?: boolean }) {
  const t = toneOf(h, task.owner);
  return (
    <button className="check" onClick={onToggle} aria-label={`${task.done ? 'Rouvrir' : 'Terminer'} : ${task.title}`}>
      <span className="box" style={{ borderColor: t.c, background: task.done ? t.c : '#FFFFFF', borderRadius: square ? 7 : '50%' }}>
        {task.done && Icon.check}
      </span>
    </button>
  );
}

export function DueChip({ task, h, personTone = false }: { task: Task; h: Household; personTone?: boolean }) {
  const label = dueLabel(task.due) + (task.time && task.due ? ` · ${task.time}` : '');
  let bg = '#FFF3CC';
  let fg = '#7A5500';
  if (personTone) {
    const t = toneOf(h, task.owner);
    bg = t.s;
    fg = t.t;
  } else if (!task.due) {
    bg = '#F1E8DA';
    fg = '#5F5B73';
  } else if (label.startsWith('En retard') || label.startsWith("Aujourd'hui")) {
    bg = '#FFE3E7';
    fg = '#A81D33';
  }
  if (task.done) {
    bg = '#F1E8DA';
    fg = '#6B6680';
  }
  return <span className="chip" style={{ background: bg, color: fg }}>{label}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}
