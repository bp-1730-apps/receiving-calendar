/* ════════════════════════════════════════════════════════════
   MERIDIAN — Receiving Calendar · script.js
   Backend: Supabase (PostgreSQL + Realtime)
   Table:   deliveries
════════════════════════════════════════════════════════════ */

/* ── Supabase client ─────────────────────────────────────── */
const SUPABASE_URL = 'https://fcaluuhfmexzeykxhcgp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjYWx1dWhmbWV4emV5a3hoY2dwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwOTg3MjIsImV4cCI6MjA5MzY3NDcyMn0.mSzLJnWzPVTQcGGhimK2uWTEdtUzL1KJ63XTcQYLouY';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* ════════════════════════════════════════════════
   §1 · DATE UTILITIES
════════════════════════════════════════════════ */

function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfWeek(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function addMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}

function isToday(date) {
  return isSameDay(date, new Date());
}

function toLocalDT(date, hours, minutes) {
  const d = new Date(date);
  if (hours !== undefined) d.setHours(hours, minutes || 0, 0, 0);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function parseLocalDT(str) {
  if (!str) return null;
  const [datePart, timePart = '00:00'] = str.split('T');
  const [y, mo, day] = datePart.split('-').map(Number);
  const [hr, mi]     = timePart.split(':').map(Number);
  return new Date(y, mo - 1, day, hr, mi, 0, 0);
}

function formatHour(h) {
  if (h === 0)  return '12 AM';
  if (h < 12)  return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

function formatTime(dtStr) {
  const d = parseLocalDT(dtStr);
  if (!d) return '';
  let h      = d.getHours();
  const m    = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return m ? `${h}:${String(m).padStart(2, '0')} ${ampm}` : `${h} ${ampm}`;
}

function formatTimeRange(s, e) {
  return `${formatTime(s)} – ${formatTime(e)}`;
}

function formatMonthYear(date) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatWeekRange(date) {
  const s = startOfWeek(date);
  const e = addDays(s, 6);
  if (s.getMonth() === e.getMonth()) {
    return `${s.toLocaleDateString('en-US', { month: 'long' })} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`;
  }
  return `${s.toLocaleDateString('en-US', { month: 'short' })} ${s.getDate()} – ${e.toLocaleDateString('en-US', { month: 'short' })} ${e.getDate()}, ${e.getFullYear()}`;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function hexAlpha(hex, a) {
  const h = hex.replace('#', '');
  return `rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)},${a})`;
}

function darkenColor(hex, amount = 0.55) {
  const h = hex.replace('#', '');
  const r = Math.round(parseInt(h.slice(0,2),16) * amount);
  const g = Math.round(parseInt(h.slice(2,4),16) * amount);
  const b = Math.round(parseInt(h.slice(4,6),16) * amount);
  return `rgb(${r},${g},${b})`;
}

const DAYS_SHORT  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const PX_PER_HR   = 64;
const RETURN_COLOR = '#E07C3A';

const LOCATION_COLOR = {
  'Buena Park': '#4F63E8',
  'Cerritos':   '#27AE7A',
};

function colorForLocation(loc) {
  return LOCATION_COLOR[loc] || '#4F63E8';
}

function colorForEvent(ev) {
  return ev.is_return ? RETURN_COLOR : colorForLocation(ev.location);
}

/* Build a complete event object ready to insert into Supabase */
function buildEventObject(data) {
  const isReturn = data.is_return || false;
  return {
    id:          `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`,
    vendor_name: (data.vendor_name || 'Unknown Vendor').trim(),
    po_number:   (data.po_number   || '').trim(),
    location:    data.location     || 'Buena Park',
    is_return:   isReturn,
    color:       isReturn ? RETURN_COLOR : colorForLocation(data.location),
    start_iso:   data.start_iso,
    end_iso:     data.end_iso,
    created_at:  new Date().toISOString(),
    updated_at:  new Date().toISOString(),
  };
}

/* ════════════════════════════════════════════════
   §2 · DB STATUS OVERLAY
════════════════════════════════════════════════ */

function showLoading(visible) {
  document.getElementById('db-loading').style.display = visible ? 'flex' : 'none';
}

function showDbError(message) {
  const el = document.getElementById('db-error');
  document.getElementById('db-error-msg').textContent = message || 'Could not connect to the database.';
  el.style.display = 'flex';
  showLoading(false);
}

function hideDbError() {
  document.getElementById('db-error').style.display = 'none';
}

/* ════════════════════════════════════════════════
   §3 · STATE MANAGER  (async — Supabase-backed)
════════════════════════════════════════════════ */

const State = (() => {
  let _events = [];
  let _view   = 'month';
  let _date   = new Date();
  const _subs = new Set();
  const emit  = () => _subs.forEach(fn => fn());

  return {
    getEvents:  () => [..._events],
    getView:    () => _view,
    getDate:    () => new Date(_date),
    subscribe:  fn  => _subs.add(fn),
    setView:    v   => { _view = v; emit(); },
    setDate:    d   => { _date = new Date(d); emit(); },

    /* Load all rows from Supabase */
    async load() {
      showLoading(true);
      const { data, error } = await db
        .from('deliveries')
        .select('*')
        .order('start_iso', { ascending: true });

      showLoading(false);

      if (error) {
        showDbError(`Database error: ${error.message}`);
        return false;
      }

      hideDbError();
      _events = (data || []).map(ev => ({
        ...ev,
        is_return: ev.is_return || false,
        color:     colorForEvent({ is_return: ev.is_return, location: ev.location }),
      }));
      emit();
      return true;
    },

    /* Insert a new row */
    async addEvent(data) {
      const ev = buildEventObject(data);
      const { data: row, error } = await db
        .from('deliveries')
        .insert(ev)
        .select()
        .single();

      if (error) {
        alert(`Could not save delivery:\n${error.message}`);
        return null;
      }

      _events = [..._events, { ...row, is_return: row.is_return || false }];
      emit();
      return row;
    },

    /* Update an existing row */
    async updateEvent(id, data) {
      const existing  = _events.find(e => e.id === id);
      if (!existing) return false;

      const isReturn  = data.is_return !== undefined ? data.is_return : existing.is_return;
      const loc       = data.location || existing.location;
      const updates   = {
        ...data,
        is_return:  isReturn,
        color:      isReturn ? RETURN_COLOR : colorForLocation(loc),
        updated_at: new Date().toISOString(),
      };

      const { data: row, error } = await db
        .from('deliveries')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        alert(`Could not update delivery:\n${error.message}`);
        return false;
      }

      _events = _events.map(e => e.id === id ? { ...row, is_return: row.is_return || false } : e);
      emit();
      return true;
    },

    /* Delete a row */
    async deleteEvent(id) {
      const { error } = await db
        .from('deliveries')
        .delete()
        .eq('id', id);

      if (error) {
        alert(`Could not delete delivery:\n${error.message}`);
        return false;
      }

      _events = _events.filter(e => e.id !== id);
      emit();
      return true;
    },

    /* Query helpers (synchronous — operate on in-memory cache) */
    getEventsInRange(start, end) {
      return _events.filter(e => {
        const s  = parseLocalDT(e.start_iso);
        const en = parseLocalDT(e.end_iso);
        return s < end && en > start;
      });
    },

    getEventsOnDate(date) {
      return this.getEventsInRange(startOfDay(date), endOfDay(date));
    },

    /* Called by realtime subscription to patch local cache */
    _applyRealtimeEvent(type, row) {
      if (!row) return;
      const ev = { ...row, is_return: row.is_return || false, color: colorForEvent({ is_return: row.is_return, location: row.location }) };
      if (type === 'INSERT') {
        if (!_events.find(e => e.id === ev.id)) _events = [..._events, ev];
      } else if (type === 'UPDATE') {
        _events = _events.map(e => e.id === ev.id ? ev : e);
      } else if (type === 'DELETE') {
        _events = _events.filter(e => e.id !== ev.id);
      }
      emit();
    },
  };
})();

/* ════════════════════════════════════════════════
   §4 · EVENT LAYOUT ENGINE
════════════════════════════════════════════════ */

function computeLayouts(events) {
  if (!events.length) return [];
  const sorted = [...events].sort((a, b) => parseLocalDT(a.start_iso) - parseLocalDT(b.start_iso));
  const laneEnds    = [];
  const assignments = [];

  sorted.forEach(ev => {
    const start = parseLocalDT(ev.start_iso);
    const end   = parseLocalDT(ev.end_iso);
    let lane    = laneEnds.findIndex(le => le <= start);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(end); }
    else             { laneEnds[lane] = end; }
    assignments.push({ event: ev, lane });
  });

  return assignments.map(({ event, lane }) => {
    const s  = parseLocalDT(event.start_iso);
    const en = parseLocalDT(event.end_iso);
    const concurrent = assignments.filter(({ event: e2 }) => {
      const s2 = parseLocalDT(e2.start_iso), en2 = parseLocalDT(e2.end_iso);
      return s2 < en && en2 > s;
    });
    return { event, lane, totalLanes: Math.max(...concurrent.map(a => a.lane)) + 1 };
  });
}

function makeTimeEventEl(event, lane, totalLanes) {
  const start    = parseLocalDT(event.start_iso);
  const end      = parseLocalDT(event.end_iso);
  const top      = (start.getHours() + start.getMinutes() / 60) * PX_PER_HR;
  const height   = Math.max(((end - start) / 3600000) * PX_PER_HR, 18);
  const widthPct = 100 / totalLanes;
  const leftPct  = lane * widthPct;

  const el = document.createElement('div');
  el.className = 'tg-event';
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');

  el.style.top    = `${top}px`;
  el.style.height = `${height}px`;
  el.style.left   = `calc(${leftPct}% + 2px)`;
  el.style.right  = `calc(${100 - leftPct - widthPct}% + 2px)`;
  el.style.setProperty('--ev-border', event.color);
  el.style.setProperty('--ev-bg',     hexAlpha(event.color, 0.13));
  el.style.setProperty('--ev-text',   event.color);

  const showTime   = height >= 34;
  const showPO     = height >= 48;
  const showLoc    = height >= 62;
  const showReturn = event.is_return && height >= 28;

  let html = `<div class="tg-event-title">${escapeHtml(event.vendor_name)}</div>`;
  if (showReturn) html += `<div class="tg-return-badge">↩ Return</div>`;
  if (showTime)   html += `<div class="tg-event-time">${formatTimeRange(event.start_iso, event.end_iso)}</div>`;
  if (showPO)     html += `<div class="tg-event-time">PO ${escapeHtml(event.po_number)}</div>`;
  if (showLoc)    html += `<div class="tg-event-time">${escapeHtml(event.location)}</div>`;
  el.innerHTML = html;

  const openEv = e => { e.stopPropagation(); Modal.open(event); };
  el.addEventListener('click', openEv);
  el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openEv(e); });
  return el;
}

/* ════════════════════════════════════════════════
   §5 · MODAL CONTROLLER  (async save/delete)
════════════════════════════════════════════════ */

const Modal = (() => {
  const overlay   = document.getElementById('modal-overlay');
  const form      = document.getElementById('event-form');
  const heading   = document.getElementById('modal-title');
  const idInput   = document.getElementById('event-id');
  const vendorIn  = document.getElementById('event-vendor');
  const poIn      = document.getElementById('event-po');
  const locIn     = document.getElementById('event-location');
  const returnIn  = document.getElementById('event-is-return');
  const startIn   = document.getElementById('event-start');
  const endIn     = document.getElementById('event-end');
  const closeBtn  = document.getElementById('modal-close');
  const cancelBtn = document.getElementById('cancel-event');
  const deleteBtn = document.getElementById('delete-event');
  const saveBtn   = form.querySelector('.btn-primary');

  function open(opts = {}) {
    const { id = null, vendor_name = '', po_number = '', location = 'Buena Park',
            is_return = false } = opts;
    const now = new Date();
    const start_iso = opts.start_iso || toLocalDT(now, now.getHours() + 1, 0);
    const end_iso   = opts.end_iso   || toLocalDT(now, now.getHours() + 3, 0);

    heading.textContent     = id ? 'Edit Delivery' : 'New Delivery';
    idInput.value           = id || '';
    vendorIn.value          = vendor_name;
    poIn.value              = po_number;
    locIn.value             = location;
    returnIn.checked        = is_return;
    startIn.value           = start_iso;
    endIn.value             = end_iso;
    deleteBtn.style.display = id ? 'inline-flex' : 'none';
    _setWorking(false);

    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    setTimeout(() => vendorIn.focus(), 80);
  }

  function close() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    form.reset();
    _setWorking(false);
  }

  /* Disable/re-enable controls while awaiting DB */
  function _setWorking(on, label = 'Saving…') {
    saveBtn.disabled    = on;
    saveBtn.textContent = on ? label : 'Save Delivery';
    deleteBtn.disabled  = on;
    closeBtn.disabled   = on;
    cancelBtn.disabled  = on;
  }

  async function save() {
    const id    = idInput.value;
    const start = parseLocalDT(startIn.value);
    const end   = parseLocalDT(endIn.value);

    if (!vendorIn.value.trim()) { alert('Please enter a vendor name.'); vendorIn.focus(); return; }
    if (!poIn.value.trim())     { alert('Please enter a PO number.');   poIn.focus();    return; }
    if (!startIn.value || !endIn.value) { alert('Please fill in arrival and completion times.'); return; }
    if (end <= start) { alert('Est. completion must be after the expected arrival time.'); endIn.focus(); return; }

    const data = {
      vendor_name: vendorIn.value.trim(),
      po_number:   poIn.value.trim(),
      location:    locIn.value,
      is_return:   returnIn.checked,
      start_iso:   startIn.value,
      end_iso:     endIn.value,
    };

    _setWorking(true);
    let ok;
    if (id) { ok = await State.updateEvent(id, data); }
    else    { ok = !!(await State.addEvent(data)); }

    if (ok) { close(); }
    else    { _setWorking(false); }
  }

  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  deleteBtn.addEventListener('click', async () => {
    const id = idInput.value;
    if (!id || !confirm('Delete this delivery permanently?')) return;
    _setWorking(true, 'Deleting…');
    const ok = await State.deleteEvent(id);
    if (ok) { close(); }
    else    { _setWorking(false); }
  });

  form.addEventListener('submit', e => { e.preventDefault(); save(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) close();
  });

  return { open, close };
})();

/* ════════════════════════════════════════════════
   §6 · UPCOMING BAR  (proximity-scaled chips)
════════════════════════════════════════════════ */

const MAX_CLUSTER_VISIBLE = 3;

function proximityScale(minutesUntil) {
  return 0.75 + 0.70 * Math.exp(-Math.max(0, minutesUntil) / 220);
}

function countdownLabel(minutesUntil) {
  if (minutesUntil <= 0)   return 'Now';
  if (minutesUntil < 60)   return `In ${Math.round(minutesUntil)} min`;
  if (minutesUntil < 120)  return `In 1 hr ${Math.round(minutesUntil - 60)} min`;
  if (minutesUntil < 1440) return `In ${Math.round(minutesUntil / 60)} hrs`;
  if (minutesUntil < 2880) return 'Tomorrow';
  return `In ${Math.round(minutesUntil / 1440)} days`;
}

function buildChip(ev, now) {
  const evStart      = parseLocalDT(ev.start_iso);
  const minutesUntil = (evStart - now) / 60000;
  const scale        = proximityScale(minutesUntil);
  const isUrgent     = minutesUntil <= 30;
  const isNow        = minutesUntil <= 0;

  const minW      = Math.round(112 * scale);
  const maxW      = Math.round(158 * scale);
  const padV      = Math.round(scale * 6);
  const titleSize = Math.round(scale * 115) / 10;
  const timeSize  = Math.round(scale * 100) / 10;
  const borderW   = scale >= 1.2 ? 4 : 3;

  const chip = document.createElement('div');
  chip.className = `upcoming-chip${isUrgent ? ' chip-urgent' : ''}`;
  chip.setAttribute('role', 'button');
  chip.setAttribute('tabindex', '0');
  chip.style.cssText = `--chip-color:${ev.color};min-width:${minW}px;max-width:${maxW}px;padding:${padV}px 10px;border-left-width:${borderW}px`;

  const timeStr = minutesUntil < 1440
    ? countdownLabel(minutesUntil)
    : isSameDay(evStart, addDays(now, 1))
      ? `Tomorrow · ${formatTime(ev.start_iso)}`
      : `${evStart.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })} · ${formatTime(ev.start_iso)}`;

  const dotHTML     = isUrgent ? `<span class="chip-dot${isNow ? ' chip-dot-now' : ''}" aria-hidden="true"></span>` : '';
  const returnBadge = ev.is_return ? `<span class="return-badge">↩ Return</span>` : '';

  chip.innerHTML =
    `<div class="upcoming-chip-title" style="font-size:${titleSize}px">${dotHTML}${escapeHtml(ev.vendor_name)}${returnBadge}</div>` +
    `<div class="upcoming-chip-time" style="font-size:${timeSize}px">PO ${escapeHtml(ev.po_number)} · ${escapeHtml(ev.location)}</div>` +
    `<div class="upcoming-chip-time" style="font-size:${Math.round(timeSize * 0.9)}px;margin-top:0">${timeStr}</div>`;

  chip.addEventListener('click', () => Modal.open(ev));
  chip.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') Modal.open(ev); });
  return chip;
}

let _upcomingTimer = null;

function renderUpcomingBar() {
  if (_upcomingTimer) clearInterval(_upcomingTimer);
  _upcomingTimer = setInterval(renderUpcomingBar, 60000);

  const container = document.getElementById('upcoming-events');
  const now       = new Date();

  const upcoming = State.getEventsInRange(now, addDays(now, 14))
    .filter(e => parseLocalDT(e.end_iso) > now)
    .sort((a, b) => parseLocalDT(a.start_iso) - parseLocalDT(b.start_iso));

  if (!upcoming.length) {
    container.innerHTML = '<span class="upcoming-empty">No upcoming deliveries scheduled.</span>';
    return;
  }

  const clusters = [];
  let current    = [upcoming[0]];
  let clusterEnd = parseLocalDT(upcoming[0].end_iso);

  for (let i = 1; i < upcoming.length; i++) {
    const s = parseLocalDT(upcoming[i].start_iso);
    const e = parseLocalDT(upcoming[i].end_iso);
    if (s < clusterEnd) {
      current.push(upcoming[i]);
      if (e > clusterEnd) clusterEnd = e;
    } else {
      clusters.push(current);
      current = [upcoming[i]];
      clusterEnd = e;
    }
  }
  clusters.push(current);

  container.innerHTML = '';
  clusters.forEach(cluster => {
    const clEl = document.createElement('div');
    clEl.className = 'upcoming-cluster';
    clEl.setAttribute('role', 'listitem');

    if (cluster.length > 1) {
      const badge = document.createElement('span');
      badge.className   = 'upcoming-cluster-badge';
      badge.textContent = `${cluster.length} overlap`;
      clEl.appendChild(badge);
    }

    cluster.slice(0, MAX_CLUSTER_VISIBLE).forEach(ev => clEl.appendChild(buildChip(ev, now)));

    const overflow = cluster.length - MAX_CLUSTER_VISIBLE;
    if (overflow > 0) {
      const pill = document.createElement('div');
      pill.className = 'upcoming-overflow';
      pill.setAttribute('role', 'button');
      pill.setAttribute('tabindex', '0');
      pill.innerHTML = `<span>+${overflow}</span>`;
      const first = cluster[MAX_CLUSTER_VISIBLE];
      pill.addEventListener('click', () => Modal.open(first));
      pill.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') Modal.open(first); });
      clEl.appendChild(pill);
    }

    container.appendChild(clEl);
  });
}

/* ════════════════════════════════════════════════
   §7 · MONTH VIEW
════════════════════════════════════════════════ */

function renderMonthView(container, date) {
  const month    = date.getMonth();
  const mStart   = new Date(date.getFullYear(), month, 1);
  const mEnd     = new Date(date.getFullYear(), month + 1, 0);
  const gridS    = startOfWeek(mStart);
  const rowCount = Math.ceil((mEnd.getDate() + mStart.getDay()) / 7);

  container.innerHTML =
    `<div class="month-view view-enter">
      <div class="month-weekdays">
        ${DAYS_SHORT.map(d => `<div class="month-weekday">${d}</div>`).join('')}
      </div>
      <div class="month-grid" id="month-grid" data-rows="${rowCount}"></div>
    </div>`;

  const grid = container.querySelector('#month-grid');

  for (let i = 0; i < rowCount * 7; i++) {
    const cellDate    = addDays(gridS, i);
    const isThisMonth = cellDate.getMonth() === month;

    const cell = document.createElement('div');
    cell.className = `month-cell${!isThisMonth ? ' other-month' : ''}${isToday(cellDate) ? ' today' : ''}`;

    const dayEvents = State.getEventsOnDate(cellDate)
      .sort((a, b) => parseLocalDT(a.start_iso) - parseLocalDT(b.start_iso));

    const MAX_PILLS  = 3;
    const visible    = dayEvents.slice(0, MAX_PILLS);
    const overflowCt = dayEvents.length - MAX_PILLS;

    const pillsHTML = visible.map(ev => {
      const tag = ev.is_return ? ' ↩' : '';
      return `<div class="cell-event-pill" data-eid="${ev.id}" role="button" tabindex="0"
                style="--pill-dot:${ev.color};--pill-bg:${hexAlpha(ev.color,0.12)};--pill-color:${darkenColor(ev.color)}"
                title="${ev.is_return ? '[RETURN] ' : ''}PO ${escapeHtml(ev.po_number)} · ${escapeHtml(ev.location)} · ${formatTimeRange(ev.start_iso,ev.end_iso)}">
                ${escapeHtml(ev.vendor_name)}${tag}
              </div>`;
    }).join('');

    cell.innerHTML =
      `<div class="cell-date">${cellDate.getDate()}</div>
       <div class="cell-events">${pillsHTML}${overflowCt > 0 ? `<div class="cell-overflow">+${overflowCt} more</div>` : ''}</div>`;

    const cd = new Date(cellDate);
    cell.addEventListener('click', e => {
      if (e.target.closest('.cell-event-pill')) return;
      Modal.open({ start_iso: toLocalDT(cd, 7, 0), end_iso: toLocalDT(cd, 9, 0) });
    });

    grid.appendChild(cell);
  }

  grid.querySelectorAll('.cell-event-pill').forEach(pill => {
    const ev = State.getEvents().find(e => e.id === pill.dataset.eid);
    if (!ev) return;
    pill.addEventListener('click', e => { e.stopPropagation(); Modal.open(ev); });
    pill.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); Modal.open(ev); } });
  });
}

/* ════════════════════════════════════════════════
   §8 · WEEK VIEW
════════════════════════════════════════════════ */

function renderWeekView(container, date) {
  const wStart = startOfWeek(date);
  const days   = Array.from({ length: 7 }, (_, i) => addDays(wStart, i));
  const hours  = Array.from({ length: 24 }, (_, i) => i);

  container.innerHTML =
    `<div class="week-view view-enter">
      <div class="week-header">
        <div class="week-header-gutter"></div>
        ${days.map(d =>
          `<div class="week-header-day${isToday(d) ? ' today' : ''}"
                data-date="${toLocalDT(d).split('T')[0]}" role="button" tabindex="0">
             <div class="week-day-name">${DAYS_SHORT[d.getDay()]}</div>
             <div class="week-day-num">${d.getDate()}</div>
           </div>`
        ).join('')}
      </div>
      <div class="week-scroll" id="week-scroll">
        <div class="week-time-axis">
          ${hours.map(h => `<div class="time-label">${h === 0 ? '' : formatHour(h)}</div>`).join('')}
        </div>
        <div class="week-grid" id="week-grid">
          ${days.map(d => {
            const ds = toLocalDT(d).split('T')[0];
            return `<div class="week-day-col" data-date="${ds}">
              ${hours.map(h => `<div class="hour-cell" data-date="${ds}" data-hour="${h}"></div>`).join('')}
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;

  container.querySelectorAll('.week-day-col').forEach((col, i) => {
    const day = days[i];
    if (isToday(day)) col.classList.add('is-today');
    computeLayouts(State.getEventsOnDate(day)).forEach(({ event, lane, totalLanes }) => {
      col.appendChild(makeTimeEventEl(event, lane, totalLanes));
    });
    col.querySelectorAll('.hour-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        const hr = parseInt(cell.dataset.hour, 10);
        const cd = parseLocalDT(cell.dataset.date + 'T00:00');
        Modal.open({ start_iso: toLocalDT(cd, hr, 0), end_iso: toLocalDT(cd, hr + 2, 0) });
      });
    });
  });

  container.querySelectorAll('.week-header-day').forEach(el => {
    const jump = () => {
      State.setDate(parseLocalDT(el.dataset.date + 'T00:00'));
      State.setView('day');
      document.querySelectorAll('.view-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.view === 'day');
        b.setAttribute('aria-pressed', b.dataset.view === 'day' ? 'true' : 'false');
      });
    };
    el.addEventListener('click', jump);
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') jump(); });
  });

  placeNowLine(container, '.week-day-col', days);
  setTimeout(() => {
    const s = container.querySelector('#week-scroll');
    if (s) s.scrollTop = 6 * PX_PER_HR;
  }, 60);
}

/* ════════════════════════════════════════════════
   §9 · DAY VIEW
════════════════════════════════════════════════ */

function renderDayView(container, date) {
  const hours = Array.from({ length: 24 }, (_, i) => i);

  container.innerHTML =
    `<div class="day-view view-enter">
      <div class="day-header">
        <div class="day-title">${date.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })}</div>
        <div class="day-subtitle">${date.getFullYear()}${isToday(date) ? ' · Today' : ''}</div>
      </div>
      <div class="day-scroll" id="day-scroll">
        <div class="day-time-axis">
          ${hours.map(h => `<div class="time-label">${h === 0 ? '' : formatHour(h)}</div>`).join('')}
        </div>
        <div class="day-grid" id="day-grid">
          ${hours.map(h => `<div class="hour-cell" data-hour="${h}"></div>`).join('')}
        </div>
      </div>
    </div>`;

  const dayGrid = container.querySelector('#day-grid');
  computeLayouts(State.getEventsOnDate(date)).forEach(({ event, lane, totalLanes }) => {
    dayGrid.appendChild(makeTimeEventEl(event, lane, totalLanes));
  });

  dayGrid.querySelectorAll('.hour-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      const hr = parseInt(cell.dataset.hour, 10);
      Modal.open({ start_iso: toLocalDT(date, hr, 0), end_iso: toLocalDT(date, hr + 2, 0) });
    });
  });

  if (isToday(date)) placeNowLine(container, '#day-grid', [date]);
  setTimeout(() => {
    const s = container.querySelector('#day-scroll');
    if (s) s.scrollTop = 6 * PX_PER_HR;
  }, 60);
}

/* ════════════════════════════════════════════════
   §10 · NOW-LINE
════════════════════════════════════════════════ */

let _nowLineTimer = null;

function placeNowLine(container, selector, days) {
  if (_nowLineTimer) { clearInterval(_nowLineTimer); _nowLineTimer = null; }
  function draw() {
    container.querySelectorAll('.now-line').forEach(el => el.remove());
    const now = new Date();
    const top = (now.getHours() + now.getMinutes() / 60) * PX_PER_HR;
    container.querySelectorAll(selector).forEach((col, i) => {
      if (!days[i] || !isToday(days[i])) return;
      const line = document.createElement('div');
      line.className = 'now-line';
      line.style.top = `${top}px`;
      col.appendChild(line);
    });
  }
  draw();
  _nowLineTimer = setInterval(draw, 60000);
}

/* ════════════════════════════════════════════════
   §11 · MAIN RENDERER
════════════════════════════════════════════════ */

function updatePeriodLabel() {
  const el   = document.getElementById('current-period');
  const d    = State.getDate();
  const view = State.getView();
  el.textContent =
    view === 'month' ? formatMonthYear(d) :
    view === 'week'  ? formatWeekRange(d) :
    d.toLocaleDateString('en-US', { weekday:'short', month:'long', day:'numeric' });
}

function render() {
  const container = document.getElementById('calendar-container');
  updatePeriodLabel();
  renderUpcomingBar();
  const view = State.getView(), date = State.getDate();
  if      (view === 'month') renderMonthView(container, date);
  else if (view === 'week')  renderWeekView(container, date);
  else                       renderDayView(container, date);
}

/* ════════════════════════════════════════════════
   §12 · NAVIGATION
════════════════════════════════════════════════ */

function navigate(dir) {
  const d = State.getDate(), v = State.getView();
  if      (v === 'month') State.setDate(addMonths(d, dir));
  else if (v === 'week')  State.setDate(addDays(d, dir * 7));
  else                    State.setDate(addDays(d, dir));
}

/* ════════════════════════════════════════════════
   §13 · BOOTSTRAP
════════════════════════════════════════════════ */

(async function init() {
  /* Render shell immediately so UI isn't blank */
  State.subscribe(render);
  render();

  /* Load data from Supabase */
  const ok = await State.load();
  if (!ok) return;

  /* Realtime subscription — syncs changes from other users/devices */
  db.channel('deliveries-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'deliveries' },
      payload => {
        State._applyRealtimeEvent(payload.eventType, payload.new || payload.old);
      }
    )
    .subscribe(status => {
      if (status === 'SUBSCRIBED') console.log('Meridian: realtime connected ✓');
    });

  /* Retry button on error overlay */
  document.getElementById('db-retry-btn').addEventListener('click', async () => {
    hideDbError();
    await State.load();
  });

  /* View switcher */
  function switchView(v) {
    document.querySelectorAll('.view-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.view === v);
      b.setAttribute('aria-pressed', b.dataset.view === v ? 'true' : 'false');
    });
    State.setView(v);
  }

  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  document.getElementById('prev-btn').addEventListener('click',  () => navigate(-1));
  document.getElementById('next-btn').addEventListener('click',  () => navigate(1));
  document.getElementById('today-btn').addEventListener('click', () => State.setDate(new Date()));
  document.getElementById('add-event-btn').addEventListener('click', () => Modal.open());

  document.addEventListener('keydown', e => {
    if (document.getElementById('modal-overlay').classList.contains('open')) return;
    const tag = document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === 'ArrowLeft')  navigate(-1);
    if (e.key === 'ArrowRight') navigate(1);
    if (e.key === 't') State.setDate(new Date());
    if (e.key === 'm') switchView('month');
    if (e.key === 'w') switchView('week');
    if (e.key === 'd') switchView('day');
  });
})();
