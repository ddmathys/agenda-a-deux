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
import { IdeasSheet, LocationSheet, type Slot } from './screens/Ideas';
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
  const [place, setPlace] = useState(false);
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
      {tab === 'today' && <Today h={h} me={me} events={events} tasks={tasks} onTab={go} onAdd={(date) => setSheet({ kind: 'new', date })} onShare={() => setSharing(true)} forecast={forecast} onPlace={() => setPlace(true)} onIdeas={(day, slot) => setIdeas({ day, slot })} {...edit} />}
      {tab === 'upcoming' && <Upcoming key={upDay ?? 'today'} h={h} events={events} tasks={tasks} day={upDay} {...edit} />}
      {tab === 'year' && <Year h={h} me={me} events={events} tasks={tasks} {...edit} />}
      {tab === 'birthdays' && (
        <Birthdays h={h} events={events} onBack={() => go('today')} onAdd={() => setSheet({ kind: 'new', preset: 'bday' })} onEditEvent={edit.onEditEvent} />
      )}
      {tab === 'vacations' && (
        <Vacations h={h} me={me} events={events} onBack={() => go('today')} onAdd={() => setSheet({ kind: 'new', preset: 'vac' })} onEditEvent={edit.onEditEvent} />
      )}
      <Nav tab={tab} onTab={(t) => go(t)} onAdd={() => setSheet({ kind: 'new' })} onChat={() => setChat(true)} />
      {place && <LocationSheet h={h} forecast={forecast} onClose={() => setPlace(false)} />}
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

function Splash() {
  return <div className="splash" aria-busy="true"><span className="b-sun" /></div>;
}
