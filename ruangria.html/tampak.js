/*
 * RuangRia: materi "Melihat Bangun dari Berbagai Arah" (tampak depan, atas, samping kanan).
 *
 * Acuan tampilan dan alur: Storyboard_kubus_balok.pdf (halaman Canva 23 sampai 27).
 *   hal. 23  -> layar "arah"     (pilih arah pandang)
 *   hal. 24  -> layar "depan"
 *   hal. 25  -> layar "atas"
 *   hal. 26  -> layar "samping"  (samping kanan)
 *   hal. 27+ -> layar "latihan"  (Bangun Y, lalu soal serupa)
 * Tambahan di luar storyboard: layar "kenal" (mengenal bangun dari kubus satuan) dan "hasil".
 *
 * Prinsip penting: gambar TIDAK ditempel. Setiap bangun disimpan sebagai tabel tinggi kolom
 * (grid[baris][kolom], baris 0 = paling belakang, baris terakhir = paling depan, kolom 0 = paling kiri).
 * Gambar isometrik, proyeksi depan, atas, samping kanan, model 3D, dan model AR semuanya dihitung
 * dari tabel yang sama, sehingga selalu konsisten satu sama lain.
 *
 * Modul ini tidak bergantung pada React. script.js hanya menyediakan wadah (TampakHost) dan
 * menyerahkan kelas Three.js bawaan lewat window.RuangRiaThree, supaya tidak ada salinan Three.js kedua.
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* 1. Data bangun                                                      */
  /* ------------------------------------------------------------------ */

  var SHAPES = {
    X: { name: 'Bangun X', grid: [[2, 3, 1]] },                 // contoh storyboard
    Y: { name: 'Bangun Y', grid: [[1, 1, 2, 1]] },              // contoh latihan storyboard
    P: { name: 'Bangun P', grid: [[1, 3, 2]] },
    R: { name: 'Bangun R', grid: [[0, 3, 0], [1, 1, 1]] },
    S: { name: 'Bangun S', grid: [[1, 1, 3], [2, 1, 1]] },
    T: { name: 'Bangun T', grid: [[1, 2, 0], [3, 1, 2]] },
    U: { name: 'Bangun U', grid: [[2, 0], [1, 1]] }
  };

  var VIEW_NAME = { depan: 'tampak depan', atas: 'tampak atas', samping: 'tampak samping kanan' };
  var VIEW_TITLE = { depan: 'Tampak Depan', atas: 'Tampak Atas', samping: 'Tampak Samping Kanan' };

  // warna mengikuti storyboard: atas = biru muda, depan = biru, samping kanan = biru tua
  var COL = {
    top: '#8FB8FF', front: '#3B82F6', right: '#1E56C8', line: '#1F2A44', bg: '#E8F4FF'
  };
  var VIEW_COLOR = { depan: COL.front, atas: COL.top, samping: COL.right };
  var VIEW_FACE = { depan: 'front', atas: 'top', samping: 'right' };

  /* ------------------------------------------------------------------ */
  /* 2. Proyeksi (dihitung dari tabel tinggi kolom)                      */
  /* ------------------------------------------------------------------ */

  function maxOf(a) { return Math.max.apply(null, a); }

  function colHeights(g) {                       // tinggi kolom dilihat dari depan, kiri ke kanan
    var out = [];
    for (var c = 0; c < g[0].length; c++) {
      var m = 0;
      for (var r = 0; r < g.length; r++) m = Math.max(m, g[r][c]);
      out.push(m);
    }
    return out;
  }

  function sideHeights(g) {                      // dilihat dari kanan: kiri gambar = bagian depan bangun
    var out = [];
    for (var r = g.length - 1; r >= 0; r--) out.push(maxOf(g[r]));
    return out;
  }

  function heightsToMatrix(hs) {                 // matriks 0/1, baris pertama = tingkat teratas
    var H = maxOf(hs);
    var M = [];
    for (var l = H - 1; l >= 0; l--) {
      M.push(hs.map(function (h) { return h > l ? 1 : 0; }));
    }
    return M;
  }

  var VIEW = {
    depan: function (g) { return heightsToMatrix(colHeights(g)); },
    samping: function (g) { return heightsToMatrix(sideHeights(g)); },
    atas: function (g) { return g.map(function (row) { return row.map(function (h) { return h > 0 ? 1 : 0; }); }); }
  };

  function mKey(M) { return M.map(function (r) { return r.join(''); }).join('/'); }
  function mirrorH(M) { return M.map(function (r) { return r.slice().reverse(); }); }
  function flipV(M) { return M.slice().reverse().map(function (r) { return r.slice(); }); }
  function cubeCount(g) { var n = 0; g.forEach(function (r) { r.forEach(function (h) { n += h; }); }); return n; }

  function listID(a) {                           // [2,3,1] -> "2, 3, dan 1"
    if (a.length === 1) return String(a[0]);
    if (a.length === 2) return a[0] + ' dan ' + a[1];
    return a.slice(0, -1).join(', ') + ', dan ' + a[a.length - 1];
  }

  function ordinalList(idx) {                    // [0,1,2] -> "ke-1, ke-2, dan ke-3"
    return listID(idx.map(function (i) { return 'ke-' + (i + 1); }));
  }

  function describeTop(g) {
    if (g.length === 1) return 'Terlihat ' + g[0].filter(function (h) { return h > 0; }).length + ' persegi berjajar.';
    var parts = [];
    for (var r = 0; r < g.length; r++) {
      var idx = [];
      g[r].forEach(function (h, i) { if (h > 0) idx.push(i); });
      var label = r === 0 ? 'Baris belakang' : (r === g.length - 1 ? 'Baris depan' : 'Baris tengah');
      parts.push(label + ': persegi ' + (idx.length ? ordinalList(idx) : 'tidak ada') + ' dari kiri.');
    }
    return parts.join(' ');
  }

  /* ------------------------------------------------------------------ */
  /* 3. Gambar SVG                                                       */
  /* ------------------------------------------------------------------ */

  function mixHex(a, b, t) {                     // campur dua warna hex: a*(1-t) + b*t
    var pa = [1, 3, 5].map(function (i) { return parseInt(a.substr(i, 2), 16); });
    var pb = [1, 3, 5].map(function (i) { return parseInt(b.substr(i, 2), 16); });
    return '#' + pa.map(function (v, i) {
      var x = Math.round(v * (1 - t) + pb[i] * t);
      return (x < 16 ? '0' : '') + x.toString(16);
    }).join('');
  }

  function f1(n) { return Math.round(n * 100) / 100; }

  /* Gambar tiga dimensi isometrik. Kamera di depan-kanan-atas, seperti ilustrasi storyboard:
   * sisi atas = biru muda, sisi depan = biru, sisi kanan = biru tua, garis batas antarkubus tegas. */
  function isoSVG(grid, opt) {
    opt = opt || {};
    var hi = opt.highlight || null;              // 'top' | 'front' | 'right' | null
    var u = 40, c30 = Math.cos(Math.PI / 6);
    var cubes = [];
    for (var r = 0; r < grid.length; r++) {
      for (var c = 0; c < grid[r].length; c++) {
        for (var y = 0; y < grid[r][c]; y++) cubes.push({ x: c, y: y, z: r });
      }
    }
    cubes.sort(function (a, b) { return (a.x + a.y + a.z) - (b.x + b.y + b.z); });

    function P(x, y, z) { return [(x - z) * c30 * u, ((x + z) * 0.5 - y) * u]; }
    var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    function track(p) {
      minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
      minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
    }
    function face(pts, kind) {
      pts.forEach(track);
      var fill = COL[kind];
      if (hi && hi !== kind) fill = mixHex(COL[kind], COL.bg, 0.62);
      return '<polygon points="' + pts.map(function (p) { return f1(p[0]) + ',' + f1(p[1]); }).join(' ') +
        '" fill="' + fill + '" stroke="' + COL.line + '" stroke-width="1.8" stroke-linejoin="round"/>';
    }

    var body = '';
    cubes.forEach(function (q) {
      var x = q.x, y = q.y, z = q.z;
      body += face([P(x, y, z + 1), P(x + 1, y, z + 1), P(x + 1, y + 1, z + 1), P(x, y + 1, z + 1)], 'front');
      body += face([P(x + 1, y, z), P(x + 1, y, z + 1), P(x + 1, y + 1, z + 1), P(x + 1, y + 1, z)], 'right');
      body += face([P(x, y + 1, z), P(x + 1, y + 1, z), P(x + 1, y + 1, z + 1), P(x, y + 1, z + 1)], 'top');
    });

    var pad = 8;
    var vb = [f1(minX - pad), f1(minY - pad), f1(maxX - minX + pad * 2), f1(maxY - minY + pad * 2)];
    if (opt.measure) return { w: vb[2], h: vb[3] };
    if (opt.fit) {                                // samakan skala: pusatkan horizontal, rata bawah
      vb[0] = f1(vb[0] - (opt.fit.w - vb[2]) / 2);
      vb[1] = f1(vb[1] - (opt.fit.h - vb[3]));
      vb[2] = opt.fit.w; vb[3] = opt.fit.h;
    }
    var label = (opt.label || 'Bangun') + ' tersusun dari ' + cubeCount(grid) + ' kubus satuan.';
    return '<svg class="tb-iso" xmlns="http://www.w3.org/2000/svg" viewBox="' + vb.join(' ') +
      '" role="img" aria-label="' + label + '" preserveAspectRatio="xMidYMid meet">' + body + '</svg>';
  }

  /* Gambar dua dimensi (proyeksi). M = matriks 0/1, baris pertama di atas. */
  function viewSVG(M, color, opt) {
    opt = opt || {};
    var cols = M[0].length, rows = M.length;
    var cell = 40;
    var W = (opt.cols || cols) * cell, H = (opt.rows || rows) * cell;
    var offX = (W - cols * cell) / 2;
    var offY = opt.align === 'center' ? (H - rows * cell) / 2 : H - rows * cell;   // rata bawah untuk depan dan samping
    var s = '';
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        if (M[r][c]) {
          s += '<rect x="' + f1(offX + c * cell) + '" y="' + f1(offY + r * cell) + '" width="' + cell + '" height="' + cell +
            '" fill="' + color + '" stroke="' + COL.line + '" stroke-width="1.6" stroke-linejoin="round"/>';
        }
      }
    }
    var pad = 4;
    return '<svg class="tb-view" xmlns="http://www.w3.org/2000/svg" viewBox="' + (-pad) + ' ' + (-pad) + ' ' + (W + pad * 2) + ' ' +
      (H + pad * 2) + '" role="img" aria-label="' + (opt.label || 'Proyeksi bangun') + '" preserveAspectRatio="xMidYMid meet">' + s + '</svg>';
  }

  /* ------------------------------------------------------------------ */
  /* 4. Soal latihan                                                     */
  /* ------------------------------------------------------------------ */

  var HINT = {
    depan: {
      'cermin': 'Gambar ini terbalik kiri dan kanan. Berdirilah di depan bangun, lalu lihat kolom paling kiri lebih dulu.',
      'posisi': 'Kolom tertinggi pada gambar ini ada di tempat yang berbeda. Hitung dari kiri, kolom ke berapa yang paling tinggi pada bangun?',
      'hitung': 'Hitung lagi jumlah kubus pada setiap kolom. Ada satu kolom pada gambar ini yang kurang atau lebih satu kubus.',
      'lain:atas': 'Gambar ini adalah tampak atas, bukan tampak depan. Dari depan, kita bisa melihat tinggi bangun.',
      'lain:samping': 'Gambar ini adalah tampak samping kanan, bukan tampak depan. Bayangkan kamu berdiri tepat di depan bangun.'
    },
    atas: {
      'cermin': 'Gambar ini terbalik kiri dan kanan. Dari atas, sisi kiri bangun tetap berada di sisi kiri gambar.',
      'terbalik': 'Gambar ini terbalik depan dan belakang. Pada tampak atas, bagian depan bangun ada di sisi bawah gambar.',
      'hitung': 'Hitung lagi persegi yang terlihat dari atas. Ada satu persegi pada gambar ini yang kurang atau lebih.',
      'lain:depan': 'Gambar ini adalah tampak depan, bukan tampak atas. Dari atas, kita hanya melihat atap setiap kolom.',
      'lain:samping': 'Gambar ini adalah tampak samping kanan, bukan tampak atas. Dari atas, kita melihat bangun seperti peta.'
    },
    samping: {
      'cermin': 'Gambar ini terbalik. Dari samping kanan, bagian depan bangun ada di sebelah kiri gambar.',
      'hitung': 'Hitung lagi jumlah kubus pada setiap kolom. Ada satu kolom pada gambar ini yang kurang atau lebih satu kubus.',
      'lain:depan': 'Gambar ini adalah tampak depan, bukan tampak samping kanan. Coba berdiri di sisi kanan bangun.',
      'lain:atas': 'Gambar ini adalah tampak atas, bukan tampak samping kanan. Dari samping, kita melihat tinggi bangun.'
    }
  };

  function clueFor(view, g) {
    if (view === 'depan') return 'Petunjuk: dari depan, tinggi kolom dari kiri ke kanan adalah ' + listID(colHeights(g)) + ' kubus.';
    if (view === 'samping') return 'Petunjuk: dari samping kanan, bagian depan bangun ada di kiri gambar. Tinggi kolomnya dari kiri ke kanan adalah ' + listID(sideHeights(g)) + ' kubus.';
    return 'Petunjuk: ' + describeTop(g);
  }

  function explainFor(view, g) {
    var multi = g.length > 1;
    if (view === 'depan') {
      return 'Dari depan, tinggi kolom dari kiri ke kanan adalah ' + listID(colHeights(g)) + ' kubus.' +
        (multi ? ' Kubus di belakang tertutup kubus di depannya, jadi yang dihitung adalah tinggi terbesar pada tiap kolom.' : '');
    }
    if (view === 'samping') {
      return 'Dari samping kanan, bagian depan bangun ada di kiri gambar. Tinggi kolomnya dari kiri ke kanan adalah ' + listID(sideHeights(g)) + ' kubus.' +
        (multi ? ' Kubus yang sejajar dengan arah pandangmu saling menutupi, jadi yang dihitung adalah yang tertinggi.' : '');
    }
    return 'Dari atas, kita hanya melihat atap setiap kolom. ' + describeTop(g);
  }

  /*
   * Soal 1 memakai pilihan persis seperti storyboard (hal. 27): Bangun Y, tinggi 1, 1, 2, 1.
   * Pilihan A tonjolan di kolom 2 (terbalik kiri-kanan), B tonjolan di kolom 1, C benar.
   * Soal lain: pengecoh dihitung otomatis dari bangunnya (lihat buildOptions).
   */
  var QUESTIONS = [
    { shape: 'Y', view: 'depan', pos: 2,
      explicit: [{ h: [1, 2, 1, 1], kind: 'cermin' }, { h: [2, 1, 1, 1], kind: 'posisi' }] },
    { shape: 'P', view: 'depan', pos: 0, want: ['cermin', 'lain:samping', 'hitung'] },
    { shape: 'R', view: 'atas', pos: 1, want: ['terbalik', 'lain:samping', 'hitung'] },
    { shape: 'S', view: 'samping', pos: 2, want: ['cermin', 'lain:depan', 'hitung'] },
    { shape: 'T', view: 'depan', pos: 1, want: ['cermin', 'hitung', 'lain:samping'] },
    { shape: 'U', view: 'atas', pos: 0, want: ['cermin', 'terbalik', 'hitung'] }
  ];

  function candidates(view, g) {
    var base = VIEW[view](g);
    var list = [];
    list.push({ m: mirrorH(base), kind: 'cermin' });
    if (view === 'atas') list.push({ m: flipV(base), kind: 'terbalik' });
    ['depan', 'atas', 'samping'].forEach(function (v) {
      if (v !== view) list.push({ m: VIEW[v](g), kind: 'lain:' + v });
    });
    // salah hitung satu kubus
    if (view === 'atas') {
      var rows = base.length, cols = base[0].length, done = false;
      for (var r = 0; r < rows && !done; r++) {
        for (var c = 0; c < cols && !done; c++) {
          if (!base[r][c]) {
            var cp = base.map(function (x) { return x.slice(); });
            cp[r][c] = 1;
            list.push({ m: cp, kind: 'hitung' });
            done = true;
          }
        }
      }
      if (!done) {
        var cp2 = base.map(function (x) { return x.slice(); });
        cp2[rows - 1][cols - 1] = 0;
        list.push({ m: cp2, kind: 'hitung' });
      }
    } else {
      var hs = view === 'depan' ? colHeights(g) : sideHeights(g);
      var order = hs.map(function (_, i) { return i; }).sort(function (a, b) { return hs[b] - hs[a]; });
      order.forEach(function (i) {
        var up = hs.slice(); up[i] += 1; list.push({ m: heightsToMatrix(up), kind: 'hitung' });
        if (hs[i] > 1) { var dn = hs.slice(); dn[i] -= 1; list.push({ m: heightsToMatrix(dn), kind: 'hitung' }); }
      });
    }
    return list;
  }

  function buildOptions(q) {
    var g = SHAPES[q.shape].grid;
    var correct = VIEW[q.view](g);
    var seen = {};
    seen[mKey(correct)] = true;
    var picked = [];

    if (q.explicit) {
      q.explicit.forEach(function (e) {
        var m = heightsToMatrix(e.h);
        if (!seen[mKey(m)]) { seen[mKey(m)] = true; picked.push({ m: m, kind: e.kind }); }
      });
    } else {
      var cands = candidates(q.view, g);
      (q.want || []).forEach(function (kind) {
        if (picked.length >= 2) return;
        for (var i = 0; i < cands.length; i++) {
          if (cands[i].kind === kind && !seen[mKey(cands[i].m)]) {
            seen[mKey(cands[i].m)] = true; picked.push(cands[i]); return;
          }
        }
      });
      cands.forEach(function (cd) {
        if (picked.length >= 2) return;
        if (!seen[mKey(cd.m)]) { seen[mKey(cd.m)] = true; picked.push(cd); }
      });
    }

    var opts = picked.slice(0, 2).map(function (p) { return { m: p.m, kind: p.kind, correct: false }; });
    opts.splice(q.pos, 0, { m: correct, kind: 'benar', correct: true });
    return opts;
  }

  /* ------------------------------------------------------------------ */
  /* 5. Model 3D (dipakai viewer, AR WebXR, dan AR mode kamera)           */
  /* ------------------------------------------------------------------ */

  var CUBE = 0.62;   // sisi satu kubus satuan dalam satuan scene

  function buildModel(id) {
    var T = window.RuangRiaThree;
    if (!T) throw new Error('Three.js belum siap.');
    var key = String(id || 'X').replace(/^tampak:/, '');
    var shape = SHAPES[key] || SHAPES.X;
    var g = shape.grid, R = g.length, C = g[0].length, H = maxOf(colHeights(g));
    var group = new T.Group();
    var geo = new T.Box(CUBE, CUBE, CUBE);
    var edges = new T.Edges(geo, 1);
    var mat = new T.Std({ color: COL.front, roughness: 0.55, metalness: 0.02 });
    var lineMat = new T.LineMat({ color: 0x1f2a44 });
    for (var r = 0; r < R; r++) {
      for (var c = 0; c < C; c++) {
        for (var y = 0; y < g[r][c]; y++) {
          var m = new T.Mesh(geo, mat);
          var px = (c + 0.5 - C / 2) * CUBE, py = (y + 0.5 - H / 2) * CUBE, pz = (r + 0.5 - R / 2) * CUBE;
          m.position.set(px, py, pz);
          var l = new T.Lines(edges, lineMat);
          l.position.set(px, py, pz);
          group.add(m);
          group.add(l);
        }
      }
    }
    group.userData = { tampak: key };
    return group;
  }

  /* Tombol arah pandang di AR mode kamera. q = rotasi model relatif terhadap kamera (x, y, z, w).
   * Depan: tanpa rotasi. Atas: putar 90 derajat pada sumbu X. Samping kanan: putar -90 derajat pada sumbu Y. */
  var S45 = Math.SQRT1_2;
  var AR_VIEWS = [
    { id: 'depan', label: 'Depan', q: [0, 0, 0, 1] },
    { id: 'atas', label: 'Atas', q: [S45, 0, 0, S45] },
    { id: 'samping', label: 'Samping kanan', q: [0, -S45, 0, S45] }
  ];

  /* ------------------------------------------------------------------ */
  /* 6. Penyimpanan kecil (rekor latihan)                                */
  /* ------------------------------------------------------------------ */

  var STORE_KEY = 'ruangria-tampak-v1';
  function loadStore() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      return { best: typeof s.best === 'number' ? s.best : 0, plays: typeof s.plays === 'number' ? s.plays : 0 };
    } catch (_) { return { best: 0, plays: 0 }; }
  }
  function saveStore(s) { try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (_) { /* penyimpanan tidak tersedia */ } }

  /* ------------------------------------------------------------------ */
  /* 7. Antarmuka                                                        */
  /* ------------------------------------------------------------------ */

  var SCREEN_TITLE = {
    kenal: 'Mengenal Bangun dari Kubus',
    arah: 'Melihat dari Berbagai Arah',
    depan: VIEW_TITLE.depan,
    atas: VIEW_TITLE.atas,
    samping: VIEW_TITLE.samping,
    hasil: 'Hasil Latihan'
  };
  var TP_TAG = { arah: 1, depan: 1, atas: 1, samping: 1, latihan: 1 };

  var ICON_EYE = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
  var ICON_AR = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="m12 8 4 2.2v4.6L12 17l-4-2.2v-4.6L12 8Zm0 4.5 4-2.3M12 12.5v4.5M12 12.5 8 10.2"/></svg>';

  function mount(container, opts) {
    opts = opts || {};
    var st = loadStore();
    var state = {
      screen: 'kenal',
      lastTampak: 'samping',
      reveal: false,
      q: null,           // keadaan latihan
      viewerOpen: false
    };
    var disposed = false;
    var listeners = [];
    var viewer = null;   // objek viewer 3D (dibuat saat pertama dibuka)

    function on(target, type, fn, o) {
      target.addEventListener(type, fn, o);
      listeners.push(function () { target.removeEventListener(type, fn, o); });
    }
    function play(name) { try { if (opts.play) opts.play(name); } catch (_) { /* suara tidak wajib */ } }

    /* ---------- kerangka ---------- */
    container.innerHTML =
      '<div class="tb-host" data-tb-root>' +
        '<section class="tb-stage" aria-labelledby="tb-title">' +
          '<header class="tb-head"><h2 id="tb-title" tabindex="-1"></h2><span class="tb-tag" hidden>Bagian C | TP 3</span></header>' +
          '<div class="tb-body" data-tb-body></div>' +
        '</section>' +
        '<div class="tb-live" aria-live="polite" role="status" data-tb-live></div>' +
      '</div>';
    var root = container.firstChild;
    var elTitle = root.querySelector('#tb-title');
    var elTag = root.querySelector('.tb-tag');
    var elBody = root.querySelector('[data-tb-body]');
    var elLive = root.querySelector('[data-tb-live]');
    // Dialog 3D dipasang di <body>, bukan di dalam halaman: animasi masuk halaman aplikasi memakai transform,
    // dan transform membuat position:fixed ikut terikat ke elemen itu, bukan ke layar.
    var elModal = document.createElement('div');
    elModal.className = 'tb-host tb-modal';
    elModal.hidden = true;
    document.body.appendChild(elModal);

    function say(t) { elLive.textContent = ''; setTimeout(function () { if (!disposed) elLive.textContent = t; }, 30); }

    /* ---------- potongan HTML yang dipakai ulang ---------- */
    function pill(act, cls, label, extra) {
      return '<button type="button" class="tb-pill ' + cls + '" data-act="' + act + '"' + (extra || '') + '>' + label + '</button>';
    }
    function footNav(withLatihan) {
      return '<div class="tb-foot">' +
        '<div class="tb-foot-l">' + pill('back', 'tb-kembali', 'KEMBALI') + '</div>' +
        '<div class="tb-foot-c">' + pill('menu', 'tb-menu', 'MENU') + '</div>' +
        '<div class="tb-foot-r">' + (withLatihan ? pill('latihan', 'tb-latihan', 'LATIHAN') : '') + '</div>' +
        '</div>';
    }
    function tools3d(key) {
      var s = '<div class="tb-tools">' +
        '<button type="button" class="tb-tool" data-act="viewer" data-shape="' + key + '">' + ICON_EYE + '<span>Putar 3D</span></button>';
      if (opts.onAR) s += '<button type="button" class="tb-tool" data-act="ar" data-shape="' + key + '">' + ICON_AR + '<span>Lihat dalam AR</span></button>';
      return s + '</div>';
    }

    /* ---------- layar-layar ---------- */
    function screenKenal() {
      var X = SHAPES.X, Y = SHAPES.Y;
      var mx = isoSVG(X.grid, { measure: true }), my = isoSVG(Y.grid, { measure: true });
      var fit = { w: Math.max(mx.w, my.w), h: Math.max(mx.h, my.h) };
      return '<div class="tb-grid tb-grid-kenal">' +
        '<div class="tb-fig-pair">' +
          '<figure class="tb-fig">' + isoSVG(X.grid, { label: X.name, fit: fit }) + '<figcaption class="tb-caption">' + X.name + '</figcaption></figure>' +
          '<figure class="tb-fig">' + isoSVG(Y.grid, { label: Y.name, fit: fit }) + '<figcaption class="tb-caption">' + Y.name + '</figcaption></figure>' +
        '</div>' +
        '<div class="tb-side">' +
          '<p class="tb-text">' + X.name + ' tersusun dari ' + cubeCount(X.grid) + ' kubus satuan. ' + Y.name + ' tersusun dari ' + cubeCount(Y.grid) + ' kubus satuan. ' +
            'Kubus satuan adalah kubus kecil yang ukurannya sama. Garis di antara kubus membantu kita menghitungnya.</p>' +
          '<p class="tb-hint"><strong>Petunjuk:</strong> bangun yang sama bisa terlihat berbeda jika dilihat dari arah yang berbeda.</p>' +
          tools3d('X') +
          '<div class="tb-actions">' + pill('arah', 'tb-depan', 'LANJUT') + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="tb-foot"><div class="tb-foot-l">' + pill('exit', 'tb-kembali', 'KEMBALI') + '</div><div class="tb-foot-c">' + pill('menu', 'tb-menu', 'MENU') + '</div><div class="tb-foot-r"></div></div>';
    }

    function screenArah() {
      return '<div class="tb-grid">' +
        '<figure class="tb-fig">' + isoSVG(SHAPES.X.grid, { label: SHAPES.X.name }) + '<figcaption class="tb-caption">Bangun X</figcaption></figure>' +
        '<div class="tb-side">' +
          '<p class="tb-text">Bangun yang sama bisa terlihat berbeda jika dilihat dari arah yang berbeda. Pilih arah pandang:</p>' +
          '<div class="tb-dirs">' +
            pill('go:depan', 'tb-depan tb-big', 'DEPAN') +
            pill('go:atas', 'tb-atas tb-big', 'ATAS') +
            pill('go:samping', 'tb-samping tb-big', 'SAMPING KANAN') +
          '</div>' +
          tools3d('X') +
        '</div>' +
      '</div>' + footNav(false);
    }

    function screenTampak(view) {
      var g = SHAPES.X.grid;
      var M = VIEW[view](g);
      var others = ['depan', 'atas', 'samping'].filter(function (v) { return v !== view; });
      var sideBtn = { depan: 'DEPAN', atas: 'ATAS', samping: 'SAMPING' };
      var text, extra = '';
      if (view === 'depan') {
        var h = colHeights(g);
        text = 'Tampak depan: tinggi persegi kiri, tengah, dan kanan adalah ' + listID(h) + '.';
      } else if (view === 'atas') {
        text = 'Tampak atas: ' + g[0].length + ' persegi berjajar.';
        extra = '<p class="tb-note">Dari atas, yang terlihat hanyalah atap setiap kolom kubus.</p>';
      } else {
        text = 'Tampak samping kanan: ' + sideHeights(g)[0] + ' persegi bertumpuk. Mengapa tampak depan dan tampak samping bisa berbeda?';
        extra = state.reveal
          ? '<div class="tb-answer" role="note"><strong>Jawabannya:</strong> karena arah pandangnya berbeda. Dari samping kanan, ketiga kolom berbaris searah pandanganmu dan saling menutupi, sehingga yang terlihat hanya kolom tertinggi, yaitu ' + sideHeights(g)[0] + ' kubus.</div>'
          : '<button type="button" class="tb-tool" data-act="reveal">Lihat jawabannya</button>';
      }
      return '<div class="tb-grid tb-grid-view">' +
        '<div class="tb-left">' +
          '<figure class="tb-fig tb-fig-small">' + isoSVG(g, { highlight: VIEW_FACE[view], label: SHAPES.X.name }) + '<figcaption class="tb-caption">Bangun X</figcaption></figure>' +
          '<div class="tb-switch" role="group" aria-label="Pilih arah pandang lain">' +
            others.map(function (v) { return pill('go:' + v, 'tb-' + v + ' tb-small', sideBtn[v]); }).join('') +
          '</div>' +
        '</div>' +
        '<figure class="tb-fig tb-fig-proj">' +
          viewSVG(M, VIEW_COLOR[view], { label: VIEW_TITLE[view] + ' Bangun X', align: view === 'atas' ? 'center' : 'bottom' }) +
          '<figcaption class="tb-caption">' + VIEW_NAME[view].charAt(0).toUpperCase() + VIEW_NAME[view].slice(1) + '</figcaption>' +
        '</figure>' +
        '<div class="tb-side">' +
          '<p class="tb-text" data-tb-focus tabindex="-1">' + text + '</p>' + extra + tools3d('X') +
        '</div>' +
      '</div>' + footNav(true);
    }

    function newQuiz() {
      return { i: 0, wrong: [], tries: 0, solved: false, points: 0, firstTry: 0, hint: '', answers: [] };
    }

    function screenLatihan() {
      var qz = state.q;
      var q = QUESTIONS[qz.i];
      var shape = SHAPES[q.shape];
      var options = q.built || (q.built = buildOptions(q));
      var cols = 0, rows = 0;
      options.forEach(function (o) { cols = Math.max(cols, o.m[0].length); rows = Math.max(rows, o.m.length); });
      var letters = ['A', 'B', 'C'];
      var total = QUESTIONS.length;
      var pct = Math.round((qz.i + (qz.solved ? 1 : 0)) / total * 100);

      var optHTML = options.map(function (o, idx) {
        var cls = 'tb-opt', dis = '', badge = '';
        var isWrong = qz.wrong.indexOf(idx) >= 0;
        if (isWrong) { cls += ' is-wrong'; dis = ' disabled'; badge = '<span class="tb-badge bad" aria-hidden="true">✕</span>'; }
        if (qz.solved) {
          dis = ' disabled';
          if (o.correct) { cls += ' is-right'; badge = '<span class="tb-badge good" aria-hidden="true">✓</span>'; }
        }
        var status = isWrong ? ' (salah)' : (qz.solved && o.correct ? ' (benar)' : '');
        return '<button type="button" class="' + cls + '" data-act="pick:' + idx + '"' + dis + ' aria-label="Pilihan ' + letters[idx] + status + '">' +
          badge +
          viewSVG(o.m, VIEW_COLOR[q.view], { cols: cols, rows: rows, align: q.view === 'atas' ? 'center' : 'bottom', label: 'Pilihan ' + letters[idx] }) +
          '<span class="tb-opt-letter">' + letters[idx] + '</span></button>';
      }).join('');

      var fb = '';
      if (qz.solved) {
        var gotWhat = qz.tries === 1 ? 'Hebat, benar pada percobaan pertama!' : 'Benar! Kamu berhasil setelah mencoba lagi.';
        fb = '<div class="tb-feedback ok" data-tb-focus tabindex="-1"><strong>' + gotWhat + '</strong> ' + explainFor(q.view, shape.grid) + '</div>' +
          '<div class="tb-actions tb-actions-center">' +
            pill('next', 'tb-latihan', qz.i === total - 1 ? 'LIHAT HASIL' : 'SOAL BERIKUTNYA') + '</div>';
      } else if (qz.hint) {
        fb = '<div class="tb-feedback tip" data-tb-focus tabindex="-1"><strong>Belum tepat, ayo coba lagi.</strong> ' + qz.hint + '</div>';
      } else {
        fb = '<div class="tb-feedback idle">Pilih gambar yang menurutmu benar. Kalau ragu, putar bangunnya dulu.</div>';
      }

      return '<div class="tb-progress"><span>Soal ' + (qz.i + 1) + ' dari ' + total + '</span>' +
          '<div class="tb-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '" aria-label="Kemajuan latihan"><i style="width:' + pct + '%"></i></div>' +
          '<span class="tb-score">Poin: ' + qz.points + '</span></div>' +
        '<div class="tb-qfig"><figure class="tb-fig tb-fig-q">' + isoSVG(shape.grid, { label: shape.name }) + '<figcaption class="tb-caption">' + shape.name + '</figcaption></figure>' +
          tools3d(q.shape) + '</div>' +
        '<div class="tb-opts" role="group" aria-label="Pilihan jawaban">' + optHTML + '</div>' +
        fb +
        '<div class="tb-foot"><div class="tb-foot-l">' + pill('back', 'tb-kembali', 'KEMBALI') + '</div><div class="tb-foot-c">' + pill('menu', 'tb-menu', 'MENU') + '</div><div class="tb-foot-r"></div></div>';
    }

    function screenHasil() {
      var qz = state.q;
      var total = QUESTIONS.length;
      var score = Math.round(qz.points / (total * 2) * 100);
      var stars = score >= 80 ? 3 : score >= 40 ? 2 : 1;
      var msg = score >= 80 ? 'Luar biasa! Kemampuan membayangkan bangun dari berbagai arah sudah bagus.' :
        score >= 40 ? 'Bagus! Putar bangunnya di 3D atau AR, lalu coba lagi untuk hasil yang lebih baik.' :
        'Jangan menyerah. Lihat lagi materi tampak, putar bangunnya, lalu coba latihan sekali lagi.';
      var starHTML = '';
      for (var i = 0; i < 3; i++) starHTML += '<span class="tb-star' + (i < stars ? ' on' : '') + '" aria-hidden="true">★</span>';
      return '<div class="tb-result">' +
          '<div class="tb-stars" aria-label="' + stars + ' dari 3 bintang">' + starHTML + '</div>' +
          '<p class="tb-big-score">' + score + '<small> poin</small></p>' +
          '<p class="tb-text tb-center">' + qz.firstTry + ' dari ' + total + ' soal benar pada percobaan pertama.</p>' +
          '<p class="tb-note tb-center">' + msg + '</p>' +
          '<p class="tb-note tb-center">Rekor terbaikmu di latihan ini: ' + st.best + ' poin.</p>' +
          '<div class="tb-actions tb-actions-center">' +
            pill('again', 'tb-latihan', 'ULANGI LATIHAN') +
            pill('arah', 'tb-depan', 'PELAJARI LAGI') +
          '</div>' +
        '</div>' +
        '<div class="tb-foot"><div class="tb-foot-l"></div><div class="tb-foot-c">' + pill('menu', 'tb-menu', 'MENU') + '</div><div class="tb-foot-r"></div></div>';
    }

    /* ---------- render ---------- */
    function titleFor() {
      if (state.screen === 'latihan' && state.q) {
        var qq = QUESTIONS[state.q.i];
        return 'Mana ' + VIEW_TITLE[qq.view] + ' ' + SHAPES[qq.shape].name + '?';
      }
      return SCREEN_TITLE[state.screen] || '';
    }

    function render(focusIt) {
      if (disposed) return;
      var s = state.screen;
      var html = s === 'kenal' ? screenKenal() :
        s === 'arah' ? screenArah() :
        s === 'latihan' ? screenLatihan() :
        s === 'hasil' ? screenHasil() : screenTampak(s);
      elBody.innerHTML = html;
      elTitle.textContent = titleFor();
      elTag.hidden = !TP_TAG[s];
      elBody.setAttribute('data-screen', s);
      if (focusIt) {
        var f = elBody.querySelector('[data-tb-focus]') || elBody.querySelector('[data-tb-qtitle]');
        if (f) { f.setAttribute('tabindex', '-1'); try { f.focus({ preventScroll: true }); } catch (_) { /* abaikan */ } }
        else { try { elTitle.focus({ preventScroll: true }); } catch (_) { /* abaikan */ } }
      }
    }

    function scrollTop() {
      var stage = root.querySelector('.tb-stage');
      if (stage && stage.getBoundingClientRect().top < 0) {
        try { stage.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (_) { stage.scrollIntoView(); }
      }
    }

    function go(screen, announce) {
      state.screen = screen;
      state.reveal = false;
      if (screen === 'depan' || screen === 'atas' || screen === 'samping') state.lastTampak = screen;
      render(true);
      scrollTop();
      say(announce || titleFor());
    }

    /* ---------- latihan ---------- */
    function startQuiz() {
      QUESTIONS.forEach(function (q) { q.built = null; });
      state.q = newQuiz();
      state.screen = 'latihan';
      render(true);
      scrollTop();
      say('Latihan dimulai. Soal 1 dari ' + QUESTIONS.length + '. ' + 'Mana ' + VIEW_TITLE[QUESTIONS[0].view] + ' ' + SHAPES[QUESTIONS[0].shape].name + '?');
    }

    function pick(idx) {
      var qz = state.q;
      if (!qz || qz.solved) return;
      var q = QUESTIONS[qz.i];
      var opt = q.built[idx];
      if (!opt || qz.wrong.indexOf(idx) >= 0) return;
      qz.tries += 1;
      if (opt.correct) {
        qz.solved = true;
        var gain = qz.tries === 1 ? 2 : qz.tries === 2 ? 1 : 0;
        qz.points += gain;
        if (qz.tries === 1) qz.firstTry += 1;
        qz.hint = '';
        play('correct');
        render(true);
        say('Benar. ' + explainFor(q.view, SHAPES[q.shape].grid));
      } else {
        qz.wrong.push(idx);
        var kindHints = HINT[q.view] || {};
        var h = kindHints[opt.kind] || 'Perhatikan lagi arah pandangmu dan hitung kubusnya dari kiri ke kanan.';
        if (qz.wrong.length >= 2) h += ' ' + clueFor(q.view, SHAPES[q.shape].grid);
        qz.hint = h;
        play('wrong');
        render(true);
        say('Belum tepat. ' + h);
      }
    }

    function nextQuestion() {
      var qz = state.q;
      if (!qz || !qz.solved) return;
      if (qz.i < QUESTIONS.length - 1) {
        qz.i += 1; qz.wrong = []; qz.tries = 0; qz.solved = false; qz.hint = '';
        render(true);
        scrollTop();
        say('Soal ' + (qz.i + 1) + ' dari ' + QUESTIONS.length + '. Mana ' + VIEW_TITLE[QUESTIONS[qz.i].view] + ' ' + SHAPES[QUESTIONS[qz.i].shape].name + '?');
      } else {
        var total = QUESTIONS.length;
        var score = Math.round(qz.points / (total * 2) * 100);
        st.plays += 1;
        if (score > st.best) st.best = score;
        saveStore(st);
        state.screen = 'hasil';
        render(true);
        scrollTop();
        play('finish');
        try {
          if (opts.onFinish) opts.onFinish({ score: score, correct: qz.firstTry, wrong: total - qz.firstTry, total: total, date: new Date().toISOString() });
        } catch (_) { /* nilai aplikasi tidak wajib */ }
        say('Latihan selesai. Skormu ' + score + ' poin.');
      }
    }

    /* ------------------------------------------------------------------ */
    /* Viewer 3D (alternatif AR, dapat diputar dengan sentuhan atau mouse)  */
    /* ------------------------------------------------------------------ */

    var DEF_YAW = -Math.PI / 4, DEF_PITCH = 0.6155;
    var SNAP = { depan: [0, 0], atas: [0, Math.PI / 2], samping: [-Math.PI / 2, 0] };   // [yaw, pitch]

    function viewerMarkup(key) {
      var shape = SHAPES[key];
      return '<div class="tb-viewer" role="dialog" aria-modal="true" aria-label="Model 3D ' + shape.name + '">' +
        '<div class="tb-viewer-head"><strong>' + shape.name + ' dalam 3D</strong>' +
          '<button type="button" class="tb-tool tb-close" data-act="vclose">Tutup</button></div>' +
        '<div class="tb-viewer-stage" data-tb-vstage>' +
          '<div class="tb-viewer-canvas" data-tb-canvas></div>' +
          '<div class="tb-inset" data-tb-inset hidden></div>' +
          '<div class="tb-viewer-msg" data-tb-vmsg hidden></div>' +
        '</div>' +
        '<p class="tb-viewer-hint" data-tb-vhint>Geser untuk memutar. Cubit atau gulir untuk memperbesar dan memperkecil.</p>' +
        '<div class="tb-viewer-views" role="group" aria-label="Lihat dari arah">' +
          '<button type="button" class="tb-pill tb-depan tb-small" data-act="vsnap:depan">Depan</button>' +
          '<button type="button" class="tb-pill tb-atas tb-small" data-act="vsnap:atas">Atas</button>' +
          '<button type="button" class="tb-pill tb-samping tb-small" data-act="vsnap:samping">Samping kanan</button>' +
          '<button type="button" class="tb-pill tb-kembali tb-small" data-act="vsnap:bebas">Putar bebas</button>' +
          (opts.onAR ? '<button type="button" class="tb-pill tb-menu tb-small" data-act="ar" data-shape="' + key + '">Lihat dalam AR</button>' : '') +
        '</div>' +
      '</div>';
    }

    function openViewer(key) {
      if (!SHAPES[key]) key = 'X';
      closeViewer(true);
      elModal.innerHTML = viewerMarkup(key);
      elModal.hidden = false;
      state.viewerOpen = true;
      document.documentElement.classList.add('tb-lock');
      var T = window.RuangRiaThree;
      var vstage = elModal.querySelector('[data-tb-vstage]');
      var host = elModal.querySelector('[data-tb-canvas]');
      var msg = elModal.querySelector('[data-tb-vmsg]');
      var inset = elModal.querySelector('[data-tb-inset]');
      var hint = elModal.querySelector('[data-tb-vhint]');
      var shape = SHAPES[key];

      function fallback(text) {
        msg.hidden = false;
        msg.innerHTML = '<div class="tb-fallback">' + isoSVG(shape.grid, { label: shape.name }) + '<p>' + text + '</p></div>';
        elModal.querySelectorAll('[data-act^="vsnap"]').forEach(function (b) { b.disabled = true; });
        hint.hidden = true;
      }

      var v = { key: key, alive: true, cleanups: [] };
      viewer = v;

      if (!T) { fallback('Model 3D belum siap. Muat ulang halaman, lalu coba lagi. Gambar tiga dimensi di atas tetap bisa dipakai.'); focusViewer(); return; }

      try {
        v.renderer = new T.Renderer({ antialias: true, alpha: true });
      } catch (e) {
        fallback('Grafis 3D tidak tersedia di perangkat ini, jadi model tidak bisa diputar. Gambar tiga dimensi di atas tetap bisa dipakai untuk belajar.');
        focusViewer();
        return;
      }
      var r = v.renderer;
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      r.setClearColor(0xffffff, 0);
      var canvas = r.domElement;
      canvas.className = 'tb-canvas';
      canvas.setAttribute('aria-label', 'Model 3D ' + shape.name + '. Geser untuk memutar.');
      host.appendChild(canvas);

      v.scene = new T.Scene();
      v.camera = new T.Camera(24, 1, 0.1, 100);
      v.scene.add(new T.Hemi(0xffffff, 0xb7c7e6, 2.1));
      var sun = new T.Dir(0xffffff, 1.9);
      sun.position.set(2, 5, 4);
      v.scene.add(sun);
      v.model = buildModel('tampak:' + key);
      v.model.rotation.order = 'XYZ';           // yaw (putar mendatar) dulu, lalu pitch (miring)
      v.scene.add(v.model);

      v.yaw = DEF_YAW; v.pitch = DEF_PITCH; v.zoom = 1; v.anim = null; v.dirty = true;
      var g = shape.grid;
      var w = g[0].length * CUBE, d = g.length * CUBE, h = maxOf(colHeights(g)) * CUBE;
      v.radius = 0.5 * Math.sqrt(w * w + h * h + d * d);

      function distance(aspect) {
        var half = (v.camera.fov * Math.PI / 180) / 2;
        var halfX = Math.atan(Math.tan(half) * aspect);
        return (v.radius * 1.18) / Math.sin(Math.min(half, halfX));
      }
      function apply() {
        v.model.rotation.set(v.pitch, v.yaw, 0);
        var asp = v.camera.aspect || 1;
        v.camera.position.set(0, 0, distance(asp) / v.zoom);
        v.dirty = true;
      }
      function resize() {
        var bw = Math.max(1, host.clientWidth), bh = Math.max(1, host.clientHeight);
        r.setSize(bw, bh, false);
        v.camera.aspect = bw / bh;
        v.camera.updateProjectionMatrix();
        apply();
      }
      v.resize = resize;
      resize();

      function setInset(viewId) {
        if (!viewId) { inset.hidden = true; inset.innerHTML = ''; return; }
        var M = VIEW[viewId](g);
        inset.hidden = false;
        inset.innerHTML = '<span>' + VIEW_TITLE[viewId] + '</span>' + viewSVG(M, VIEW_COLOR[viewId], { label: VIEW_TITLE[viewId] + ' ' + shape.name, align: viewId === 'atas' ? 'center' : 'bottom' });
      }
      v.setInset = setInset;

      v.snap = function (viewId) {
        var tgt = viewId === 'bebas' ? [DEF_YAW, DEF_PITCH] : SNAP[viewId];
        if (!tgt) return;
        var y0 = v.yaw, p0 = v.pitch, t0 = performance.now(), dur = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 420;
        v.anim = { y0: y0, p0: p0, y1: tgt[0], p1: tgt[1], t0: t0, dur: dur };
        v.zoom = 1;
        setInset(viewId === 'bebas' ? null : viewId);
        hint.textContent = viewId === 'bebas'
          ? 'Geser untuk memutar. Cubit atau gulir untuk memperbesar dan memperkecil.'
          : 'Kamu sedang melihat bangun dari ' + (viewId === 'samping' ? 'samping kanan' : viewId) + '. Bandingkan dengan gambar di pojok.';
        v.dirty = true;
        say(hint.textContent);
      };

      /* gestur: satu jari memutar, dua jari mencubit, roda mouse memperbesar */
      var ptrs = new Map(), lastPinch = 0;
      function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
      function onDown(e) {
        try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* abaikan */ }
        ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (ptrs.size === 2) { var p = Array.from(ptrs.values()); lastPinch = dist(p[0], p[1]); }
        v.anim = null;
      }
      function onMove(e) {
        var p0 = ptrs.get(e.pointerId);
        if (!p0) return;
        var dx = e.clientX - p0.x, dy = e.clientY - p0.y;
        p0.x = e.clientX; p0.y = e.clientY;
        if (ptrs.size === 1) {
          v.yaw += dx * 0.01;
          v.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, v.pitch + dy * 0.01));
          setInset(null);
          apply();
        } else if (ptrs.size === 2) {
          var p = Array.from(ptrs.values()), dd = dist(p[0], p[1]);
          if (lastPinch > 0) v.zoom = Math.min(2.6, Math.max(0.5, v.zoom * dd / lastPinch));
          lastPinch = dd;
          apply();
        }
      }
      function onUp(e) { ptrs.delete(e.pointerId); if (ptrs.size < 2) lastPinch = 0; }
      function onWheel(e) {
        e.preventDefault();
        v.zoom = Math.min(2.6, Math.max(0.5, v.zoom * Math.exp(-e.deltaY * 0.0015)));
        apply();
      }
      canvas.addEventListener('pointerdown', onDown);
      canvas.addEventListener('pointermove', onMove);
      canvas.addEventListener('pointerup', onUp);
      canvas.addEventListener('pointercancel', onUp);
      canvas.addEventListener('wheel', onWheel, { passive: false });
      canvas.addEventListener('webglcontextlost', function (e) {
        e.preventDefault();
        msg.hidden = false;
        msg.innerHTML = '<div class="tb-fallback"><p>Grafis terhenti sementara. Tutup lalu buka model 3D lagi.</p></div>';
      });

      var ro = null;
      if (window.ResizeObserver) { ro = new ResizeObserver(function () { if (v.alive) resize(); }); ro.observe(host); }
      else { window.addEventListener('resize', resize); v.cleanups.push(function () { window.removeEventListener('resize', resize); }); }
      if (ro) v.cleanups.push(function () { ro.disconnect(); });

      /* loop render: berhenti sendiri saat viewer ditutup */
      function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
      r.setAnimationLoop(function (now) {
        if (v.anim) {
          var a = v.anim, k = a.dur ? Math.min(1, ((now || performance.now()) - a.t0) / a.dur) : 1, e = ease(k);
          v.yaw = a.y0 + (a.y1 - a.y0) * e;
          v.pitch = a.p0 + (a.p1 - a.p0) * e;
          if (k >= 1) v.anim = null;
          apply();
        }
        if (v.dirty) { r.render(v.scene, v.camera); v.dirty = false; }
      });

      focusViewer();
    }

    function focusViewer() {
      var b = elModal.querySelector('.tb-close');
      if (b) { try { b.focus({ preventScroll: true }); } catch (_) { /* abaikan */ } }
    }

    function closeViewer(silent) {
      var v = viewer;
      viewer = null;
      if (v) {
        v.alive = false;
        try { if (v.renderer) v.renderer.setAnimationLoop(null); } catch (_) { /* abaikan */ }
        v.cleanups.forEach(function (fn) { try { fn(); } catch (_) { /* abaikan */ } });
        try { if (v.scene && window.RuangRiaThree) window.RuangRiaThree.dispose(v.scene); } catch (_) { /* abaikan */ }
        try { if (v.renderer) { v.renderer.dispose(); if (v.renderer.forceContextLoss) v.renderer.forceContextLoss(); if (v.renderer.domElement) v.renderer.domElement.remove(); } } catch (_) { /* abaikan */ }
      }
      if (state.viewerOpen) {
        state.viewerOpen = false;
        elModal.hidden = true;
        elModal.innerHTML = '';
        document.documentElement.classList.remove('tb-lock');
        if (!silent) {
          var back = root.querySelector('[data-act="viewer"]');
          if (back) { try { back.focus({ preventScroll: true }); } catch (_) { /* abaikan */ } }
        }
      }
    }

    /* ---------- peristiwa (satu pendengar untuk seluruh modul) ---------- */
    function onClick(e) {
      var t = e.target.closest && e.target.closest('[data-act]');
      if (!t || !(root.contains(t) || elModal.contains(t)) || t.disabled) return;
      var act = t.getAttribute('data-act');
      if (act.indexOf('go:') === 0) return go(act.slice(3));
      if (act.indexOf('pick:') === 0) return pick(parseInt(act.slice(5), 10));
      if (act.indexOf('vsnap:') === 0) { if (viewer && viewer.snap) viewer.snap(act.slice(6)); return; }
      switch (act) {
        case 'arah': return go('arah');
        case 'back':
          if (state.screen === 'arah') return go('kenal');
          if (state.screen === 'latihan' || state.screen === 'hasil') return go(state.lastTampak);
          return go('arah');                       // dari depan, atas, samping kembali ke hal. 23
        case 'exit': if (opts.onBack) opts.onBack(); return;
        case 'menu': if (opts.onMenu) opts.onMenu(); return;
        case 'latihan': return startQuiz();
        case 'again': return startQuiz();
        case 'next': return nextQuestion();
        case 'reveal': state.reveal = true; render(false); say('Jawaban ditampilkan.'); return;
        case 'viewer': return openViewer(t.getAttribute('data-shape') || 'X');
        case 'vclose': return closeViewer(false);
        case 'ar':
          if (opts.onAR) opts.onAR('tampak:' + (t.getAttribute('data-shape') || 'X'));
          return;
        default:
      }
    }
    function onKey(e) {
      if (e.key === 'Escape' && state.viewerOpen) { e.stopPropagation(); closeViewer(false); }
    }
    on(root, 'click', onClick);
    on(elModal, 'click', onClick);
    on(document, 'keydown', onKey, true);

    render(false);

    return {
      destroy: function () {
        if (disposed) return;
        closeViewer(true);
        disposed = true;
        listeners.forEach(function (fn) { fn(); });
        listeners = [];
        document.documentElement.classList.remove('tb-lock');
        if (elModal.parentNode) elModal.parentNode.removeChild(elModal);
        container.innerHTML = '';
      },
      go: go,
      state: function () { return JSON.parse(JSON.stringify({ screen: state.screen, lastTampak: state.lastTampak, viewerOpen: state.viewerOpen, q: state.q && { i: state.q.i, points: state.q.points, solved: state.q.solved, wrong: state.q.wrong } })); }
    };
  }

  /* ------------------------------------------------------------------ */
  /* 8. API publik                                                       */
  /* ------------------------------------------------------------------ */

  window.RuangRiaTampak = {
    mount: mount,
    buildModel: buildModel,
    arViews: AR_VIEWS,
    // dipakai pengujian otomatis dan perawatan: semua dihitung dari tabel yang sama dengan tampilan
    data: {
      shapes: SHAPES,
      questions: QUESTIONS,
      project: function (key, view) { return VIEW[view](SHAPES[key].grid); },
      options: function (i) { return buildOptions(QUESTIONS[i]).map(function (o) { return { m: o.m, kind: o.kind, correct: o.correct }; }); },
      key: mKey
    }
  };
})();
