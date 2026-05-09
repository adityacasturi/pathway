export function preserveScrollPositionIfScrollable() {
  if (typeof window === "undefined") return;

  const startX = window.scrollX;
  const startY = window.scrollY;

  function restore() {
    const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    if (maxY <= 0) return;
    window.scrollTo(startX, Math.min(startY, maxY));
  }

  requestAnimationFrame(restore);
  requestAnimationFrame(() => requestAnimationFrame(restore));
  window.setTimeout(restore, 80);
  window.setTimeout(restore, 180);
}
