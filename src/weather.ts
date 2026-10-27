import { useEffect, useState } from 'react';
import type { Home } from './types';

/**
 * Météo des 10 prochains jours chez le couple (Open-Meteo : gratuit, sans clé).
 * Gardée une heure dans le téléphone pour ne pas la redemander à chaque ouverture.
 */

export interface DayWeather {
  code: number;
  tmax: number;
  tmin: number;
  rain: number; // probabilité de pluie, %
}

export type Forecast = Record<string, DayWeather>;

/** Code météo WMO → pictogramme, mot simple, et « beau temps pour sortir ? » */
export function wmo(code: number): { emoji: string; label: string; nice: boolean } {
  if (code === 0) return { emoji: '☀️', label: 'grand soleil', nice: true };
  if (code <= 2) return { emoji: '🌤️', label: 'plutôt ensoleillé', nice: true };
  if (code === 3) return { emoji: '☁️', label: 'couvert', nice: false };
  if (code <= 48) return { emoji: '🌫️', label: 'brouillard', nice: false };
  if (code <= 57) return { emoji: '🌦️', label: 'bruine', nice: false };
  if (code <= 67) return { emoji: '🌧️', label: 'pluie', nice: false };
  if (code <= 77) return { emoji: '❄️', label: 'neige', nice: false };
  if (code <= 82) return { emoji: '🌦️', label: 'averses', nice: false };
  if (code <= 86) return { emoji: '🌨️', label: 'averses de neige', nice: false };
  return { emoji: '⛈️', label: 'orages', nice: false };
}

/** Beau temps pour une sortie dehors : soleil et peu de risque de pluie. */
export const isNice = (w: DayWeather) => wmo(w.code).nice && w.rain < 40;

const TTL = 60 * 60 * 1000;

export function useForecast(home: Home | undefined): Forecast | null {
  const key = home ? `meteo-${home.lat.toFixed(2)},${home.lon.toFixed(2)}` : '';
  const [data, setData] = useState<Forecast | null>(() => {
    if (!key) return null;
    try {
      const c = JSON.parse(localStorage.getItem(key) ?? 'null');
      return c?.data ?? null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!home) return;
    try {
      const c = JSON.parse(localStorage.getItem(key) ?? 'null');
      if (c && Date.now() - c.at < TTL) {
        setData(c.data);
        return;
      }
    } catch {
      /* cache illisible : on recharge */
    }
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${home.lat}&longitude=${home.lon}`
      + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max'
      + '&timezone=Europe%2FZurich&forecast_days=10';
    let alive = true;
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j?.daily || !alive) return;
        const d = j.daily;
        const out: Forecast = {};
        d.time.forEach((t: string, i: number) => {
          out[t] = {
            code: d.weather_code[i],
            tmax: Math.round(d.temperature_2m_max[i]),
            tmin: Math.round(d.temperature_2m_min[i]),
            rain: d.precipitation_probability_max[i] ?? 0,
          };
        });
        setData(out);
        try {
          localStorage.setItem(key, JSON.stringify({ at: Date.now(), data: out }));
        } catch {
          /* pas de cache : tant pis */
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [key, home]);

  return data;
}

/** Recherche d'une ville (géocodage Open-Meteo), la Suisse d'abord. */
export async function searchPlace(q: string): Promise<Home[]> {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=fr&format=json`);
  if (!r.ok) return [];
  const j = await r.json();
  const list: Home[] = (j.results ?? []).map((p: { name: string; admin1?: string; country_code?: string; latitude: number; longitude: number }) => ({
    name: p.name,
    region: [p.admin1, p.country_code !== 'CH' ? p.country_code : ''].filter(Boolean).join(', '),
    lat: Math.round(p.latitude * 1000) / 1000,
    lon: Math.round(p.longitude * 1000) / 1000,
    ch: p.country_code === 'CH',
  }));
  return list.sort((a, b) => Number((b as Home & { ch: boolean }).ch) - Number((a as Home & { ch: boolean }).ch)).map(({ name, region, lat, lon }) => ({ name, region, lat, lon }));
}
