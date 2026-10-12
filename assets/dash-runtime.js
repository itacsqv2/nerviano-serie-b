/* Nerviano Basket, versione autonoma.
   Motore minimo che sostituisce quello delle dashboard di Claude: carica i file JSON in data/,
   esegue i calcoli dichiarati con dash.calc e ridisegna la pagina quando arrivano i dati
   o cambia la larghezza della finestra. */
(function () {
  'use strict';
  var FILES = window.NB_DATA_FILES || {};
  var store = {};
  var calcs = {};
  var listeners = [];

  Object.keys(FILES).forEach(function (id) {
    store[id] = { status: 'loading', data: [], meta: [], refreshing: false };
  });

  function compute() {
    var changed = true;
    while (changed) {
      changed = false;
      Object.keys(calcs).forEach(function (id) {
        var cur = store[id];
        if (cur && (cur.status === 'ok' || cur.status === 'error')) return;
        var def = calcs[id];
        var inputs = def.inputs.map(function (i) { return store[i]; });
        if (inputs.some(function (s) { return !s || s.status === 'error' || s.status === 'missing'; })) {
          store[id] = { status: 'error', data: [], meta: [], message: 'Dati di partenza non disponibili' };
          changed = true;
          return;
        }
        if (inputs.every(function (s) { return s.status === 'ok'; })) {
          try {
            store[id] = { status: 'ok', data: def.fn.apply(null, inputs.map(function (s) { return s.data; })), meta: [] };
          } catch (err) {
            console.error('Calcolo "' + id + '" non riuscito', err);
            store[id] = { status: 'error', data: [], meta: [], message: String(err) };
          }
          changed = true;
        }
      });
    }
  }

  function notify() {
    compute();
    listeners.forEach(function (fn) {
      try { fn(); } catch (err) { console.error(err); }
    });
  }

  window.dash = {
    data: function (id) { return store[id] || { status: 'missing', data: [], meta: [] }; },
    calc: function (id, def) {
      calcs[id] = def;
      if (!store[id]) store[id] = { status: 'loading', data: [], meta: [] };
      compute();
    },
    loader: function () {},
    onData: function (fn) {
      listeners.push(fn);
      try { fn(); } catch (err) { console.error(err); }
    },
    setLink: function (name) {
      try { history.replaceState(null, '', '#' + name); } catch (err) { /* link non aggiornato */ }
    },
    refresh: function () {},
    params: function () { return {}; },
    setParams: function () {},
    resetParams: function () {},
    colors: ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)',
      'var(--series-5)', 'var(--series-6)', 'var(--series-7)', 'var(--series-8)'],
  };

  Object.keys(FILES).forEach(function (id) {
    fetch(FILES[id], { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (d) {
        store[id] = { status: 'ok', data: Array.isArray(d) ? d : (d.rows || d.data || d.results || []), meta: [] };
      })
      .catch(function (err) {
        console.error('Dati "' + id + '" non caricati', err);
        store[id] = { status: 'error', data: [], meta: [], message: String(err) };
      })
      .then(notify);
  });

  var timer;
  var lastWidth = window.innerWidth;
  window.addEventListener('resize', function () {
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    clearTimeout(timer);
    timer = setTimeout(notify, 150);
  });
})();
