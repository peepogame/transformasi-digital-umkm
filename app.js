// ============================================================
// Module-level state & DOM refs (accessible to all functions)
// ============================================================
let simContainer, bodyTheme, btnTransform, btnReset, statusText;
let nodes = [];
let nodeStates = {};
let simState = 'pre';
let animationFrameId = null;

// Desktop physics variables (only used on desktop)
let mouse = { x: -1000, y: -1000 };
let viewW = 0, viewH = 0;

// ============================================================
// Helper
// ============================================================
function isMobile() {
  return window.innerWidth <= 600;
}

// ============================================================
// Entry point
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  simContainer = document.getElementById('sim-container');
  bodyTheme    = document.getElementById('body-theme');
  btnTransform = document.getElementById('btn-transform');
  btnReset     = document.getElementById('btn-reset');
  statusText   = document.getElementById('status-text');

  // --- Node state data (pre / post content) ---
  nodeStates = {
    'node-commission': {
      pre:  { icon: '⚠️', badge: 'Lock-in',   title: 'Potongan Komisi Tinggi (20%+)',  desc: 'Potongan pihak ketiga yang menggerus margin laba UMKM.' },
      post: { icon: '✅', badge: 'D2C Margin', title: 'Komisi Transaksi 0%',            desc: 'Seluruh margin penjualan masuk seutuhnya ke kas pemilik UMKM.' }
    },
    'node-data': {
      pre:  { icon: '🔒', badge: 'Silo Data',    title: 'Data Pelanggan Hilang',          desc: 'UMKM tidak memiliki akses data kontak untuk remarketing.' },
      post: { icon: '🔑', badge: 'Mandiri CRM',  title: 'Kepemilikan Data Pelanggan',     desc: 'Database kontak pelanggan dipegang 100% untuk promosi personal.' }
    },
    'node-lockin': {
      pre:  { icon: '⛓️', badge: 'Agregator',  title: 'Ketergantungan Agregator',       desc: 'Terikat aturan algoritma sepihak platform pihak ketiga.' },
      post: { icon: '🛡️', badge: 'Bebas Lock-in', title: 'Kanal Mandiri Adaptif',       desc: 'Bebas kendali penuh atas penentuan harga, promo, dan brand.' }
    },
    'node-price': {
      pre:  { icon: '💥', badge: 'Kompetisi', title: 'Perang Harga Sengit',             desc: 'Terjebak perang diskon dengan ribuan kompetitor di agregator.' },
      post: { icon: '🤝', badge: 'Loyalitas', title: 'Hubungan Langsung D2C',           desc: 'Hubungan emosional langsung dengan pelanggan meningkatkan retensi.' }
    },
    'node-inventory': {
      pre:  { icon: '🔄', badge: 'Manual',   title: 'Silo Stok Terpisah',              desc: 'Pencatatan manual memicu resiko selisih stok (oversell).' },
      post: { icon: '⚙️', badge: 'Otomatis', title: 'Stok Terintegrasi Hub',           desc: 'Sistem cloud terpusat mengotomasi pembaruan stok di semua kanal.' }
    }
  };

  // Build nodes array
  nodes = [
    { id: 'node-commission', element: document.getElementById('node-commission'), path: document.getElementById('path-commission') },
    { id: 'node-data',       element: document.getElementById('node-data'),       path: document.getElementById('path-data') },
    { id: 'node-lockin',     element: document.getElementById('node-lockin'),     path: document.getElementById('path-lockin') },
    { id: 'node-price',      element: document.getElementById('node-price'),      path: document.getElementById('path-price') },
    { id: 'node-inventory',  element: document.getElementById('node-inventory'),  path: document.getElementById('path-inventory') }
  ];

  // Wire up shared citation links for both paths
  wireCitationLinks();

  // ============================================================
  // MOBILE PATH: no physics, pure CSS document flow
  // ============================================================
  if (isMobile()) {
    btnTransform.addEventListener('click', () => {
      if (simState === 'pre') startTransformation();
    });
    btnReset.addEventListener('click', () => resetSimulation());
    return; // Exit — skip all physics setup
  }

  // ============================================================
  // DESKTOP PATH: full physics engine
  // ============================================================
  viewW = simContainer.clientWidth;
  viewH = simContainer.clientHeight;

  // Initialize node physics parameters
  nodes.forEach(n => {
    n.width  = n.element.offsetWidth  || 250;
    n.height = n.element.offsetHeight || 100;
    n.x  = Math.random() * (viewW - n.width  - 60) + 30;
    n.y  = Math.random() * (viewH - n.height - 120) + 40;
    n.vx = (Math.random() - 0.5) * 0.6;
    n.vy = (Math.random() - 0.5) * 0.6;
    n.targetX = 0;
    n.targetY = 0;
  });

  // Calculate pentagonal ring targets for post-state
  function updateLayoutTargets() {
    viewW = simContainer.clientWidth;
    viewH = simContainer.clientHeight;
    const cx = viewW / 2;
    const cy = viewH / 2;

    nodes.forEach(n => {
      n.width  = n.element.offsetWidth  || 250;
      n.height = n.element.offsetHeight || 100;
    });

    const radius    = Math.min(viewW, viewH) * 0.32;
    const angleStep = (2 * Math.PI) / nodes.length;
    const startAngle = -Math.PI / 2;

    nodes.forEach((n, idx) => {
      const angle = startAngle + idx * angleStep;
      n.targetX = cx + radius * Math.cos(angle) - n.width  / 2;
      n.targetY = cy + radius * Math.sin(angle) - n.height / 2;
    });
  }

  updateLayoutTargets();

  window.addEventListener('resize', () => {
    if (isMobile()) return;
    updateLayoutTargets();
    if (simState === 'post') {
      nodes.forEach(n => {
        n.x = n.targetX;
        n.y = n.targetY;
        n.element.style.left = `${n.x}px`;
        n.element.style.top  = `${n.y}px`;
      });
      drawPaths();
    }
  });

  // Mouse repulsion
  simContainer.addEventListener('mousemove', e => {
    const rect = simContainer.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });
  simContainer.addEventListener('mouseleave', () => {
    mouse.x = -1000;
    mouse.y = -1000;
  });

  // Physics loop
  function tick() {
    nodes.forEach(n => {
      if (simState === 'pre') {
        // Drift
        n.x += n.vx;
        n.y += n.vy;

        n.vx += (Math.random() - 0.5) * 0.04;
        n.vy += (Math.random() - 0.5) * 0.04;

        const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
        if (speed > 1.2) { n.vx = (n.vx / speed) * 1.2; n.vy = (n.vy / speed) * 1.2; }

        // Boundary collisions
        if (n.x < 15)                      { n.x = 15;                      n.vx *= -1; }
        if (n.x > viewW - n.width  - 15)   { n.x = viewW - n.width  - 15;  n.vx *= -1; }
        if (n.y < 15)                       { n.y = 15;                      n.vy *= -1; }
        if (n.y > viewH - n.height - 80)    { n.y = viewH - n.height - 80;  n.vy *= -1; }

        // Cursor repulsion
        const cx = n.x + n.width  / 2;
        const cy = n.y + n.height / 2;
        const dx = cx - mouse.x;
        const dy = cy - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 180 && dist > 0) {
          const force = (180 - dist) / 180;
          n.vx += (dx / dist) * force * 1.5;
          n.vy += (dy / dist) * force * 1.5;
        }

      } else if (simState === 'sucking') {
        const dx = n.targetX - n.x;
        const dy = n.targetY - n.y;
        n.x += dx * 0.09;
        n.y += dy * 0.09;
        if (Math.sqrt(dx * dx + dy * dy) < 1.5) { n.x = n.targetX; n.y = n.targetY; }
      }

      n.element.style.left = `${n.x}px`;
      n.element.style.top  = `${n.y}px`;
    });

    if (simState === 'sucking') {
      drawPaths();
      const allSnapped = nodes.every(n =>
        Math.abs(n.targetX - n.x) < 0.2 && Math.abs(n.targetY - n.y) < 0.2
      );
      if (allSnapped) completeTransformation();
    }

    animationFrameId = requestAnimationFrame(tick);
  }

  function drawPaths() {
    const cx = viewW / 2;
    const cy = viewH / 2;
    nodes.forEach(n => {
      n.path.setAttribute('d', `M ${cx} ${cy} L ${n.x + n.width / 2} ${n.y + n.height / 2}`);
    });
  }

  // Start physics
  animationFrameId = requestAnimationFrame(tick);

  // Button wiring (desktop)
  btnTransform.addEventListener('click', () => {
    if (simState === 'pre') startTransformation();
  });
  btnReset.addEventListener('click', () => resetSimulation());
});

// ============================================================
// SHARED FUNCTIONS — work on both mobile and desktop
// ============================================================

function startTransformation() {
  simState = 'sucking';
  btnTransform.disabled = true;
  btnTransform.style.opacity = '0.5';
  bodyTheme.className = 'theme-post';
  statusText.textContent = 'Fase: Mentransformasikan Ekosistem...';

  nodes.forEach(n => {
    n.element.style.opacity = '0.4';
    setTimeout(() => {
      const d = nodeStates[n.id].post;
      const key = n.id.split('-')[1];
      document.getElementById(`icon-${key}`).textContent  = d.icon;
      document.getElementById(`badge-${key}`).textContent = d.badge;
      document.getElementById(`title-${key}`).textContent = d.title;
      document.getElementById(`desc-${key}`).textContent  = d.desc;
      n.element.style.opacity = '1';
    }, 350);
  });

  // Mobile has no animation — complete after short delay
  if (isMobile()) {
    setTimeout(() => completeTransformation(), 900);
  }
}

function completeTransformation() {
  simState = 'post';
  btnTransform.style.display = 'none';
  btnReset.style.display = 'flex';
  statusText.textContent = 'Fase: Pasca-Transformasi (Mandiri)';
  animateHUD();
}

function resetSimulation() {
  simState = 'pre';
  btnReset.style.display = 'none';
  btnTransform.style.display = 'flex';
  btnTransform.disabled = false;
  btnTransform.style.opacity = '1';
  bodyTheme.className = 'theme-pre';
  statusText.textContent = 'Fase: Pra-Transformasi';

  // Reset HUD
  const margin = document.getElementById('hud-val-margin');
  const retention = document.getElementById('hud-val-retention');
  if (margin)    { margin.textContent    = 'Normal'; margin.style.color    = '#e2e4e9'; }
  if (retention) { retention.textContent = 'Rendah'; retention.style.color = '#e2e4e9'; }

  nodes.forEach(n => {
    // Desktop: re-randomize physics
    if (!isMobile() && typeof n.x !== 'undefined') {
      n.x  = Math.random() * (viewW - n.width  - 60)  + 30;
      n.y  = Math.random() * (viewH - n.height - 120) + 40;
      n.vx = (Math.random() - 0.5) * 0.6;
      n.vy = (Math.random() - 0.5) * 0.6;
    }

    n.element.style.opacity = '0.4';
    setTimeout(() => {
      const d = nodeStates[n.id].pre;
      const key = n.id.split('-')[1];
      document.getElementById(`icon-${key}`).textContent  = d.icon;
      document.getElementById(`badge-${key}`).textContent = d.badge;
      document.getElementById(`title-${key}`).textContent = d.title;
      document.getElementById(`desc-${key}`).textContent  = d.desc;
      n.element.style.opacity = '1';
    }, 250);
  });

  document.querySelectorAll('.citation-card').forEach(c => c.classList.remove('highlighted'));
  document.querySelectorAll('.node').forEach(el => el.classList.remove('active-focus'));
}

function animateHUD() {
  const marginEl    = document.getElementById('hud-val-margin');
  const retentionEl = document.getElementById('hud-val-retention');

  let m = 0;
  const mi = setInterval(() => {
    m++;
    if (marginEl) { marginEl.textContent = `+${m}%`; marginEl.style.color = '#39ff14'; }
    if (m >= 20) clearInterval(mi);
  }, 45);

  let r = 0;
  const ri = setInterval(() => {
    r++;
    if (retentionEl) { retentionEl.textContent = `+${r}%`; retentionEl.style.color = '#39ff14'; }
    if (r >= 25) clearInterval(ri);
  }, 40);
}

function wireCitationLinks() {
  const cards = document.querySelectorAll('.citation-card');

  // Node click -> highlight citation
  document.querySelectorAll('.node').forEach(nodeEl => {
    nodeEl.addEventListener('click', () => {
      const citeId = nodeEl.getAttribute('data-citation');
      highlightCitation(citeId, cards);
      focusNodeEl(nodeEl);
    });
  });

  // Citation click -> highlight node
  cards.forEach(card => {
    card.addEventListener('click', () => {
      highlightCitation(card.id, cards);
      const matched = document.querySelector(`.node[data-citation="${card.id}"]`);
      if (matched) focusNodeEl(matched);
    });
  });
}

function highlightCitation(id, cards) {
  (cards || document.querySelectorAll('.citation-card')).forEach(c => {
    if (c.id === id) {
      c.classList.add('highlighted');
      c.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      c.classList.remove('highlighted');
    }
  });
}

function focusNodeEl(el) {
  document.querySelectorAll('.node').forEach(n => n.classList.remove('active-focus'));
  el.classList.add('active-focus');
  el.style.transform = 'scale(1.06)';
  setTimeout(() => { el.style.transform = ''; }, 200);
}
