export const calculateEntitlement = (
  startDate: string | null | undefined,
  leaveTiers?: { tier1: number; tier2: number; tier3: number }
) => {
  if (!startDate) return 0;
  const start = new Date(startDate);
  if (isNaN(start.getTime())) return 0;

  const diffYears = Math.floor(Math.abs(new Date().getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
  let total = 0;
  
  const t1 = leaveTiers?.tier1 || 16;
  const t2 = leaveTiers?.tier2 || 20;
  const t3 = leaveTiers?.tier3 || 26;

  for (let i = 1; i <= diffYears; i++) {
    if (i <= 5) total += t1;
    else if (i <= 15) total += t2;
    else total += t3;
  }
  return total;
};

export const calculateUsedLeave = (movements: any[]) => {
  if (!movements || !Array.isArray(movements)) return 0;
  
  return movements.filter((m: any) => {
    const t = (m.type || m.movement_type || '').toUpperCase();
    return t === 'Y' || t.includes('YILLIK İZİN') || t.includes('YILLIK') || t.includes('YILLIK_IZIN') || t.includes('YILLIK IZIN');
  }).reduce((sum: number, m: any) => sum + Number(m.total_days || 1), 0);
};
