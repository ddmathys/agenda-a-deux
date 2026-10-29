/** Propriétaire d'un élément : l'uid d'un des deux membres, ou « both » pour « Nous ». */
export type Owner = string;

/** Répétition d'un événement : une seule fois, chaque jour, chaque semaine ou chaque mois. */
export type Repeat = 'none' | 'day' | 'week' | 'month';

export interface Person {
  name: string;
  slot: 0 | 1;
  email?: string;
}

export interface ListDef {
  id: string;
  name: string;
  bg: string;
  fg: string;
  icon: string;
}

/** Où habite le couple : pour la météo et les idées de sorties. */
export interface Home {
  name: string;
  region?: string;
  lat: number;
  lon: number;
}

export interface Household {
  id: string;
  members: string[];
  people: Record<string, Person>;
  lists: ListDef[];
  home?: Home;
}

/** Une idée de sortie proposée pour un jour libre. */
export interface Idea {
  emoji: string;
  title: string;
  why: string;
  place: string;
  start: string | null;
  duration: number; // minutes
  cost: string;
  indoor: boolean;
}

export interface Ideas {
  day: string;
  slot: 'day' | 'evening';
  home?: string; // ville pour laquelle ces idées ont été trouvées
  weather: { code: number; tmax: number; tmin: number; rain: number } | null;
  items: Idea[];
  chosen: number | null;
}

export interface EventItem {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  start: string | null; // HH:MM
  end: string | null;
  place: string;
  owner: Owner;
  repeat?: Repeat; // pour mémoire : comment la série a été créée
  seriesId?: string | null; // même valeur sur toutes les dates d'une série
  gcalId?: string | null; // id dans le Google Agenda de gcalOwner
  gcalOwner?: string | null;
  gcalSeries?: boolean; // gcalId désigne un événement récurrent Google (toute la série)
  birthday?: boolean; // anniversaire : revient chaque année au même jour (date = naissance)
  vacation?: boolean; // vacances : une seule fiche, du jour « date » au jour « dateEnd »
  dateEnd?: string | null; // YYYY-MM-DD, dernier jour inclus (vacances)
  remind?: number; // rappel en minutes avant (0 = aucun ; absent = 1 h avant, ou 8 h le jour même sans heure)
}

export interface Task {
  id: string;
  title: string;
  list: string;
  due: string | null; // YYYY-MM-DD
  time: string | null;
  owner: Owner;
  done: boolean;
  doneOn: string | null;
}

/** Sorte d'échéance : un abonnement, une assurance, un contrat, un entretien ou des papiers. */
export type DeadlineKind = 'abo' | 'assurance' | 'contrat' | 'entretien' | 'admin';

/**
 * Une échéance du foyer : abonnement, contrat, entretien… qui revient tous les `every` mois.
 * `next` est la prochaine date (renouvellement, fin de contrat, entretien à faire).
 * Avec un préavis, il faut résilier `notice` mois avant `next`.
 */
export interface Deadline {
  id: string;
  title: string;
  provider: string;
  kind: DeadlineKind;
  amount: number | null; // CHF
  per: 'month' | 'year'; // le montant est par mois ou par an
  every: number; // mois entre deux échéances ; 0 = une seule fois
  next: string; // YYYY-MM-DD
  notice: number; // préavis en mois (0 = aucun)
  owner: Owner;
  note: string;
  comments?: DeadlineComment[];
}

/** Un commentaire laissé sur une échéance (« appelé Zurich, offre à 820.- »…). */
export interface DeadlineComment {
  by: string; // uid
  at: string; // ISO
  text: string;
}

export const DEFAULT_LISTS: ListDef[] = [
  { id: 'maison', name: 'Maison', bg: '#FF7A1A', fg: '#17162B', icon: 'M4 11l8-6.5 8 6.5M6 9.5V20h12V9.5M10 20v-5h4v5' },
  { id: 'courses', name: 'Courses', bg: '#2BD4A0', fg: '#17162B', icon: 'M5 7h14l-1.5 11h-11zM9 7a3 3 0 0 1 6 0' },
  { id: 'enfants', name: 'Enfants', bg: '#FFC530', fg: '#17162B', icon: 'M12 4.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM6 20c0-3.3 2.7-6 6-6s6 2.7 6 6' },
  { id: 'admin', name: 'Admin & papiers', bg: '#7048E8', fg: '#FFFFFF', icon: 'M7 3.5h7l4 4V20.5H7zM14 3.5v4h4M10 12h5M10 16h5' },
];
