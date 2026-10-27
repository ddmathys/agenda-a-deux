import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { useAuth, useEvents, useHousehold, useTasks } from './data';
import { AddSheet, type SheetMode } from './screens/AddSheet';
import { Today } from './screens/Today';
import { Upcoming } from './screens/Upcoming';
import { Year } from './screens/Year';
import { Birthdays } from './screens/Birthdays';
import { Vacations } from './screens/Vacations';
import { Login, Setup } from './screens/Welcome';
import { ShareSheet } from './screens/Share';
import { IdeasSheet, type Slot } from './screens/Ideas';
import { ProfileSheet } from './screens/Profile';
import { CocoHello } from './screens/CocoHello';
import { useForecast } from './weather';
import { Chat } from './screens/Chat';
import { clearInvite } from './invite';
import type { EventItem, Household, Task } from './types';
import { Nav, scrollToTop, type Tab } from './ui';

export function App() {
  const user = useAuth();
  const house = useHousehold(user?.uid);

  if (user === undefined) return <Splash />;
  if (user === null) return <Login />;
  if (house === undefined) return <Splash />;
  if (house === null) return <Setup user={user} />;
  return <Shell h={house} user={user} />;
}

function Shell({ h, user }: { h: Household; user: User }) {
  const [tab, setTab] = useState<Tab>('today');
  const [sheet, setSheet] = useState<SheetMode | null>(null);
  const [sharing, setSharing] = useState(false);
  const [upDay, setUpDay] = useState<string | undefined>(undefined);
  const [chat, setChat] = useState(false);
  const [profile, setProfile] = useState(false);
  const hello = useHello();
  const [ideas, setIdeas] = useState<{ day: string; slot: Slot } | null>(null);
  const forecast = useForecast(h.home);
  const events = useEvents(h.id);
  const tasks = useTasks(h.id);
  const me = user.uid;

  // Déjà dans un agenda : un lien d'invitation ouvert plus tard ne sert plus.
  useEffect(clearInvite, []);

  const edit = {
    onEditTask: (task: Task) => setSheet({ kind: 'task', task }),
    onEditEvent: (ev: EventItem) => setSheet({ kind: 'event', ev }),
  };

  const go = (t: Tab, day?: string) => {
    setUpDay(day);
    setTab(t);
    scrollToTop();
  };

  return (
    <div className="app">
      {tab === 'today' && <Today h={h} me={me} events={events} tasks={tasks} onTab={go} onAdd={(date) => setSheet({ kind: 'new', date })} onShare={() => setSharing(true)} forecast={forecast} onProfile={() => setProfile(true)} onIdeas={(day, slot) => setIdeas({ day, slot })} {...edit} />}
      {tab === 'upcoming' && <Upcoming key={upDay ?? 'today'} h={h} events={events} tasks={tasks} day={upDay} {...edit} />}
      {tab === 'year' && <Year h={h} me={me} events={events} tasks={tasks} {...edit} />}
      {tab === 'birthdays' && (
        <Birthdays h={h} events={events} onBack={() => go('today')} onAdd={() => setSheet({ kind: 'new', preset: 'bday' })} onEditEvent={edit.onEditEvent} />
      )}
      {tab === 'vacations' && (
        <Vacations h={h} me={me} events={events} onBack={() => go('today')} onAdd={() => setSheet({ kind: 'new', preset: 'vac' })} onEditEvent={edit.onEditEvent} />
      )}
      <Nav tab={tab} onTab={(t) => go(t)} onAdd={() => setSheet({ kind: 'new' })} onChat={() => setChat(true)} />
      {profile && <ProfileSheet h={h} me={me} forecast={forecast} onShare={() => { setProfile(false); setSharing(true); }} onClose={() => setProfile(false)} />}
      {hello.on && !chat && !sheet && (
        <CocoHello h={h} me={me} events={events} tasks={tasks} forecast={forecast} onClose={hello.close} onChat={() => { hello.close(); setChat(true); }} />
      )}
      {chat && <Chat h={h} me={me} onClose={() => setChat(false)} />}
      {sharing && <ShareSheet h={h} me={me} onClose={() => setSharing(false)} />}
      {ideas && <IdeasSheet key={ideas.day + ideas.slot} h={h} me={me} day={ideas.day} slot={ideas.slot} forecast={forecast} onClose={() => setIdeas(null)} />}
      {sheet && (
        <AddSheet
          key={sheet.kind === 'new' ? 'new' : sheet.kind === 'task' ? sheet.task.id : sheet.ev.id}
          h={h}
          me={me}
          events={events}
          mode={sheet}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}

/**
 * Coco dit bonjour à chaque ouverture de l'app (ou au retour après une demi-heure ailleurs),
 * un court instant après le démarrage pour laisser l'agenda se charger.
 */
function useHello() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const KEY = 'coco-hello-at';
    const maybe = () => {
      let last = 0;
      try {
        last = Number(localStorage.getItem(KEY) ?? 0);
      } catch {
        /* rien */
      }
      if (Date.now() - last < 30 * 60 * 1000) return;
      try {
        localStorage.setItem(KEY, String(Date.now()));
      } catch {
        /* rien */
      }
      setTimeout(() => setOn(true), 700);
    };
    maybe();
    const vis = () => {
      if (document.visibilityState === 'visible') maybe();
    };
    document.addEventListener('visibilitychange', vis);
    return () => document.removeEventListener('visibilitychange', vis);
  }, []);
  return { on, close: () => setOn(false) };
}

function Splash() {
  return <div className="splash" aria-busy="true"><span className="b-sun" /></div>;
}
