/*
 * RuangRia: AR mode kamera.
 *
 * Dipakai otomatis saat WebXR "immersive-ar" tidak tersedia (semua iPhone/iPad di Safari,
 * Android tanpa ARCore, tablet, laptop dengan webcam). Cara kerjanya:
 *   1. Kamera dibuka lewat navigator.mediaDevices.getUserMedia() dan ditampilkan sebagai latar.
 *   2. Model 3D yang sama dengan viewer RuangRia digambar di atas video memakai Three.js bawaan aplikasi.
 *   3. Jika sensor gerak (giroskop) tersedia, bangun "terkunci" di ruang sekitar saat HP digerakkan.
 *   4. Gestur sentuh/mouse: geser = putar, cubit/gulir = ukuran, dua jari = pindah.
 *
 * Catatan jujur: mode ini TIDAK mendeteksi permukaan meja/lantai (itu hanya bisa lewat WebXR).
 * Posisi bangun mengikuti arah pandang kamera saat AR dibuka atau tombol "Atur ulang" ditekan.
 *
 * Kelas Three.js tidak diimpor di sini. script.js menyerahkannya lewat parameter `T`
 * supaya file ini memakai satu salinan Three.js yang sama dan tidak perlu CDN.
 */
(function () {
  'use strict';

  var D2R = Math.PI / 180;
  var DIST = 4.5; // jarak bangun dari kamera (satuan scene)
  var FOV = 60;
  var DEFAULT_ROT = { x: 0.35, y: -0.6 };
  var active = null;

  var MSG = {
    secure: 'AR memerlukan HTTPS atau localhost agar kamera dapat digunakan. Buka aplikasi lewat tautan yang diawali https://.',
    noApi: 'Browser ini belum bisa mengakses kamera. Buka RuangRia di Chrome (Android) atau Safari (iPhone/iPad). Jika membukanya dari WhatsApp, Instagram, atau aplikasi lain, pilih "Buka di browser".',
    denied: 'Izin kamera ditolak. Izinkan kamera di pengaturan situs browser (ikon gembok di bilah alamat, atau menu "aA" di Safari), lalu coba lagi.',
    notFound: 'Kamera tidak ditemukan di perangkat ini. Kamu tetap bisa melihat model 3D.',
    busy: 'Kamera sedang dipakai aplikasi lain atau tidak bisa dibuka. Tutup aplikasi kamera lain, lalu coba lagi.',
    timeout: 'Kamera terlalu lama merespons. Periksa izin kamera, lalu coba lagi.',
    webgl: 'Grafis 3D tidak tersedia di perangkat ini. Kamu tetap bisa mencoba model 3D di halaman materi.',
    generic: 'AR belum bisa dibuka pada perangkat ini. Kamu tetap bisa melihat model 3D.'
  };

  function mapError(e) {
    var name = e && e.name;
    if (e && e.rrMessage) return new Error(e.rrMessage);
    if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return new Error(MSG.denied);
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') return new Error(MSG.notFound);
    if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') return new Error(MSG.busy);
    if (e && e.message === 'rr-timeout') return new Error(MSG.timeout);
    return new Error(MSG.generic);
  }

  function rrError(message) {
    var e = new Error(message);
    e.rrMessage = message;
    return e;
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function withTimeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () { reject(new Error('rr-timeout')); }, ms);
      promise.then(function (v) { clearTimeout(t); resolve(v); }, function (err) { clearTimeout(t); reject(err); });
    });
  }

  function stopStream(stream) {
    if (!stream) return;
    stream.getTracks().forEach(function (t) { try { t.stop(); } catch (_) { /* abaikan */ } });
  }

  function screenAngle() {
    if (window.screen && screen.orientation && typeof screen.orientation.angle === 'number') return screen.orientation.angle * D2R;
    if (typeof window.orientation === 'number') return window.orientation * D2R;
    return 0;
  }

  /*
   * iOS 13+ mewajibkan izin eksplisit untuk sensor gerak, dan hanya boleh diminta langsung dari ketukan pengguna.
   * Fungsi ini harus dipanggil sinkron di awal handler tombol, sebelum ada await apa pun.
   */
  function askOrientationPermission() {
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        return DeviceOrientationEvent.requestPermission().then(function (r) { return r; }, function () { return 'denied'; });
      }
    } catch (_) { /* lanjut tanpa sensor */ }
    return Promise.resolve('auto');
  }

  async function openStream(facing) {
    var attempts = [
      { video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } } },
      { video: { facingMode: { ideal: facing } } },
      { video: true }
    ];
    var lastErr;
    for (var i = 0; i < attempts.length; i++) {
      try {
        var req = Object.assign({ audio: false }, attempts[i]);
        return await withTimeout(navigator.mediaDevices.getUserMedia(req), 60000);
      } catch (e) {
        lastErr = e;
        var n = e && e.name;
        if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'NotReadableError' || n === 'AbortError' || (e && e.message === 'rr-timeout')) throw e;
      }
    }
    throw lastErr;
  }

  async function start(shapeId, T, orientPromise) {
    if (active) return;
    if (!window.isSecureContext) throw rrError(MSG.secure);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw rrError(MSG.noApi);

    var closed = false;
    var stream = null;
    var renderer = null;
    var scene = null;
    var model = null;
    var facing = 'environment';
    var mirrored = false;
    var userScale = 1;
    var baseFit = 1;
    var gyroOn = false;
    var gyroAllowed = true;
    var a0 = null;
    var last = null;
    var ready = false;
    var cleanups = [];

    /* ---------- antarmuka ---------- */
    var root = el('div', 'rr-ar');
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Tampilan AR');
    var video = el('video', 'rr-ar-video');
    video.muted = true;
    video.autoplay = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('muted', '');
    var hint = el('div', 'rr-ar-hint', 'Mengaktifkan kamera. Jika diminta, ketuk Izinkan.');
    hint.setAttribute('role', 'status');
    var spinner = el('div', 'rr-ar-spinner');
    var bar = el('div', 'rr-ar-bar');
    var btnClose = el('button', 'rr-ar-btn', 'Tutup AR');
    var btnReset = el('button', 'rr-ar-btn secondary', 'Atur ulang');
    var btnFlip = el('button', 'rr-ar-btn secondary', 'Ganti kamera');
    [btnClose, btnReset, btnFlip].forEach(function (b) { b.type = 'button'; });
    btnFlip.hidden = true;
    // Tombol arah pandang (Depan, Atas, Samping kanan). Hanya ada jika pemanggil memberikan T.views,
    // misalnya materi Tampak Bangun. Untuk bangun lama T.views kosong dan tidak ada yang berubah.
    var viewsRow = null;
    if (T.views && T.views.length) {
      viewsRow = el('div', 'rr-ar-views');
      viewsRow.setAttribute('role', 'group');
      viewsRow.setAttribute('aria-label', 'Lihat bangun dari arah');
      T.views.forEach(function (v, i) {
        var vb = el('button', 'rr-ar-btn secondary', v.label);
        vb.type = 'button';
        vb.setAttribute('data-view', String(i));
        viewsRow.appendChild(vb);
      });
      bar.appendChild(viewsRow);
    }
    bar.appendChild(btnClose);
    bar.appendChild(btnReset);
    bar.appendChild(btnFlip);
    root.appendChild(video);
    root.appendChild(spinner);
    root.appendChild(hint);
    root.appendChild(bar);
    document.body.appendChild(root);
    document.documentElement.classList.add('rr-ar-open');

    function setHint(t) { hint.textContent = t; }

    function close() {
      if (closed) return;
      closed = true;
      active = null;
      cleanups.forEach(function (fn) { try { fn(); } catch (_) { /* abaikan */ } });
      cleanups = [];
      if (renderer) {
        try { renderer.setAnimationLoop(null); } catch (_) { /* abaikan */ }
      }
      try { if (scene) T.dispose(scene); } catch (_) { /* abaikan */ }
      try { if (renderer) { renderer.dispose(); if (renderer.domElement) renderer.domElement.remove(); } } catch (_) { /* abaikan */ }
      stopStream(stream);
      stream = null;
      video.srcObject = null;
      root.remove();
      document.documentElement.classList.remove('rr-ar-open');
    }

    active = { close: close, state: function () { return { ready: ready, gyro: gyroOn, facing: facing, mirrored: mirrored, scale: userScale }; } };
    btnClose.addEventListener('click', close);

    try {
      /* ---------- izin sensor (iOS) lalu kamera ---------- */
      var perm = await orientPromise;
      if (closed) return;
      gyroAllowed = perm !== 'denied';

      stream = await openStream(facing);
      if (closed) { stopStream(stream); stream = null; return; }
      await attachStream();
      if (closed) return;

      /* ---------- scene 3D ---------- */
      var lowEnd = (navigator.deviceMemory && navigator.deviceMemory <= 3) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
      try {
        renderer = new T.Renderer({ antialias: !lowEnd, alpha: true, powerPreference: 'high-performance' });
      } catch (_) {
        throw rrError(MSG.webgl);
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowEnd ? 1 : 1.75));
      var canvas = renderer.domElement;
      canvas.className = 'rr-ar-canvas';
      root.insertBefore(canvas, spinner);

      scene = new T.Scene();
      var camera = new T.Camera(FOV, 1, 0.05, 100);
      var rig = new T.Camera(FOV, 1, 0.05, 100); // dipakai untuk menghitung arah sensor
      scene.add(new T.Hemi(16777215, 12044758, 2.2));
      var sun = new T.Dir(16777215, 2);
      sun.position.set(2, 5, 3);
      scene.add(sun);
      model = T.build(shapeId);
      model.rotation.set(DEFAULT_ROT.x, DEFAULT_ROT.y, 0);
      scene.add(model);

      var vA = camera.position.clone();
      var vB = camera.position.clone();

      function size() {
        var w = Math.max(1, root.clientWidth || window.innerWidth);
        var h = Math.max(1, root.clientHeight || window.innerHeight);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        rig.aspect = camera.aspect;
        // diagonal bangun terbesar (kubus, balok) sekitar 3,2 satuan saat diputar. Ukuran awal dibatasi agar muat di layar sempit.
        var visibleH = 2 * DIST * Math.tan(FOV * D2R / 2);
        var visibleW = visibleH * camera.aspect;
        baseFit = Math.min(1, (0.7 * visibleW) / 3.2, (0.5 * visibleH) / 3.2);
        applyScale();
      }
      function applyScale() { model.scale.setScalar(baseFit * userScale); }

      function placeInFront() {
        camera.updateMatrixWorld();
        camera.getWorldDirection(vA);
        model.position.copy(vA.multiplyScalar(DIST));
      }

      function updateRig() {
        if (!last) return;
        rig.rotation.set(last.b * D2R, (last.a - a0) * D2R, -last.g * D2R, 'YXZ');
        rig.rotateX(-Math.PI / 2);
        rig.rotateZ(-screenAngle());
      }

      function onOrient(e) {
        if (e.alpha == null || e.beta == null || e.gamma == null) return; // desktop mengirim nilai null
        last = { a: e.alpha, b: e.beta, g: e.gamma };
        if (!gyroOn) {
          gyroOn = true;
          a0 = last.a;
          updateRig();
          camera.quaternion.copy(rig.quaternion);
          placeInFront();
          if (ready) setHint(HINT_GYRO);
        }
      }

      var HINT_GYRO = 'Arahkan kamera ke meja atau lantai dan gerakkan HP untuk melihat dari berbagai sisi. Geser untuk memutar, cubit untuk mengubah ukuran.';
      var HINT_TOUCH = 'Geser untuk memutar bangun. Cubit atau gulir untuk mengubah ukuran, dua jari untuk memindahkan.';
      var HINT_NOSENSOR = 'Sensor gerak tidak diizinkan, jadi bangun tidak mengikuti gerakan HP. ' + HINT_TOUCH;

      if (gyroAllowed) {
        window.addEventListener('deviceorientation', onOrient, true);
        cleanups.push(function () { window.removeEventListener('deviceorientation', onOrient, true); });
      }

      function recenter() {
        userScale = 1;
        model.rotation.set(DEFAULT_ROT.x, DEFAULT_ROT.y, 0);
        if (gyroOn && last) {
          a0 = last.a;
          updateRig();
          camera.quaternion.copy(rig.quaternion);
        }
        placeInFront();
        applyScale();
      }
      btnReset.addEventListener('click', recenter);

      // Hadapkan sisi tertentu bangun ke kamera: rotasi model = rotasi kamera x rotasi arah pandang.
      if (viewsRow) {
        viewsRow.addEventListener('click', function (e) {
          var b = e.target.closest && e.target.closest('[data-view]');
          if (!b) return;
          var v = T.views[parseInt(b.getAttribute('data-view'), 10)];
          if (!v) return;
          camera.updateMatrixWorld();
          var q = camera.quaternion.clone();
          q.set(v.q[0], v.q[1], v.q[2], v.q[3]);
          model.quaternion.copy(camera.quaternion).multiply(q);
          setHint('Kamu sedang melihat bangun dari ' + v.label.toLowerCase() + '. Cocokkan dengan gambar tampak yang sama di materi.');
        });
      }

      /* ---------- gestur ---------- */
      var ptrs = new Map();
      var lastPinch = 0;
      var lastMid = null;
      function pts() { return Array.from(ptrs.values()); }
      function dist(p, q) { return Math.hypot(p.x - q.x, p.y - q.y); }
      function mid(p, q) { return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }; }

      function rotateBy(dx, dy) {
        camera.updateMatrixWorld();
        vB.set(0, 1, 0);
        model.rotateOnWorldAxis(vB, dx * 0.008);
        vB.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
        model.rotateOnWorldAxis(vB, dy * 0.008);
      }
      function moveBy(dx, dy) {
        camera.updateMatrixWorld();
        var perPx = (2 * DIST * Math.tan(FOV * D2R / 2)) / Math.max(1, root.clientHeight);
        vB.setFromMatrixColumn(camera.matrixWorld, 0);
        model.position.addScaledVector(vB, dx * perPx);
        vB.setFromMatrixColumn(camera.matrixWorld, 1);
        model.position.addScaledVector(vB, -dy * perPx);
      }

      function onDown(e) {
        if (e.target.closest && e.target.closest('.rr-ar-bar')) return;
        try { root.setPointerCapture(e.pointerId); } catch (_) { /* abaikan */ }
        ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (ptrs.size === 2) {
          var p = pts();
          lastPinch = dist(p[0], p[1]);
          lastMid = mid(p[0], p[1]);
        }
        // sebagian browser menahan video sampai ada ketukan pertama
        if (video.paused) video.play().catch(function () {});
      }
      function onMove(e) {
        var p0 = ptrs.get(e.pointerId);
        if (!p0) return;
        var nx = e.clientX;
        var ny = e.clientY;
        if (ptrs.size === 1) rotateBy(nx - p0.x, ny - p0.y);
        p0.x = nx;
        p0.y = ny;
        if (ptrs.size === 2) {
          var p = pts();
          var d = dist(p[0], p[1]);
          var m = mid(p[0], p[1]);
          if (lastPinch > 0) userScale = Math.min(3, Math.max(0.35, userScale * d / lastPinch));
          if (lastMid) moveBy(m.x - lastMid.x, m.y - lastMid.y);
          lastPinch = d;
          lastMid = m;
          applyScale();
        }
      }
      function onUp(e) {
        ptrs.delete(e.pointerId);
        if (ptrs.size < 2) { lastPinch = 0; lastMid = null; }
      }
      function onWheel(e) {
        e.preventDefault();
        userScale = Math.min(3, Math.max(0.35, userScale * Math.exp(-e.deltaY * 0.0015)));
        applyScale();
      }
      function onKey(e) { if (e.key === 'Escape') close(); }
      function onResize() { if (renderer) size(); }
      function onVisible() { if (!document.hidden && video.paused && stream) video.play().catch(function () {}); }

      root.addEventListener('pointerdown', onDown);
      root.addEventListener('pointermove', onMove);
      root.addEventListener('pointerup', onUp);
      root.addEventListener('pointercancel', onUp);
      root.addEventListener('wheel', onWheel, { passive: false });
      window.addEventListener('keydown', onKey);
      window.addEventListener('resize', onResize);
      window.addEventListener('orientationchange', onResize);
      document.addEventListener('visibilitychange', onVisible);
      cleanups.push(function () {
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('resize', onResize);
        window.removeEventListener('orientationchange', onResize);
        document.removeEventListener('visibilitychange', onVisible);
      });

      canvas.addEventListener('webglcontextlost', function (e) {
        e.preventDefault();
        setHint('Grafis terhenti sementara. Jika bangun tidak muncul lagi, tutup AR lalu buka kembali.');
      });

      /* ---------- ganti kamera ---------- */
      async function refreshFlip() {
        try {
          var list = await navigator.mediaDevices.enumerateDevices();
          var cams = list.filter(function (d) { return d.kind === 'videoinput'; });
          btnFlip.hidden = cams.length < 2;
        } catch (_) { btnFlip.hidden = true; }
      }
      var flipping = false;
      btnFlip.addEventListener('click', async function () {
        if (flipping) return;
        flipping = true;
        var next = facing === 'environment' ? 'user' : 'environment';
        try {
          stopStream(stream);
          stream = await openStream(next);
          if (closed) { stopStream(stream); stream = null; return; }
          facing = next;
          await attachStream();
        } catch (e) {
          setHint(mapError(e).message);
        } finally { flipping = false; }
      });

      /* ---------- loop render ---------- */
      renderer.setAnimationLoop(function () {
        if (gyroOn && last) {
          updateRig();
          camera.quaternion.slerp(rig.quaternion, 0.5);
        }
        renderer.render(scene, camera);
      });

      size();
      placeInFront();
      ready = true;
      spinner.remove();
      refreshFlip();
      setHint(gyroOn ? HINT_GYRO : (gyroAllowed ? HINT_TOUCH : HINT_NOSENSOR));
      // jika sensor baru aktif beberapa saat kemudian, onOrient akan memperbarui petunjuk sendiri
      if (gyroAllowed) {
        setTimeout(function () { if (!closed && !gyroOn) setHint(HINT_TOUCH); }, 1500);
      }
    } catch (e) {
      close();
      throw mapError(e);
    }

    async function attachStream() {
      var track = stream.getVideoTracks()[0];
      var s = (track && track.getSettings && track.getSettings()) || {};
      var coarse = window.matchMedia && matchMedia('(pointer:coarse)').matches;
      mirrored = s.facingMode ? s.facingMode === 'user' : !coarse;
      video.classList.toggle('mirror', mirrored);
      if (track) {
        track.addEventListener('ended', function () {
          if (!closed) setHint('Kamera berhenti. Tutup AR lalu buka kembali.');
        });
      }
      video.srcObject = stream;
      await withTimeout(new Promise(function (resolve) {
        if (video.readyState >= 1) return resolve();
        video.onloadedmetadata = function () { resolve(); };
      }), 10000);
      try { await video.play(); } catch (_) { setHint('Ketuk layar untuk memulai kamera.'); }
    }
  }

  window.RuangRiaCameraAR = {
    start: start,
    askOrientationPermission: askOrientationPermission,
    isActive: function () { return !!active; },
    state: function () { return active ? active.state() : null; },
    close: function () { if (active) active.close(); }
  };
})();
