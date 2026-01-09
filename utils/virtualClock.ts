// utils/virtualClock.ts
export function addDaysISO(iso: string, days: number): string {
    const d = new Date(iso);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString();
  }
  export function todayISO(): string {
    return new Date().toISOString();
  }
  