/**
 * Purely decorative: drives the progress ring around the rep counter.
 *
 * Deliberately isolated from main.ts's session logic — it only ever READS the
 * rep-done / rep-target text nodes that main.ts already writes, via a
 * MutationObserver, and writes a single CSS custom property back. It cannot
 * affect counting, coaching, or session state, so it carries none of the risk
 * of touching the engine wiring.
 */

const done = document.getElementById('rep-done');
const target = document.getElementById('rep-target');
const unit = document.getElementById('counter-unit');

if (done && target && unit) {
  const update = () => {
    // In calibration mode the counter shows a live angle, not a rep count —
    // there is no meaningful "progress" to ring, so leave it at the resting
    // faint track rather than showing a misleading fill.
    if (!unit.hidden) {
      document.documentElement.style.setProperty('--ring-progress', '0');
      return;
    }

    const n = Number(done.textContent);
    const d = Number(target.textContent);
    const ratio = d > 0 && Number.isFinite(n) ? Math.min(1, Math.max(0, n / d)) : 0;
    document.documentElement.style.setProperty('--ring-progress', ratio.toFixed(4));
  };

  const observer = new MutationObserver(update);
  for (const el of [done, target, unit]) {
    observer.observe(el, { childList: true, characterData: true, subtree: true, attributes: true });
  }

  update();
}
