// results.js — score screen shown right after a quiz is submitted
(function () {
  const session = requireLogin();
  if (!session) return;
  renderHeader({ active: 'practice' });

  let result = null;
  try {
    result = JSON.parse(sessionStorage.getItem('cobalt_last_result'));
  } catch {
    result = null;
  }

  // Nothing to show (e.g. opened directly) — back to the dashboard.
  if (!result) {
    window.location.replace('dashboard.html');
    return;
  }

  const pct = parseFloat(result.percentage) || 0;
  const pctClass = pct >= 70 ? 'pct-good' : pct >= 40 ? 'pct-mid' : 'pct-bad';

  const big = document.getElementById('result-pct');
  big.textContent = result.percentage;
  big.classList.add(pctClass);

  document.getElementById('result-detail').textContent = `${result.score} correct out of ${result.total}`;

  const timeEl = document.getElementById('result-time');
  if (typeof result.time_used_seconds === 'number') {
    let text = `Time used: ${formatDuration(result.time_used_seconds)}`;
    if (result.timed_out) text += ' · submitted automatically when time ran out';
    timeEl.textContent = text;
  } else {
    timeEl.classList.add('hidden');
  }

  document.getElementById('result-subjects').replaceChildren(
    ...(result.subjects || []).map((s) => el('span', { class: 'chip', text: s }))
  );
})();
