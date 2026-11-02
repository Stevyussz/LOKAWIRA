// level & progres XP - rumus sama dgn kontrak ProfileResponse (level = floor(xp/150)+1)
export const XP_PER_LEVEL = 150;

export function levelProgress(xp: number) {
  const safe = Math.max(0, Math.floor(xp));
  const level = Math.floor(safe / XP_PER_LEVEL) + 1;
  const into = safe % XP_PER_LEVEL;
  return { level, into, needed: XP_PER_LEVEL - into, percent: Math.round((into / XP_PER_LEVEL) * 100) };
}
