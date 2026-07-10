'use client';

import { useState, useEffect } from 'react';

const DAYS = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];

export function useClock() {
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const h = now.getHours();
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      const ampm = h >= 12 ? 'PTG' : 'PG';
      const h12 = h % 12 || 12;
      setTime(`${h12}:${m}:${s} ${ampm}`);
      setDate(`${DAYS[now.getDay()]}, ${now.toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return { time, date };
}
