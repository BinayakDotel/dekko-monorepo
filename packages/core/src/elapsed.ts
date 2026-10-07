const MS_PER_S = 1000;
const S_PER_MIN = 60;
const MIN_PER_H = 60;

/** Wall-clock elapsed label for the done screen. */
export function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / MS_PER_S);
  if (totalSec < S_PER_MIN) return `${totalSec} s`;

  const totalMin = Math.floor(totalSec / S_PER_MIN);
  if (totalMin < MIN_PER_H) {
    const sec = totalSec % S_PER_MIN;
    return `${totalMin} min ${sec} s`;
  }

  const hours = Math.floor(totalMin / MIN_PER_H);
  const min = totalMin % MIN_PER_H;
  return `${hours} h ${min} min`;
}
