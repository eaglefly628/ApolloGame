Page({
  data: {
    isVictory: false,
    reason: '',
    day: 0,
  },

  onLoad(options) {
    this.setData({
      isVictory: options.result === 'victory',
      reason: decodeURIComponent(options.reason || ''),
      day: options.day || 0,
    });
  },

  onRestart() {
    wx.reLaunch({ url: '/pages/index/index' });
  },
});
