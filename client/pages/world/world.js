const { socketManager } = require('../../utils/socket');
const app = getApp();

// Region positions on canvas (normalized 0~1, mapped to actual canvas size)
const REGION_LAYOUT = {
  cn_south:       { x: 0.68, y: 0.42, label: '南海域' },
  cn_east:        { x: 0.72, y: 0.30, label: '东海域' },
  cn_north:       { x: 0.70, y: 0.20, label: '北海域' },
  southeast_asia: { x: 0.65, y: 0.55, label: '东南亚' },
  japan_korea:    { x: 0.82, y: 0.25, label: '日韩' },
  india:          { x: 0.55, y: 0.45, label: '印度洋' },
  europe:         { x: 0.38, y: 0.20, label: '欧洲' },
  americas:       { x: 0.15, y: 0.30, label: '美洲' },
  africa:         { x: 0.40, y: 0.55, label: '非洲' },
  middle_east:    { x: 0.48, y: 0.32, label: '中东' },
};

Page({
  data: {
    day: 0,
    kpiPoints: 0,
    infectedCount: 0,
    removedCount: 0,
    cureProgress: 0,
    isPaused: false,
    gamePhase: 'seeding', // seeding | running
    selectedRegion: null,
    activeEvent: null,
    dismissClicks: 0,
    specialAbility: null,
  },

  onLoad() {
    this.regions = {};       // regionId -> region data from server
    this.canvasWidth = 0;
    this.canvasHeight = 0;

    // Set special ability based on pathogen type
    const pathogen = app.globalData.pathogen;
    if (pathogen) {
      const abilities = {
        tencent: { name: '孢子爆发', ability: 'spore_burst' },
        xiaomi: { name: '生态互联', ability: 'eco_lock' },
      };
      if (abilities[pathogen.type]) {
        this.setData({ specialAbility: abilities[pathogen.type] });
      }
    }

    // Initialize regions from server data
    const serverRegions = app.globalData.regions || [];
    for (const r of serverRegions) {
      this.regions[r.id] = { ...r, susceptible: r.totalPop, infected: 0, removed: 0, isDiscovered: false };
    }

    this._bindSocketEvents();
    this._initCanvas();
  },

  _bindSocketEvents() {
    socketManager.on('inv_region_seeded', (data) => {
      const r = this.regions[data.regionId];
      if (r) {
        r.infected = data.infected;
        r.susceptible -= data.infected;
        r.isDiscovered = true;
      }
      this._drawMap();
    });

    socketManager.on('inv_sim_started', () => {
      this.setData({ gamePhase: 'running' });
    });

    socketManager.on('inv_tick', (report) => {
      this._handleTick(report);
    });

    socketManager.on('inv_game_over', (result) => {
      wx.redirectTo({
        url: `/pages/result/result?result=${result.result}&reason=${encodeURIComponent(result.reason)}&day=${this.data.day}`,
      });
    });

    socketManager.on('inv_pause_toggled', (data) => {
      this.setData({ isPaused: data.paused });
    });

    socketManager.on('inv_mutation_unlocked', () => {
      wx.showToast({ title: '科技已解锁', icon: 'success' });
    });

    socketManager.on('inv_ability_used', (data) => {
      if (data.targets) {
        wx.showToast({ title: `孢子感染 ${data.targets.length} 个海域`, icon: 'none' });
      } else if (data.success) {
        wx.showToast({ title: '技能已释放', icon: 'success' });
      }
    });
  },

  _handleTick(report) {
    // Update region data
    for (const [id, rData] of Object.entries(report.regions || {})) {
      if (this.regions[id]) {
        this.regions[id].susceptible = rData.S;
        this.regions[id].infected = rData.I;
        this.regions[id].removed = rData.R;
        this.regions[id].isDiscovered = true;
      }
    }

    // Update HUD
    const stats = report.stats || {};
    this.setData({
      day: report.day,
      kpiPoints: report.kpiTotal || 0,
      infectedCount: stats.totalInfected || 0,
      removedCount: stats.totalRemoved || 0,
      cureProgress: report.cureProgress || 0,
    });

    // Handle triggered events
    if (report.triggeredEvents && report.triggeredEvents.length > 0) {
      const interactive = report.triggeredEvents.find((e) => e.type === 'interactive');
      if (interactive) {
        this.setData({ activeEvent: interactive, dismissClicks: 0 });
      }
      // Show auto events as toast
      for (const evt of report.triggeredEvents) {
        if (evt.type === 'auto') {
          wx.showToast({ title: evt.name, icon: 'none', duration: 2000 });
        }
      }
    }

    // Redraw map
    this._drawMap();

    // Update selected region popup
    if (this.data.selectedRegion) {
      const r = this.regions[this.data.selectedRegion.id];
      if (r) {
        this.setData({
          selectedRegion: { ...r, name: REGION_LAYOUT[r.id]?.label || r.name },
        });
      }
    }
  },

  _initCanvas() {
    const query = wx.createSelectorQuery();
    query.select('.world-canvas').boundingClientRect((rect) => {
      if (rect) {
        this.canvasWidth = rect.width;
        this.canvasHeight = rect.height;
        this._drawMap();
      }
    }).exec();
  },

  _drawMap() {
    const ctx = wx.createCanvasContext('worldMap');
    const W = this.canvasWidth;
    const H = this.canvasHeight;

    // Background
    ctx.setFillStyle('#0a0a1a');
    ctx.fillRect(0, 0, W, H);

    // Draw connections first
    ctx.setLineWidth(1);
    for (const [id, region] of Object.entries(this.regions)) {
      const pos = REGION_LAYOUT[id];
      if (!pos || !region.connections) continue;
      for (const conn of region.connections) {
        const targetPos = REGION_LAYOUT[conn.regionId];
        if (!targetPos) continue;
        // Only draw each connection once (from lower id)
        if (id > conn.regionId) continue;
        ctx.setStrokeStyle('rgba(100, 126, 234, 0.15)');
        ctx.beginPath();
        ctx.moveTo(pos.x * W, pos.y * H);
        // Bezier curve for visual appeal
        const mx = (pos.x + targetPos.x) / 2 * W;
        const my = (pos.y + targetPos.y) / 2 * H - 20;
        ctx.quadraticCurveTo(mx, my, targetPos.x * W, targetPos.y * H);
        ctx.stroke();
      }
    }

    // Draw region nodes
    for (const [id, region] of Object.entries(this.regions)) {
      const pos = REGION_LAYOUT[id];
      if (!pos) continue;

      const x = pos.x * W;
      const y = pos.y * H;
      const total = region.totalPop || 1;
      const infRate = region.infected / total;

      // Node size based on population
      const baseRadius = 12 + (total / 80000) * 12;

      // Color: green (healthy) -> red (infected) -> grey (removed)
      let r, g, b;
      if (!region.isDiscovered) {
        r = 80; g = 160; b = 80; // Uninfected green
      } else {
        r = Math.floor(80 + infRate * 175);
        g = Math.floor(160 - infRate * 140);
        b = Math.floor(80 - infRate * 60);
      }

      // Glow for infected regions
      if (infRate > 0.1) {
        ctx.setFillStyle(`rgba(${r}, ${g}, ${b}, 0.2)`);
        ctx.beginPath();
        ctx.arc(x, y, baseRadius + 8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Main circle
      ctx.setFillStyle(`rgb(${r}, ${g}, ${b})`);
      ctx.beginPath();
      ctx.arc(x, y, baseRadius, 0, Math.PI * 2);
      ctx.fill();

      // Infection pie overlay
      if (infRate > 0 && infRate < 1) {
        ctx.setFillStyle('rgba(231, 76, 60, 0.7)');
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.arc(x, y, baseRadius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * infRate);
        ctx.closePath();
        ctx.fill();
      }

      // Label
      ctx.setFillStyle('#ccc');
      ctx.setFontSize(10);
      ctx.setTextAlign('center');
      ctx.fillText(pos.label, x, y + baseRadius + 14);

      // Infected count
      if (region.isDiscovered) {
        ctx.setFillStyle('#ffd700');
        ctx.setFontSize(9);
        ctx.fillText(region.infected.toString(), x, y + 4);
      }
    }

    ctx.draw();
  },

  onMapTap(e) {
    const x = e.detail.x / this.canvasWidth;
    const y = e.detail.y / this.canvasHeight;

    // Find closest region
    let closest = null;
    let minDist = Infinity;
    for (const [id, pos] of Object.entries(REGION_LAYOUT)) {
      const dist = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
      if (dist < 0.08 && dist < minDist) {
        minDist = dist;
        closest = id;
      }
    }

    if (closest && this.regions[closest]) {
      const r = this.regions[closest];
      this.setData({
        selectedRegion: { ...r, id: closest, name: REGION_LAYOUT[closest].label },
      });
    } else {
      this.setData({ selectedRegion: null });
    }
  },

  onSeedRegion() {
    const region = this.data.selectedRegion;
    if (!region) return;
    socketManager.send('inv_seed_region', { regionId: region.id });
    this.setData({ selectedRegion: null });
  },

  onStartSim() {
    socketManager.send('inv_start_sim');
  },

  onTogglePause() {
    socketManager.send('inv_toggle_pause');
  },

  onOpenTree() {
    socketManager.send('inv_get_tree');
    wx.navigateTo({ url: '/pages/techtree/techtree' });
  },

  onUseSpecial() {
    if (!this.data.specialAbility) return;
    socketManager.send('inv_special_ability', {
      ability: this.data.specialAbility.ability,
    });
  },

  // Event interactions
  onDismissEvent() {
    const clicks = this.data.dismissClicks + 1;
    if (clicks >= (this.data.activeEvent.requiredClicks || 5)) {
      socketManager.send('inv_resolve_event', {
        eventId: this.data.activeEvent.id,
        action: 'dismiss',
      });
      this.setData({ activeEvent: null, dismissClicks: 0 });
    } else {
      this.setData({ dismissClicks: clicks });
    }
  },

  onSuppressRiot() {
    socketManager.send('inv_resolve_event', {
      eventId: this.data.activeEvent.id,
      action: 'suppress',
    });
    this.setData({ activeEvent: null });
  },

  onIgnoreRiot() {
    socketManager.send('inv_resolve_event', {
      eventId: this.data.activeEvent.id,
      action: 'ignore',
    });
    this.setData({ activeEvent: null });
  },

  onUnload() {
    socketManager.off('inv_tick', this._handleTick);
    socketManager.off('inv_game_over');
  },
});
