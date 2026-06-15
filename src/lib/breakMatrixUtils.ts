export const calculateBreakMatrix = (
  personnelData: any[],
  shiftsData: any[],
  settings: any,
  selectedDate: string
) => {
  if (!personnelData || !shiftsData || !settings?.slots || !settings?.departmentGroups) {
    return null;
  }

  const dayOfWeek = new Date(selectedDate).getDay();
  const dayType = (dayOfWeek === 0 || dayOfWeek === 6) ? 'weekend' : 'weekday';

  // 1. Get today's shifts
  const todayShifts = shiftsData.filter((s: any) => s.shift_date === selectedDate);
  
  // 2. Map personnel to groups and shifts
  const groups: Record<string, { total: any[], name: string, criticalLimit: number }> = {};
  settings.departmentGroups.forEach((g: any) => {
    const limit = dayType === 'weekend' 
      ? (g.criticalLimitWeekend ?? g.criticalLimit ?? 1) 
      : (g.criticalLimitWeekday ?? g.criticalLimit ?? 1);
    groups[g.id] = { total: [], name: g.name, criticalLimit: limit };
  });

  personnelData.forEach(p => {
    const shift = todayShifts.find((s: any) => s.personnel_id === p.id);
    if (!shift || !shift.shift_type || shift.shift_type === '-') return;

    const cleanVal = shift.shift_type.split('+')[0].trim().toUpperCase();
    
    // Check if this shift type is in the excluded movement types list
    if (settings.excludedMovementTypes && settings.excludedMovementTypes.includes(cleanVal)) {
      return;
    }

    // Determine group
    let groupId = 'other';
    for (const g of settings.departmentGroups) {
      if (g.includedPersonnelIds && g.includedPersonnelIds.length > 0) {
        if (g.includedPersonnelIds.includes(p.id)) {
          groupId = g.id;
          break;
        }
      } else if (g.includedDepartments) {
        // Fallback to old behavior
        if (g.includedDepartments.some((d: string) => p.department?.toUpperCase().includes(d.toUpperCase()))) {
          groupId = g.id;
          break;
        }
      }
    }

    const upVal = shift.shift_type.toUpperCase();
    let category = 'DİĞER';
    if (cleanVal === 'S' || cleanVal === 'SABAH') category = 'SABAH';
    else if (cleanVal === 'A' || cleanVal === 'AKŞAM') category = 'AKŞAM';
    else {
      const match = cleanVal.match(/^(\d{1,2})[.:]/);
      if (match) {
        const hour = parseInt(match[1], 10);
        if (hour < 13) category = 'SABAH';
        else category = 'AKŞAM';
      }
    }

    const pData = { ...p, shiftVal: shift.shift_type, category };
    if (groups[groupId]) groups[groupId].total.push(pData);
  });

  // 3. Initialize matrix slots
  const slots = settings.slots.map((s: any) => ({ ...s, assignments: {} }));
  
  // 4. Distribute per group
  Object.keys(groups).forEach(groupId => {
    const g = groups[groupId];
    
    // Initialize slot assignments for this group
    slots.forEach((s: any) => { s.assignments[groupId] = []; });

    g.total.forEach(p => {
      // Find matching slots based on rules
      const rulesForDay = (settings.rules || []).filter((r: any) => r.dayType === dayType);
      const validSlots = slots.filter((s: any) => {
        const rule = rulesForDay.find((r: any) => r.slotId === s.id);
        if (!rule) return false;
        return rule.targetShifts.includes('ALL') || rule.targetShifts.some((ts: string) => p.category.includes(ts) || p.shiftVal.toUpperCase().includes(ts));
      });

      if (validSlots.length > 0) {
        // Balance: find the valid slot with the minimum people from this group
        validSlots.sort((a: any, b: any) => a.assignments[groupId].length - b.assignments[groupId].length);
        validSlots[0].assignments[groupId].push(p);
      } else if (slots.length > 0) {
        // Fallback: put in the slot with minimum overall people
        const sortedSlots = [...slots].sort((a: any, b: any) => a.assignments[groupId].length - b.assignments[groupId].length);
        sortedSlots[0].assignments[groupId].push(p);
      }
    });
  });

  return { groups, slots };
};

export const getPersonnelAssignedSlot = (matrix: any, personnelId: string) => {
  if (!matrix || !matrix.slots) return null;

  for (const slot of matrix.slots) {
    for (const groupId in slot.assignments) {
      const assignedPeople = slot.assignments[groupId];
      if (assignedPeople.some((p: any) => p.id === personnelId)) {
        return slot;
      }
    }
  }
  return null;
};

export const checkBreakViolation = (breakStartStr: string, assignedSlotTimeRange: string, toleranceMinutes: number = 5): 'early' | 'late' | 'none' => {
  if (!breakStartStr || !assignedSlotTimeRange) return 'none';
  
  // timeRange is like "13:30 - 14:00"
  const startStr = assignedSlotTimeRange.split('-')[0]?.trim();
  if (!startStr || !startStr.includes(':')) return 'none';
  
  const [slotHour, slotMin] = startStr.split(':').map(Number);
  if (isNaN(slotHour) || isNaN(slotMin)) return 'none';
  
  const breakStart = new Date(breakStartStr);
  if (isNaN(breakStart.getTime())) return 'none';
  
  // Create a date object for the slot start on the same day as break_start
  const slotStart = new Date(breakStart);
  slotStart.setHours(slotHour, slotMin, 0, 0);
  
  const diffMinutes = (breakStart.getTime() - slotStart.getTime()) / (1000 * 60);
  
  if (diffMinutes < -toleranceMinutes) return 'early';
  if (diffMinutes > toleranceMinutes) return 'late';
  return 'none';
};
