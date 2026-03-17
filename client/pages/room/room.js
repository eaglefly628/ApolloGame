const { socketManager } = require('../../utils/socket');

Page({
  data: {
    roomId: '',
    isHost: false,
    player2Joined: false,
  },

  onLoad(options) {
    this.setData({
      roomId: options.roomId,
      isHost: options.isHost === 'true',
    });

    socketManager.on('player_joined', this.onPlayerJoined.bind(this));
    socketManager.on('opponent_left', this.onOpponentLeft.bind(this));
    socketManager.on('game_start', this.onGameStart.bind(this));

    // If joining (not host), player 2 is us, so host is already there
    if (!this.data.isHost) {
      this.setData({ player2Joined: true });
    }
  },

  onPlayerJoined(data) {
    this.setData({ player2Joined: true });
  },

  onOpponentLeft(data) {
    this.setData({ player2Joined: false });
    wx.showToast({ title: '对方离开了', icon: 'none' });
  },

  onGameStart(data) {
    wx.redirectTo({
      url: `/pages/game/game?roomId=${this.data.roomId}&gameState=${encodeURIComponent(JSON.stringify(data.gameState))}&players=${encodeURIComponent(JSON.stringify(data.players))}`,
    });
  },

  onStartGame() {
    socketManager.send('start_game');
  },

  onLeaveRoom() {
    socketManager.send('leave_room');
    wx.navigateBack();
  },

  onUnload() {
    socketManager.off('player_joined', this.onPlayerJoined);
    socketManager.off('opponent_left', this.onOpponentLeft);
    socketManager.off('game_start', this.onGameStart);
  },
});
