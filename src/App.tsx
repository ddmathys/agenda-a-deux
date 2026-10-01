import { useState } from 'react';
import type { User } from 'firebase/auth';
import { useAuth, useEvents, useHousehold, useTasks } from './data';
import { AddSheet, type SheetMode } from './screens/AddSheet';
import { Today } from './screens/Today';
import { Upcoming } from './screens/Upcoming';
import { Login, Setup } from './screens/Welcome';
import type { EventItem, Household, Task } from './types';
import { Nav, type Tab } from './ui';

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
  const events = useEvents(h.id);
  const tasks = useTasks(h.id);
  const me = user.uid;

  const edit = {
    onEditTask: (task: Task) => setSheet({ kind: 'task', task }),
    onEditEvent: (ev: EventItem) => setSheet({ kind: 'event', ev }),
  };

  const go = (t: Tab) => {
    setTab(t);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="app">
      {tab === 'today' && <Today h={h} me={me} events={events} tasks={tasks} onTab={go} {...edit} />}
      {tab === 'upcoming' && <Upcoming h={h} events={events} tasks={tasks} {...edit} />}
      <Nav tab={tab} onTab={go} onAdd={() => setSheet({ kind: 'new' })} />
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
