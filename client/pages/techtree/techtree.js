const { socketManager } = require('../../utils/socket');

Page({
  data: {
    kpiPoints: 0,
    sections: [],
  },

  onLoad() {
    socketManager.on('inv_tree', (tree) => {
      this._buildSections(tree);
    });

    socketManager.on('inv_tick', (report) => {
      this.setData({ kpiPoints: report.kpiTotal || 0 });
    });

    socketManager.on('inv_mutation_unlocked', (data) => {
      // Refresh tree
      socketManager.send('inv_get_tree');
      wx.showToast({ title: '解锁成功', icon: 'success' });
    });

    // Request tree data
    socketManager.send('inv_get_tree');
    socketManager.send('inv_get_snapshot');

    socketManager.on('inv_snapshot', (snapshot) => {
      this.setData({ kpiPoints: snapshot.world.kpiPoints || 0 });
      if (snapshot.mutationTree) {
        this._buildSections(snapshot.mutationTree);
      }
    });
  },

  _buildSections(tree) {
    const unlockedSet = new Set(tree.filter((n) => n.isUnlocked).map((n) => n.id));

    const sectionMap = {
      transmission: { title: '传播途径', type: 'transmission', nodes: [] },
      symptom: { title: '异化症状', type: 'symptom', nodes: [] },
      ability: { title: '特殊能力', type: 'ability', nodes: [] },
    };

    for (const node of tree) {
      const canUnlock = !node.isUnlocked && node.requires.every((r) => unlockedSet.has(r));
      const section = sectionMap[node.type];
      if (section) {
        section.nodes.push({ ...node, canUnlock });
      }
    }

    this.setData({
      sections: [sectionMap.transmission, sectionMap.symptom, sectionMap.ability],
    });
  },

  onUnlockNode(e) {
    const { id, unlocked, canUnlock } = e.currentTarget.dataset;
    if (unlocked) return;
    if (!canUnlock) {
      wx.showToast({ title: '前置科技未解锁', icon: 'none' });
      return;
    }
    socketManager.send('inv_unlock_mutation', { mutationId: id });
  },

  onBack() {
    wx.navigateBack();
  },

  onUnload() {
    socketManager.off('inv_tree');
    socketManager.off('inv_snapshot');
  },
});
