/** Total data rows shown across Fresh + Saved on the home postings card. */
export const HOME_POSTINGS_TOTAL_ROWS = 12;

/** Mobile: fewer rows, natural height — no viewport-filling slot grid. */
export const HOME_MOBILE_POSTINGS_TOTAL_ROWS = 5;

/** Mobile sidebar sections (hot companies + alerts). */
export const HOME_MOBILE_SIDEBAR_TOTAL_ROWS = 4;

/**
 * Split a fixed row budget between Fresh and Saved (always sums to `totalSlots`
 * when either side has items). Starts 50/50; when one side has fewer items
 * than its half, the other side inherits the unused slot budget.
 */
export function splitHomePostingSlots(
  totalSlots: number,
  freshAvailable: number,
  savedAvailable: number,
): { freshSlots: number; savedSlots: number } {
  if (totalSlots <= 0 || (freshAvailable <= 0 && savedAvailable <= 0)) {
    return { freshSlots: 0, savedSlots: 0 };
  }

  if (freshAvailable <= 0) {
    return { freshSlots: 0, savedSlots: totalSlots };
  }

  if (savedAvailable <= 0) {
    return { freshSlots: totalSlots, savedSlots: 0 };
  }

  const half = Math.floor(totalSlots / 2);
  let freshSlots = half;
  let savedSlots = totalSlots - half;

  if (freshAvailable < freshSlots) {
    savedSlots += freshSlots - freshAvailable;
    freshSlots = freshAvailable;
  }

  if (savedAvailable < savedSlots) {
    freshSlots += savedSlots - savedAvailable;
    savedSlots = savedAvailable;
  }

  return { freshSlots, savedSlots };
}
