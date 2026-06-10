document.addEventListener('DOMContentLoaded', () => {
  const simContainer = document.getElementById('sim-container');
  const bodyTheme = document.getElementById('body-theme');
  const btnTransform = document.getElementById('btn-transform');
  const btnTransformText = document.getElementById('btn-transform-text');
  const btnReset = document.getElementById('btn-reset');
  const statusBadge = document.getElementById('status-badge');
  const statusText = document.getElementById('status-text');
  const centralCore = document.getElementById('central-core');
  const connectionsSvg = document.getElementById('connections-svg');
  const metricsHud = document.getElementById('metrics-hud');

  // Text values for dual states
  const nodeStates = {
    'node-commission': {
      pre: {
        icon: '⚠️', badge: 'Lock-in',
        title: 'Potongan Komisi Tinggi (20%+)',
        desc: 'Potongan pihak ketiga yang menggerus margin laba UMKM.'
      },
      post: {
        icon: '✅', badge: 'D2C Margin',
        title: 'Komisi Transaksi 0%',
        desc: 'Seluruh margin penjualan masuk seutuhnya ke kas pemilik UMKM.'
      }
    },
    'node-data': {
      pre: {
        icon: '🔒', badge: 'Silo Data',
        title: 'Data Pelanggan Hilang',
        desc: 'UMKM tidak memiliki akses data kontak untuk remarketing.'
      },
      post: {
        icon: '🔑', badge: 'Mandiri CRM',
        title: 'Kepemilikan Data Pelanggan',
        desc: 'Database kontak pelanggan dipegang 100% untuk promosi personal.'
      }
    },
    'node-lockin': {
      pre: {
        icon: '⛓️', badge: 'Agregator',
        title: 'Ketergantungan Agregator',
        desc: 'Terikat aturan algoritma sepihak platform pihak ketiga.'
      },
      post: {
        icon: '🛡️', badge: 'Bebas Lock-in',
        title: 'Kanal Mandiri Adaptif',
        desc: 'Bebas kendali penuh atas penentuan harga, promo, dan brand.'
      }
    },
    'node-price': {
      pre: {
        icon: '💥', badge: 'Kompetisi',
        title: 'Perang Harga Sengit',
        desc: 'Terjebak perang diskon dengan ribuan kompetitor di agregator.'
      },
      post: {
        icon: '🤝', badge: 'Loyalitas',
        title: 'Hubungan Langsung D2C',
        desc: 'Hubungan emosional langsung dengan pelanggan meningkatkan retensi.'
      }
    },
    'node-inventory': {
      pre: {
        icon: '🔄', badge: 'Manual',
        title: 'Silo Stok Terpisah',
        desc: 'Pencatatan manual memicu resiko selisih stok (oversell).'
      },
      post: {
        icon: '⚙️', badge: 'Otomatis',
        title: 'Stok Terintegrasi Hub',
        desc: 'Sistem cloud terpusat mengotomasi pembaruan stok di semua kanal.'
      }
    }
  };

  // Node physics array
  const nodes = [
    { id: 'node-commission', element: document.getElementById('node-commission'), path: document.getElementById('path-commission') },
    { id: 'node-data', element: document.getElementById('node-data'), path: document.getElementById('path-data') },
    { id: 'node-lockin', element: document.getElementById('node-lockin'), path: document.getElementById('path-lockin') },
    { id: 'node-price', element: document.getElementById('node-price'), path: document.getElementById('path-price') },
    { id: 'node-inventory', element: document.getElementById('node-inventory'), path: document.getElementById('path-inventory') }
  ];

  // Simulation State: 'pre', 'sucking', 'post'
  let simState = 'pre';
  let animationFrameId = null;

  // Screen mouse coordinates for repulsion
  let mouse = { x: -1000, y: -1000 };

  // Track resizing
  let viewW = simContainer.clientWidth;
  let viewH = simContainer.clientHeight;

  // Initialize node physics parameters
  nodes.forEach((n, idx) => {
    n.width = n.element.offsetWidth || 250;
    n.height = n.element.offsetHeight || 100;
    
    // Distribute randomly inside the viewport for the pre-state
    n.x = Math.random() * (viewW - n.width - 60) + 30;
    n.y = Math.random() * (viewH - n.height - 120) + 40;
    
    // Slow drifting speeds
    n.vx = (Math.random() - 0.5) * 0.6;
    n.vy = (Math.random() - 0.5) * 0.6;
    
    n.targetX = 0;
    n.targetY = 0;
  });

  // Calculate layout targets based on state and size
  function updateLayoutTargets() {
    viewW = simContainer.clientWidth;
    viewH = simContainer.clientHeight;
    
    const cx = viewW / 2;
    const cy = viewH / 2;

    // Dynamically measure current element bounds (essential for responsive scaling)
    nodes.forEach(n => {
      n.width = n.element.offsetWidth || (viewW < 600 ? 180 : 250);
      n.height = n.element.offsetHeight || (viewW < 600 ? 55 : 100);
    });

    if (viewW > 600) {
      // Desktop: Pentagonal ring arrangement around central core
      const radius = Math.min(viewW, viewH) * 0.32;
      const angleStep = (2 * Math.PI) / nodes.length;
      const startAngle = -Math.PI / 2; // Start from top center

      nodes.forEach((n, idx) => {
        const angle = startAngle + idx * angleStep;
        n.targetX = cx + radius * Math.cos(angle) - n.width / 2;
        n.targetY = cy + radius * Math.sin(angle) - n.height / 2;
      });
    } else {
      // Mobile/Tablet: Structured Center-Aligned Vertical List
      // Ensures no horizontal overflow on narrow mobile screens (360px - 480px)
      const topPadding = 20;
      const bottomPadding = 80;
      const availableH = viewH - topPadding - bottomPadding;
      const spacing = availableH / (nodes.length - 1);

      nodes.forEach((n, idx) => {
        n.targetX = cx - n.width / 2;
        n.targetY = topPadding + idx * spacing;
      });
    }
  }

  // Set initial targets
  updateLayoutTargets();

  // Watch container resizing
  window.addEventListener('resize', () => {
    updateLayoutTargets();
    if (simState === 'post') {
      // Snap nodes to targets immediately on resize in post-state
      nodes.forEach(n => {
        n.x = n.targetX;
        n.y = n.targetY;
        n.element.style.left = `${n.x}px`;
        n.element.style.top = `${n.y}px`;
      });
      drawPaths();
    }
  });

  // Track mouse movements in container
  simContainer.addEventListener('mousemove', (e) => {
    const rect = simContainer.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });

  simContainer.addEventListener('mouseleave', () => {
    mouse.x = -1000;
    mouse.y = -1000;
  });

  // Main Physics & Animation Loop
  function tick() {
    nodes.forEach((n) => {
      if (simState === 'pre') {
        // --- 1. Float Physics (Antigravity & Drift) ---
        n.x += n.vx;
        n.y += n.vy;

        // Apply constant tiny random force so they don't stop drifting
        n.vx += (Math.random() - 0.5) * 0.04;
        n.vy += (Math.random() - 0.5) * 0.04;

        // Cap speed
        const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
        if (speed > 1.2) {
          n.vx = (n.vx / speed) * 1.2;
          n.vy = (n.vy / speed) * 1.2;
        }

        // Bounding box collisions
        if (n.x < 15) { n.x = 15; n.vx *= -1; }
        if (n.x > viewW - n.width - 15) { n.x = viewW - n.width - 15; n.vx *= -1; }
        if (n.y < 15) { n.y = 15; n.vy *= -1; }
        // Leave room at the bottom for control bar
        if (n.y > viewH - n.height - 80) { n.y = viewH - n.height - 80; n.vy *= -1; }

        // --- 2. Cursor Repulsion ---
        const nodeCenterX = n.x + n.width / 2;
        const nodeCenterY = n.y + n.height / 2;
        const dx = nodeCenterX - mouse.x;
        const dy = nodeCenterY - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 180) {
          // Push vector away
          const force = (180 - dist) / 180; // normalized 0 to 1
          const pushX = (dx / dist) * force * 1.5;
          const pushY = (dy / dist) * force * 1.5;
          n.vx += pushX;
          n.vy += pushY;
        }

      } else if (simState === 'sucking') {
        // --- 3. Central Sucking Animation ---
        const dx = n.targetX - n.x;
        const dy = n.targetY - n.y;
        
        // Exponential ease-out pathing
        n.x += dx * 0.09;
        n.y += dy * 0.09;

        // Check if all nodes are close enough to snap
        const distanceToTarget = Math.sqrt(dx * dx + dy * dy);
        if (distanceToTarget < 1.5) {
          n.x = n.targetX;
          n.y = n.targetY;
        }
      }

      // Update positions
      n.element.style.left = `${n.x}px`;
      n.element.style.top = `${n.y}px`;
    });

    // Handle transitions when sucking finishes
    if (simState === 'sucking') {
      drawPaths();
      const allSnapped = nodes.every(n => Math.abs(n.targetX - n.x) < 0.2 && Math.abs(n.targetY - n.y) < 0.2);
      if (allSnapped) {
        completeTransformation();
      }
    }

    animationFrameId = requestAnimationFrame(tick);
  }

  // Draw lines connecting central hub to each node
  function drawPaths() {
    const cx = viewW / 2;
    const cy = viewH / 2;
    
    nodes.forEach(n => {
      const nodeCenterX = n.x + n.width / 2;
      const nodeCenterY = n.y + n.height / 2;
      
      // Update SVG attributes
      n.path.setAttribute('d', `M ${cx} ${cy} L ${nodeCenterX} ${nodeCenterY}`);
    });
  }

  // Start the loop
  animationFrameId = requestAnimationFrame(tick);

  // --- Trigger Transformation ---
  btnTransform.addEventListener('click', () => {
    if (simState === 'pre') {
      startTransformation();
    }
  });

  function startTransformation() {
    simState = 'sucking';
    
    // Disable primary button temporarily
    btnTransform.disabled = true;
    btnTransform.style.opacity = '0.5';

    // Transition styles
    bodyTheme.className = 'theme-post';
    statusText.textContent = 'Fase: Mentransformasikan Ekosistem...';
    
    // Swap text inside nodes
    nodes.forEach(n => {
      n.element.style.opacity = '0.4';
      setTimeout(() => {
        const postData = nodeStates[n.id].post;
        
        // Update DOM elements
        document.getElementById(`icon-${n.id.split('-')[1]}`).textContent = postData.icon;
        document.getElementById(`badge-${n.id.split('-')[1]}`).textContent = postData.badge;
        document.getElementById(`title-${n.id.split('-')[1]}`).textContent = postData.title;
        document.getElementById(`desc-${n.id.split('-')[1]}`).textContent = postData.desc;
        
        n.element.style.opacity = '1';
      }, 350);
    });
  }

  function completeTransformation() {
    simState = 'post';
    btnTransform.style.display = 'none';
    btnReset.style.display = 'flex';
    statusText.textContent = 'Fase: Pasca-Transformasi (Mandiri)';
    
    // Animate HUD indicators / numbers counting up
    animateHUD();
  }

  // Reset Simulation back to pre-state
  btnReset.addEventListener('click', () => {
    resetSimulation();
  });

  function resetSimulation() {
    simState = 'pre';
    
    // Toggle UI buttons
    btnReset.style.display = 'none';
    btnTransform.style.display = 'flex';
    btnTransform.disabled = false;
    btnTransform.style.opacity = '1';

    // Reset styles
    bodyTheme.className = 'theme-pre';
    statusText.textContent = 'Fase: Pra-Transformasi';

    // Reset HUD text values
    document.getElementById('hud-val-margin').textContent = 'Normal';
    document.getElementById('hud-val-margin').style.color = '#e2e4e9';
    document.getElementById('hud-val-retention').textContent = 'Rendah';
    document.getElementById('hud-val-retention').style.color = '#e2e4e9';

    // Re-randomize positions and velocities
    nodes.forEach(n => {
      n.x = Math.random() * (viewW - n.width - 60) + 30;
      n.y = Math.random() * (viewH - n.height - 120) + 40;
      n.vx = (Math.random() - 0.5) * 0.6;
      n.vy = (Math.random() - 0.5) * 0.6;

      // Swap text inside nodes back to pre
      n.element.style.opacity = '0.4';
      setTimeout(() => {
        const preData = nodeStates[n.id].pre;
        document.getElementById(`icon-${n.id.split('-')[1]}`).textContent = preData.icon;
        document.getElementById(`badge-${n.id.split('-')[1]}`).textContent = preData.badge;
        document.getElementById(`title-${n.id.split('-')[1]}`).textContent = preData.title;
        document.getElementById(`desc-${n.id.split('-')[1]}`).textContent = preData.desc;
        n.element.style.opacity = '1';
      }, 250);
    });

    // Reset highlights
    document.querySelectorAll('.citation-card').forEach(c => c.classList.remove('highlighted'));
    document.querySelectorAll('.node').forEach(n => n.classList.remove('active-focus'));
  }

  // Counting up micro-animations for HUD metrics
  function animateHUD() {
    const marginHUD = document.getElementById('hud-val-margin');
    const retentionHUD = document.getElementById('hud-val-retention');

    // Count profit margin from 0 to +20% (aligning with 15%-20% saved commissions in PDF)
    let currentMargin = 0;
    const marginInterval = setInterval(() => {
      currentMargin += 1;
      marginHUD.textContent = `+${currentMargin}%`;
      marginHUD.style.color = '#39ff14';
      if (currentMargin >= 20) clearInterval(marginInterval);
    }, 45);

    // Count customer retention from 0 to +25% (aligning with 25% retention increase in PDF)
    let currentRetention = 0;
    const retentionInterval = setInterval(() => {
      currentRetention += 1;
      retentionHUD.textContent = `+${currentRetention}%`;
      retentionHUD.style.color = '#39ff14';
      if (currentRetention >= 25) clearInterval(retentionInterval);
    }, 40);
  }

  // --- Two-Way Academic Citation Linkage ---

  // 1. Hover/Click Node -> Highlights Citation Card
  nodes.forEach(n => {
    n.element.addEventListener('click', () => {
      const citeId = n.element.getAttribute('data-citation');
      highlightCitation(citeId);
      focusNode(n.id);
    });
  });

  // 2. Click Citation Card -> Highlights Node
  const citationCards = document.querySelectorAll('.citation-card');
  citationCards.forEach(card => {
    card.addEventListener('click', () => {
      const citeId = card.id;
      highlightCitation(citeId);
      
      // Find node that matches this citation
      const matchingNode = nodes.find(n => n.element.getAttribute('data-citation') === citeId);
      if (matchingNode) {
        focusNode(matchingNode.id);
      }
    });
  });

  function highlightCitation(id) {
    citationCards.forEach(c => {
      if (c.id === id) {
        c.classList.add('highlighted');
        c.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        c.classList.remove('highlighted');
      }
    });
  }

  function focusNode(nodeId) {
    nodes.forEach(n => {
      if (n.id === nodeId) {
        n.element.classList.add('active-focus');
        // Gentle bounce to indicate selection
        n.element.style.transform = 'scale(1.08)';
        setTimeout(() => {
          n.element.style.transform = '';
        }, 200);
      } else {
        n.element.classList.remove('active-focus');
      }
    });
  }
});
