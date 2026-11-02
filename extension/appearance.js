const ACCENT_KEY = 'preference:accent';
const DEFAULT_ACCENT = '#2f6b57';
const validColor = color => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color);

// Keep appearance state separate from note editing and its save status.
export function initAppearance(storage, items) {
  const root = document.documentElement;
  const picker = document.getElementById('accent-color');
  const eyedropper = document.getElementById('pick-color');
  const reset = document.getElementById('reset-color');
  const status = document.getElementById('color-status');
  let pending = Promise.resolve();
  let revision = 0;

  function apply(color) {
    const custom = validColor(color);
    root.toggleAttribute('data-custom-accent', custom);
    if (custom) root.style.setProperty('--chosen-accent', color);
    else root.style.removeProperty('--chosen-accent');
    picker.value = custom ? color : DEFAULT_ACCENT;
    reset.disabled = !custom;
  }

  function save(color) {
    if (color !== null && !validColor(color)) return;
    apply(color);
    const version = ++revision;
    status.textContent = 'Saving color…';
    // Serialize changes so a slower earlier write cannot replace a later color.
    pending = pending.catch(() => {}).then(() => color === null
      ? storage.remove(ACCENT_KEY) : storage.set({ [ACCENT_KEY]: color }));
    pending.then(() => {
      if (version === revision) status.textContent = 'Saved. Follows light and dark mode.';
    }, () => {
      if (version === revision) status.textContent = "Couldn't save color. Please try again.";
    });
  }

  picker.addEventListener('input', () => {
    ++revision;
    apply(picker.value);
    status.textContent = 'Previewing color.';
  });
  picker.addEventListener('change', () => save(picker.value));
  reset.addEventListener('click', () => save(null));
  eyedropper.hidden = typeof window.EyeDropper !== 'function';
  eyedropper.addEventListener('click', async () => {
    ++revision;
    eyedropper.disabled = true;
    status.textContent = 'Click a color anywhere on screen. Press Esc to cancel.';
    try {
      const { sRGBHex } = await new window.EyeDropper().open();
      save(sRGBHex);
    } catch (error) {
      status.textContent = error?.name === 'AbortError'
        ? 'Canceled. Your color is unchanged.' : "Couldn't pick a screen color. Try the color swatch instead.";
    } finally {
      eyedropper.disabled = false;
    }
  });

  apply(items[ACCENT_KEY]);
  picker.disabled = false;
  eyedropper.disabled = false;
}
