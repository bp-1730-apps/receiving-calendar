/* ════════════════════════════════════════════════════════════
   MERIDIAN — Receiving Calendar  |  script.js
   ES5 + Promises only. No const/let, no arrow functions,
   no template literals, no spread, no async/await.
   Compatible with every VS Code TypeScript checker setting.
════════════════════════════════════════════════════════════ */

/* ── Supabase ──────────────────────────────────────────── */
var SUPABASE_URL = 'https://fcaluuhfmexzeykxhcgp.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjYWx1dWhmbWV4emV5a3hoY2dwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwOTg3MjIsImV4cCI6MjA5MzY3NDcyMn0.mSzLJnWzPVTQcGGhimK2uWTEdtUzL1KJ63XTcQYLouY';
var db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* ════════════════════════════════════════════════
   §1 · DATE UTILITIES
════════════════════════════════════════════════ */

function today() {
  var d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfDay(date) {
  var d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  var d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfWeek(date) {
  var d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  var d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function addMonths(date, n) {
  var d = new Date(date);
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

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toLocalDT(date, hours, minutes) {
  var d = new Date(date);
  if (hours !== undefined) {
    d.setHours(hours, minutes || 0, 0, 0);
  }
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
         'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

function parseLocalDT(str) {
  if (!str) return null;
  var parts    = str.split('T');
  var datePart = parts[0];
  var timePart = parts[1] || '00:00';
  var dp = datePart.split('-');
  var tp = timePart.split(':');
  return new Date(
    parseInt(dp[0], 10),
    parseInt(dp[1], 10) - 1,
    parseInt(dp[2], 10),
    parseInt(tp[0], 10),
    parseInt(tp[1], 10),
    0, 0
  );
}

function formatHour(h) {
  if (h === 0)  return '12 AM';
  if (h < 12)  return h + ' AM';
  if (h === 12) return '12 PM';
  return (h - 12) + ' PM';
}

function formatTime(dtStr) {
  var d = parseLocalDT(dtStr);
  if (!d) return '';
  var h    = d.getHours();
  var m    = d.getMinutes();
  var ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return m ? h + ':' + pad2(m) + ' ' + ampm : h + ' ' + ampm;
}

function formatTimeRange(s, e) {
  return formatTime(s) + ' \u2013 ' + formatTime(e);
}

function formatMonthYear(date) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatWeekRange(date) {
  var s = startOfWeek(date);
  var e = addDays(s, 6);
  if (s.getMonth() === e.getMonth()) {
    return s.toLocaleDateString('en-US', { month: 'long' }) + ' ' + s.getDate() + '\u2013' + e.getDate() + ', ' + s.getFullYear();
  }
  return s.toLocaleDateString('en-US', { month: 'short' }) + ' ' + s.getDate() +
         ' \u2013 ' + e.toLocaleDateString('en-US', { month: 'short' }) + ' ' + e.getDate() + ', ' + e.getFullYear();
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hexAlpha(hex, a) {
  var h = hex.replace('#', '');
  var r = parseInt(h.slice(0, 2), 16);
  var g = parseInt(h.slice(2, 4), 16);
  var b = parseInt(h.slice(4, 6), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}

function darkenColor(hex, amount) {
  if (amount === undefined) amount = 0.55;
  var h = hex.replace('#', '');
  var r = Math.round(parseInt(h.slice(0, 2), 16) * amount);
  var g = Math.round(parseInt(h.slice(2, 4), 16) * amount);
  var b = Math.round(parseInt(h.slice(4, 6), 16) * amount);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

var DAYS_SHORT   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
var PX_PER_HR    = 64;
var RETURN_COLOR = '#D4920A';

var LOCATION_COLOR = {
  'Buena Park': '#B01212',
  'Cerritos':   '#2E7FD4'
};

function colorForLocation(loc) {
  return LOCATION_COLOR[loc] || '#B01212';
}

function colorForEvent(ev) {
  return ev.is_return ? RETURN_COLOR : colorForLocation(ev.location);
}

function buildEventObject(data) {
  var isReturn = data.is_return ? true : false;
  return {
    id:          'evt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7),
    vendor_name: (data.vendor_name || 'Unknown Vendor').trim(),
    po_number:   (data.po_number   || '').trim(),
    location:    data.location     || 'Buena Park',
    is_return:   isReturn,
    color:       isReturn ? RETURN_COLOR : colorForLocation(data.location),
    start_iso:   data.start_iso,
    end_iso:     data.end_iso,
    created_at:  new Date().toISOString(),
    updated_at:  new Date().toISOString()
  };
}

function normalizeEvent(ev) {
  return Object.assign({}, ev, {
    is_return: ev.is_return ? true : false,
    color:     colorForEvent({ is_return: ev.is_return, location: ev.location })
  });
}

/* ════════════════════════════════════════════════
   §2 · DB STATUS
════════════════════════════════════════════════ */

function showLoading(visible) {
  document.getElementById('db-loading').style.display = visible ? 'flex' : 'none';
}

function showDbError(message) {
  document.getElementById('db-error-msg').textContent = message || 'Could not connect to the database.';
  document.getElementById('db-error').style.display = 'flex';
  showLoading(false);
}

function hideDbError() {
  document.getElementById('db-error').style.display = 'none';
}

/* ════════════════════════════════════════════════
   §3 · STATE MANAGER
════════════════════════════════════════════════ */

var State = (function() {
  var _events = [];
  var _view   = 'month';
  var _date   = new Date();
  var _subs   = [];

  function emit() {
    for (var i = 0; i < _subs.length; i++) _subs[i]();
  }

  return {
    getEvents:  function() { return _events.slice(); },
    getView:    function() { return _view; },
    getDate:    function() { return new Date(_date); },
    subscribe:  function(fn) { _subs.push(fn); },
    setView:    function(v) { _view = v; emit(); },
    setDate:    function(d) { _date = new Date(d); emit(); },

    load: function() {
      showLoading(true);
      return db.from('deliveries').select('*').order('start_iso', { ascending: true })
        .then(function(result) {
          showLoading(false);
          if (result.error) {
            showDbError('Database error: ' + result.error.message);
            return false;
          }
          hideDbError();
          _events = (result.data || []).map(normalizeEvent);
          emit();
          return true;
        })
        .catch(function(err) {
          showLoading(false);
          showDbError('Connection error: ' + (err.message || 'Unknown error'));
          return false;
        });
    },

    addEvent: function(data) {
      var ev = buildEventObject(data);
      return db.from('deliveries').insert(ev).select().single()
        .then(function(result) {
          if (result.error) {
            alert('Could not save delivery:\n' + result.error.message);
            return null;
          }
          var row = normalizeEvent(result.data);
          _events = _events.concat([row]);
          emit();
          return row;
        })
        .catch(function(err) {
          alert('Save error: ' + (err.message || 'Unknown error'));
          return null;
        });
    },

    updateEvent: function(id, data) {
      var existing = null;
      for (var i = 0; i < _events.length; i++) {
        if (_events[i].id === id) { existing = _events[i]; break; }
      }
      if (!existing) return Promise.resolve(false);

      var isReturn = data.is_return !== undefined ? data.is_return : existing.is_return;
      var loc      = data.location || existing.location;
      var updates  = Object.assign({}, data, {
        is_return:  isReturn,
        color:      isReturn ? RETURN_COLOR : colorForLocation(loc),
        updated_at: new Date().toISOString()
      });

      return db.from('deliveries').update(updates).eq('id', id).select().single()
        .then(function(result) {
          if (result.error) {
            alert('Could not update delivery:\n' + result.error.message);
            return false;
          }
          var row = normalizeEvent(result.data);
          _events = _events.map(function(e) { return e.id === id ? row : e; });
          emit();
          return true;
        })
        .catch(function(err) {
          alert('Update error: ' + (err.message || 'Unknown error'));
          return false;
        });
    },

    deleteEvent: function(id) {
      return db.from('deliveries').delete().eq('id', id)
        .then(function(result) {
          if (result.error) {
            alert('Could not delete delivery:\n' + result.error.message);
            return false;
          }
          _events = _events.filter(function(e) { return e.id !== id; });
          emit();
          return true;
        })
        .catch(function(err) {
          alert('Delete error: ' + (err.message || 'Unknown error'));
          return false;
        });
    },

    getEventsInRange: function(start, end) {
      return _events.filter(function(e) {
        var s  = parseLocalDT(e.start_iso);
        var en = parseLocalDT(e.end_iso);
        return s < end && en > start;
      });
    },

    getEventsOnDate: function(date) {
      return this.getEventsInRange(startOfDay(date), endOfDay(date));
    },

    _applyRealtimeEvent: function(type, row) {
      if (!row) return;
      var ev = normalizeEvent(row);
      if (type === 'INSERT') {
        var exists = false;
        for (var i = 0; i < _events.length; i++) {
          if (_events[i].id === ev.id) { exists = true; break; }
        }
        if (!exists) _events = _events.concat([ev]);
      } else if (type === 'UPDATE') {
        _events = _events.map(function(e) { return e.id === ev.id ? ev : e; });
      } else if (type === 'DELETE') {
        _events = _events.filter(function(e) { return e.id !== ev.id; });
      }
      emit();
    }
  };
})();

/* ════════════════════════════════════════════════
   §4 · EVENT LAYOUT ENGINE
════════════════════════════════════════════════ */

function computeLayouts(events) {
  if (!events.length) return [];

  var sorted = events.slice().sort(function(a, b) {
    return parseLocalDT(a.start_iso) - parseLocalDT(b.start_iso);
  });

  var laneEnds    = [];
  var assignments = [];

  for (var i = 0; i < sorted.length; i++) {
    var ev    = sorted[i];
    var start = parseLocalDT(ev.start_iso);
    var end   = parseLocalDT(ev.end_iso);
    var lane  = -1;
    for (var j = 0; j < laneEnds.length; j++) {
      if (laneEnds[j] <= start) { lane = j; break; }
    }
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(end); }
    else             { laneEnds[lane] = end; }
    assignments.push({ event: ev, lane: lane });
  }

  return assignments.map(function(item) {
    var s  = parseLocalDT(item.event.start_iso);
    var en = parseLocalDT(item.event.end_iso);
    var maxLane = 0;
    for (var k = 0; k < assignments.length; k++) {
      var a   = assignments[k];
      var s2  = parseLocalDT(a.event.start_iso);
      var en2 = parseLocalDT(a.event.end_iso);
      if (s2 < en && en2 > s && a.lane > maxLane) maxLane = a.lane;
    }
    return { event: item.event, lane: item.lane, totalLanes: maxLane + 1 };
  });
}

function makeTimeEventEl(event, lane, totalLanes) {
  var start    = parseLocalDT(event.start_iso);
  var end      = parseLocalDT(event.end_iso);
  var top      = (start.getHours() + start.getMinutes() / 60) * PX_PER_HR;
  var height   = Math.max(((end - start) / 3600000) * PX_PER_HR, 18);
  var widthPct = 100 / totalLanes;
  var leftPct  = lane * widthPct;

  var el = document.createElement('div');
  el.className = 'tg-event';
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');

  el.style.top   = top + 'px';
  el.style.height = height + 'px';
  el.style.left  = 'calc(' + leftPct + '% + 2px)';
  el.style.right = 'calc(' + (100 - leftPct - widthPct) + '% + 2px)';
  el.style.setProperty('--ev-border', event.color);
  el.style.setProperty('--ev-bg',     hexAlpha(event.color, 0.18));

  var showTime   = height >= 34;
  var showPO     = height >= 48;
  var showLoc    = height >= 62;
  var showReturn = event.is_return && height >= 28;

  var html = '<div class="tg-event-title">' + escapeHtml(event.vendor_name) + '</div>';
  if (showReturn) html += '<div class="tg-return-badge">\u21A9 Return</div>';
  if (showTime)   html += '<div class="tg-event-time">' + formatTimeRange(event.start_iso, event.end_iso) + '</div>';
  if (showPO)     html += '<div class="tg-event-time">PO ' + escapeHtml(event.po_number) + '</div>';
  if (showLoc)    html += '<div class="tg-event-time">' + escapeHtml(event.location) + '</div>';
  el.innerHTML = html;

  el.addEventListener('click', function(e) { e.stopPropagation(); Modal.open(event); });
  el.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); Modal.open(event); }
  });

  return el;
}

/* ════════════════════════════════════════════════
   §5 · MODAL CONTROLLER
════════════════════════════════════════════════ */

var Modal = (function() {
  var overlay   = document.getElementById('modal-overlay');
  var form      = document.getElementById('event-form');
  var heading   = document.getElementById('modal-title');
  var idInput   = document.getElementById('event-id');
  var vendorIn  = document.getElementById('event-vendor');
  var poIn      = document.getElementById('event-po');
  var locIn     = document.getElementById('event-location');
  var returnIn  = document.getElementById('event-is-return');
  var startIn   = document.getElementById('event-start');
  var endIn     = document.getElementById('event-end');
  var closeBtn  = document.getElementById('modal-close');
  var cancelBtn = document.getElementById('cancel-event');
  var deleteBtn = document.getElementById('delete-event');
  var saveBtn   = form.querySelector('.btn-primary');

  function open(opts) {
    opts = opts || {};
    var id          = opts.id          || null;
    var vendor_name = opts.vendor_name || '';
    var po_number   = opts.po_number   || '';
    var location    = opts.location    || 'Buena Park';
    var is_return   = opts.is_return   || false;
    var now         = new Date();
    var start_iso   = opts.start_iso   || toLocalDT(now, now.getHours() + 1, 0);
    var end_iso     = opts.end_iso     || toLocalDT(now, now.getHours() + 3, 0);

    heading.textContent     = id ? 'Edit Delivery' : 'New Delivery';
    idInput.value           = id || '';
    vendorIn.value          = vendor_name;
    poIn.value              = po_number;
    locIn.value             = location;
    returnIn.checked        = is_return;
    startIn.value           = start_iso;
    endIn.value             = end_iso;
    deleteBtn.style.display = id ? 'inline-flex' : 'none';
    setWorking(false);

    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    setTimeout(function() { vendorIn.focus(); }, 80);
  }

  function close() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    form.reset();
    setWorking(false);
  }

  function setWorking(on, label) {
    saveBtn.disabled    = on;
    saveBtn.textContent = on ? (label || 'Saving...') : 'Save Delivery';
    deleteBtn.disabled  = on;
    closeBtn.disabled   = on;
    cancelBtn.disabled  = on;
  }

  function save() {
    var id    = idInput.value;
    var start = parseLocalDT(startIn.value);
    var end   = parseLocalDT(endIn.value);

    if (!vendorIn.value.trim()) { alert('Please enter a vendor name.'); vendorIn.focus(); return; }
    if (!poIn.value.trim())     { alert('Please enter a PO number.');   poIn.focus();    return; }
    if (!startIn.value || !endIn.value) { alert('Please fill in arrival and completion times.'); return; }
    if (end <= start) { alert('Est. completion must be after the arrival time.'); endIn.focus(); return; }

    var data = {
      vendor_name: vendorIn.value.trim(),
      po_number:   poIn.value.trim(),
      location:    locIn.value,
      is_return:   returnIn.checked,
      start_iso:   startIn.value,
      end_iso:     endIn.value
    };

    setWorking(true);

    var promise = id ? State.updateEvent(id, data) : State.addEvent(data);

    promise.then(function(result) {
      if (result) {
        close();
      } else {
        setWorking(false);
      }
    });
  }

  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });

  deleteBtn.addEventListener('click', function() {
    var id = idInput.value;
    if (!id || !confirm('Delete this delivery permanently?')) return;
    setWorking(true, 'Deleting...');
    State.deleteEvent(id).then(function(ok) {
      if (ok) { close(); } else { setWorking(false); }
    });
  });

  form.addEventListener('submit', function(e) { e.preventDefault(); save(); });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && overlay.classList.contains('open')) close();
  });

  return { open: open, close: close };
})();

/* ════════════════════════════════════════════════
   §6 · UPCOMING BAR
════════════════════════════════════════════════ */

var MAX_CLUSTER_VISIBLE = 3;

function proximityScale(minutesUntil) {
  var t = minutesUntil < 0 ? 0 : minutesUntil;
  return 0.75 + 0.70 * Math.exp(-t / 220);
}

function countdownLabel(minutesUntil) {
  if (minutesUntil <= 0)   return 'Now';
  if (minutesUntil < 60)   return 'In ' + Math.round(minutesUntil) + ' min';
  if (minutesUntil < 120)  return 'In 1 hr ' + Math.round(minutesUntil - 60) + ' min';
  if (minutesUntil < 1440) return 'In ' + Math.round(minutesUntil / 60) + ' hrs';
  if (minutesUntil < 2880) return 'Tomorrow';
  return 'In ' + Math.round(minutesUntil / 1440) + ' days';
}

function buildChip(ev, now) {
  var evStart      = parseLocalDT(ev.start_iso);
  var minutesUntil = (evStart - now) / 60000;
  var scale        = proximityScale(minutesUntil);
  var isUrgent     = minutesUntil <= 30;
  var isNow        = minutesUntil <= 0;

  var minW      = Math.round(125 * scale);
  var maxW      = Math.round(170 * scale);
  var padV      = Math.round(scale * 6);
  var titleSize = Math.round(scale * 120) / 10;
  var timeSize  = Math.round(scale * 100) / 10;
  var borderW   = scale >= 1.2 ? 5 : 4;

  var chip = document.createElement('div');
  chip.className = 'upcoming-chip' + (isUrgent ? ' chip-urgent' : '');
  chip.setAttribute('role', 'button');
  chip.setAttribute('tabindex', '0');

  chip.style.cssText = [
    '--chip-color:' + ev.color,
    'min-width:' + minW + 'px',
    'max-width:' + maxW + 'px',
    'padding:' + padV + 'px 10px ' + padV + 'px 12px',
    'border-left-width:' + borderW + 'px'
  ].join(';');

  var timeStr;
  if (minutesUntil < 1440) {
    timeStr = countdownLabel(minutesUntil);
  } else if (isSameDay(evStart, addDays(now, 1))) {
    timeStr = 'Tomorrow \u00B7 ' + formatTime(ev.start_iso);
  } else {
    timeStr = evStart.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
              ' \u00B7 ' + formatTime(ev.start_iso);
  }

  var dotHtml     = isUrgent ? '<span class="chip-dot' + (isNow ? ' chip-dot-now' : '') + '" aria-hidden="true"></span>' : '';
  var returnBadge = ev.is_return ? '<span class="return-badge">\u21A9 Return</span>' : '';

  chip.innerHTML =
    '<div class="upcoming-chip-title" style="font-size:' + titleSize + 'px">' +
      dotHtml + escapeHtml(ev.vendor_name) + returnBadge +
    '</div>' +
    '<div class="upcoming-chip-time" style="font-size:' + timeSize + 'px">' +
      'PO ' + escapeHtml(ev.po_number) + ' \u00B7 ' + escapeHtml(ev.location) +
    '</div>' +
    '<div class="upcoming-chip-time" style="font-size:' + Math.round(timeSize * 0.9) + 'px;margin-top:0">' +
      timeStr +
    '</div>';

  chip.addEventListener('click', function() { Modal.open(ev); });
  chip.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ' ') Modal.open(ev);
  });

  return chip;
}

var _upcomingTimer = null;

function renderUpcomingBar() {
  if (_upcomingTimer) clearInterval(_upcomingTimer);
  _upcomingTimer = setInterval(renderUpcomingBar, 60000);

  var container = document.getElementById('upcoming-events');
  var now       = new Date();
  var horizon   = addDays(now, 14);

  var upcoming = State.getEventsInRange(now, horizon).filter(function(e) {
    return parseLocalDT(e.end_iso) > now;
  }).sort(function(a, b) {
    return parseLocalDT(a.start_iso) - parseLocalDT(b.start_iso);
  });

  if (!upcoming.length) {
    container.innerHTML = '<span class="upcoming-empty">No upcoming deliveries scheduled.</span>';
    return;
  }

  var clusters   = [];
  var current    = [upcoming[0]];
  var clusterEnd = parseLocalDT(upcoming[0].end_iso);

  for (var i = 1; i < upcoming.length; i++) {
    var evStart = parseLocalDT(upcoming[i].start_iso);
    var evEnd   = parseLocalDT(upcoming[i].end_iso);
    if (evStart < clusterEnd) {
      current.push(upcoming[i]);
      if (evEnd > clusterEnd) clusterEnd = evEnd;
    } else {
      clusters.push(current);
      current    = [upcoming[i]];
      clusterEnd = evEnd;
    }
  }
  clusters.push(current);

  container.innerHTML = '';

  for (var c = 0; c < clusters.length; c++) {
    var cluster = clusters[c];
    var clEl    = document.createElement('div');
    clEl.className = 'upcoming-cluster';
    clEl.setAttribute('role', 'listitem');

    if (cluster.length > 1) {
      var badge = document.createElement('span');
      badge.className   = 'upcoming-cluster-badge';
      badge.textContent = cluster.length + ' overlap';
      clEl.appendChild(badge);
    }

    var visible  = cluster.slice(0, MAX_CLUSTER_VISIBLE);
    var overflow = cluster.length - MAX_CLUSTER_VISIBLE;

    for (var v = 0; v < visible.length; v++) {
      clEl.appendChild(buildChip(visible[v], now));
    }

    if (overflow > 0) {
      var pill = document.createElement('div');
      pill.className = 'upcoming-overflow';
      pill.setAttribute('role', 'button');
      pill.setAttribute('tabindex', '0');
      pill.innerHTML = '<span>+' + overflow + '</span>';
      var firstHidden = cluster[MAX_CLUSTER_VISIBLE];
      pill.addEventListener('click', function(fh) {
        return function() { Modal.open(fh); };
      }(firstHidden));
      pill.addEventListener('keydown', function(fh) {
        return function(e) { if (e.key === 'Enter' || e.key === ' ') Modal.open(fh); };
      }(firstHidden));
      clEl.appendChild(pill);
    }

    container.appendChild(clEl);
  }
}

/* ════════════════════════════════════════════════
   §7 · MONTH VIEW
════════════════════════════════════════════════ */

function renderMonthView(container, date) {
  var month    = date.getMonth();
  var mStart   = new Date(date.getFullYear(), month, 1);
  var mEnd     = new Date(date.getFullYear(), month + 1, 0);
  var gridS    = startOfWeek(mStart);
  var rowCount = Math.ceil((mEnd.getDate() + mStart.getDay()) / 7);

  var weekdaysHtml = '';
  for (var wd = 0; wd < 7; wd++) {
    weekdaysHtml += '<div class="month-weekday">' + DAYS_SHORT[wd] + '</div>';
  }

  container.innerHTML =
    '<div class="month-view view-enter">' +
      '<div class="month-weekdays">' + weekdaysHtml + '</div>' +
      '<div class="month-grid" id="month-grid" data-rows="' + rowCount + '"></div>' +
    '</div>';

  var grid = container.querySelector('#month-grid');

  for (var i = 0; i < rowCount * 7; i++) {
    var cellDate    = addDays(gridS, i);
    var isThisMonth = cellDate.getMonth() === month;
    var _isToday    = isToday(cellDate);

    var cls = 'month-cell';
    if (!isThisMonth) cls += ' other-month';
    if (_isToday)     cls += ' today';

    var cell = document.createElement('div');
    cell.className = cls;

    var dayEvents = State.getEventsOnDate(cellDate).sort(function(a, b) {
      return parseLocalDT(a.start_iso) - parseLocalDT(b.start_iso);
    });

    var MAX_PILLS  = 3;
    var visible    = dayEvents.slice(0, MAX_PILLS);
    var overflowCt = dayEvents.length - MAX_PILLS;

    var pillsHtml = '';
    for (var p = 0; p < visible.length; p++) {
      var ev      = visible[p];
      var retTag  = ev.is_return ? ' \u21A9' : '';
      var tooltip = (ev.is_return ? '[RETURN] ' : '') + 'PO ' + escapeHtml(ev.po_number) +
                    ' \u00B7 ' + escapeHtml(ev.location) + ' \u00B7 ' +
                    formatTimeRange(ev.start_iso, ev.end_iso);
      pillsHtml +=
        '<div class="cell-event-pill"' +
        ' data-eid="' + ev.id + '"' +
        ' role="button" tabindex="0"' +
        ' style="--pill-dot:' + ev.color + ';--pill-bg:' + hexAlpha(ev.color, 0.18) + ';--pill-color:' + darkenColor(ev.color, 0.8) + '"' +
        ' title="' + tooltip + '">' +
        escapeHtml(ev.vendor_name) + retTag +
        '</div>';
    }

    var overflowHtml = overflowCt > 0 ? '<div class="cell-overflow">+' + overflowCt + ' more</div>' : '';

    cell.innerHTML =
      '<div class="cell-date">' + cellDate.getDate() + '</div>' +
      '<div class="cell-events">' + pillsHtml + overflowHtml + '</div>';

    (function(cd) {
      cell.addEventListener('click', function(e) {
        if (e.target.closest('.cell-event-pill')) return;
        Modal.open({ start_iso: toLocalDT(cd, 7, 0), end_iso: toLocalDT(cd, 9, 0) });
      });
    })(cellDate);

    grid.appendChild(cell);
  }

  var pills = grid.querySelectorAll('.cell-event-pill');
  for (var pi = 0; pi < pills.length; pi++) {
    (function(pill) {
      var ev = null;
      var events = State.getEvents();
      for (var ei = 0; ei < events.length; ei++) {
        if (events[ei].id === pill.dataset.eid) { ev = events[ei]; break; }
      }
      if (!ev) return;
      pill.addEventListener('click', function(e) { e.stopPropagation(); Modal.open(ev); });
      pill.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); Modal.open(ev); }
      });
    })(pills[pi]);
  }
}

/* ════════════════════════════════════════════════
   §8 · WEEK VIEW
════════════════════════════════════════════════ */

function renderWeekView(container, date) {
  var wStart = startOfWeek(date);
  var days   = [];
  for (var di = 0; di < 7; di++) days.push(addDays(wStart, di));

  var headerHtml = '';
  for (var dh = 0; dh < days.length; dh++) {
    var day = days[dh];
    var cls = 'week-header-day' + (isToday(day) ? ' today' : '');
    var ds  = toLocalDT(day).split('T')[0];
    headerHtml +=
      '<div class="' + cls + '" data-date="' + ds + '" role="button" tabindex="0">' +
        '<div class="week-day-name">' + DAYS_SHORT[day.getDay()] + '</div>' +
        '<div class="week-day-num">' + day.getDate() + '</div>' +
      '</div>';
  }

  var timeAxisHtml = '';
  for (var h = 0; h < 24; h++) {
    timeAxisHtml += '<div class="time-label">' + (h === 0 ? '' : formatHour(h)) + '</div>';
  }

  var colsHtml = '';
  for (var dc = 0; dc < days.length; dc++) {
    var ds2  = toLocalDT(days[dc]).split('T')[0];
    var cells = '';
    for (var hc = 0; hc < 24; hc++) {
      cells += '<div class="hour-cell" data-date="' + ds2 + '" data-hour="' + hc + '"></div>';
    }
    colsHtml += '<div class="week-day-col" data-date="' + ds2 + '">' + cells + '</div>';
  }

  container.innerHTML =
    '<div class="week-view view-enter">' +
      '<div class="week-header">' +
        '<div class="week-header-gutter"></div>' + headerHtml +
      '</div>' +
      '<div class="week-scroll" id="week-scroll">' +
        '<div class="week-time-axis">' + timeAxisHtml + '</div>' +
        '<div class="week-grid" id="week-grid">' + colsHtml + '</div>' +
      '</div>' +
    '</div>';

  var cols = container.querySelectorAll('.week-day-col');
  for (var ci = 0; ci < cols.length; ci++) {
    (function(col, day) {
      if (isToday(day)) col.classList.add('is-today');

      var layouts = computeLayouts(State.getEventsOnDate(day));
      for (var li = 0; li < layouts.length; li++) {
        col.appendChild(makeTimeEventEl(layouts[li].event, layouts[li].lane, layouts[li].totalLanes));
      }

      var hourCells = col.querySelectorAll('.hour-cell');
      for (var hi = 0; hi < hourCells.length; hi++) {
        (function(cell) {
          cell.addEventListener('click', function() {
            var hr = parseInt(cell.dataset.hour, 10);
            var cd = parseLocalDT(cell.dataset.date + 'T00:00');
            Modal.open({ start_iso: toLocalDT(cd, hr, 0), end_iso: toLocalDT(cd, hr + 2, 0) });
          });
        })(hourCells[hi]);
      }
    })(cols[ci], days[ci]);
  }

  var dayHeaders = container.querySelectorAll('.week-header-day');
  for (var dhi = 0; dhi < dayHeaders.length; dhi++) {
    (function(el) {
      function jump() {
        State.setDate(parseLocalDT(el.dataset.date + 'T00:00'));
        State.setView('day');
        var btns = document.querySelectorAll('.view-btn');
        for (var bi = 0; bi < btns.length; bi++) {
          btns[bi].classList.toggle('active', btns[bi].dataset.view === 'day');
          btns[bi].setAttribute('aria-pressed', btns[bi].dataset.view === 'day' ? 'true' : 'false');
        }
      }
      el.addEventListener('click', jump);
      el.addEventListener('keydown', function(e) { if (e.key === 'Enter' || e.key === ' ') jump(); });
    })(dayHeaders[dhi]);
  }

  placeNowLine(container, '.week-day-col', days);

  setTimeout(function() {
    var scroll = container.querySelector('#week-scroll');
    if (scroll) scroll.scrollTop = 6 * PX_PER_HR;
  }, 60);
}

/* ════════════════════════════════════════════════
   §9 · DAY VIEW
════════════════════════════════════════════════ */

function renderDayView(container, date) {
  var timeAxisHtml = '';
  var cellsHtml    = '';
  for (var h = 0; h < 24; h++) {
    timeAxisHtml += '<div class="time-label">' + (h === 0 ? '' : formatHour(h)) + '</div>';
    cellsHtml    += '<div class="hour-cell" data-hour="' + h + '"></div>';
  }

  container.innerHTML =
    '<div class="day-view view-enter">' +
      '<div class="day-header">' +
        '<div class="day-title">' +
          date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) +
        '</div>' +
        '<div class="day-subtitle">' +
          date.getFullYear() + (isToday(date) ? ' \u00B7 Today' : '') +
        '</div>' +
      '</div>' +
      '<div class="day-scroll" id="day-scroll">' +
        '<div class="day-time-axis">' + timeAxisHtml + '</div>' +
        '<div class="day-grid" id="day-grid">' + cellsHtml + '</div>' +
      '</div>' +
    '</div>';

  var dayGrid = container.querySelector('#day-grid');
  var layouts = computeLayouts(State.getEventsOnDate(date));
  for (var li = 0; li < layouts.length; li++) {
    dayGrid.appendChild(makeTimeEventEl(layouts[li].event, layouts[li].lane, layouts[li].totalLanes));
  }

  var hourCells = dayGrid.querySelectorAll('.hour-cell');
  for (var hi = 0; hi < hourCells.length; hi++) {
    (function(cell) {
      cell.addEventListener('click', function() {
        var hr = parseInt(cell.dataset.hour, 10);
        Modal.open({ start_iso: toLocalDT(date, hr, 0), end_iso: toLocalDT(date, hr + 2, 0) });
      });
    })(hourCells[hi]);
  }

  if (isToday(date)) placeNowLine(container, '#day-grid', [date]);

  setTimeout(function() {
    var scroll = container.querySelector('#day-scroll');
    if (scroll) scroll.scrollTop = 6 * PX_PER_HR;
  }, 60);
}

/* ════════════════════════════════════════════════
   §10 · NOW-LINE
════════════════════════════════════════════════ */

var _nowLineTimer = null;

function placeNowLine(container, selector, days) {
  if (_nowLineTimer) { clearInterval(_nowLineTimer); _nowLineTimer = null; }

  function draw() {
    var oldLines = container.querySelectorAll('.now-line');
    for (var i = 0; i < oldLines.length; i++) oldLines[i].remove();

    var now = new Date();
    var top = (now.getHours() + now.getMinutes() / 60) * PX_PER_HR;
    var cols = container.querySelectorAll(selector);
    for (var j = 0; j < cols.length; j++) {
      if (!days[j] || !isToday(days[j])) continue;
      var line = document.createElement('div');
      line.className = 'now-line';
      line.style.top = top + 'px';
      cols[j].appendChild(line);
    }
  }

  draw();
  _nowLineTimer = setInterval(draw, 60000);
}

/* ════════════════════════════════════════════════
   §11 · MAIN RENDERER
════════════════════════════════════════════════ */

function updatePeriodLabel() {
  var el   = document.getElementById('current-period');
  var d    = State.getDate();
  var view = State.getView();
  if      (view === 'month') el.textContent = formatMonthYear(d);
  else if (view === 'week')  el.textContent = formatWeekRange(d);
  else el.textContent = d.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' });
}

function render() {
  var container = document.getElementById('calendar-container');
  var view      = State.getView();
  var date      = State.getDate();

  updatePeriodLabel();
  renderUpcomingBar();

  if      (view === 'month') renderMonthView(container, date);
  else if (view === 'week')  renderWeekView(container, date);
  else                       renderDayView(container, date);
}

/* ════════════════════════════════════════════════
   §12 · NAVIGATION
════════════════════════════════════════════════ */

function navigate(dir) {
  var d    = State.getDate();
  var view = State.getView();
  if      (view === 'month') State.setDate(addMonths(d, dir));
  else if (view === 'week')  State.setDate(addDays(d, dir * 7));
  else                       State.setDate(addDays(d, dir));
}

/* ════════════════════════════════════════════════
   §13 · BOOTSTRAP
════════════════════════════════════════════════ */

(function init() {
  State.subscribe(render);
  render();

  State.load().then(function(ok) {
    if (!ok) return;

    db.channel('deliveries-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, function(payload) {
        State._applyRealtimeEvent(payload.eventType, payload.new || payload.old);
      })
      .subscribe(function(status) {
        if (status === 'SUBSCRIBED') console.log('Meridian: realtime connected');
      });

    document.getElementById('db-retry-btn').addEventListener('click', function() {
      hideDbError();
      State.load();
    });
  });

  function switchView(v) {
    var btns = document.querySelectorAll('.view-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', btns[i].dataset.view === v);
      btns[i].setAttribute('aria-pressed', btns[i].dataset.view === v ? 'true' : 'false');
    }
    State.setView(v);
  }

  var viewBtns = document.querySelectorAll('.view-btn');
  for (var vi = 0; vi < viewBtns.length; vi++) {
    (function(btn) {
      btn.addEventListener('click', function() { switchView(btn.dataset.view); });
    })(viewBtns[vi]);
  }

  document.getElementById('prev-btn').addEventListener('click',  function() { navigate(-1); });
  document.getElementById('next-btn').addEventListener('click',  function() { navigate(1); });
  document.getElementById('today-btn').addEventListener('click', function() { State.setDate(new Date()); });
  document.getElementById('add-event-btn').addEventListener('click', function() { Modal.open(); });

  document.addEventListener('keydown', function(e) {
    if (document.getElementById('modal-overlay').classList.contains('open')) return;
    var tag = document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === 'ArrowLeft')  navigate(-1);
    if (e.key === 'ArrowRight') navigate(1);
    if (e.key === 't') State.setDate(new Date());
    if (e.key === 'm') switchView('month');
    if (e.key === 'w') switchView('week');
    if (e.key === 'd') switchView('day');
  });
})();
