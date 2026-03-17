const { socketManager } = require('../../utils/socket');
const app = getApp();

Page({
  data: {
    statusText: '',
  },

  onLoad() {
    this.connectServer();
  },

  async connectServer() {
    this.setData({ statusText: '连接服务器...' });
    try {
      await socketManager.connect(app.globalData.serverUrl);
      socketManager.on('connected', (data) => {
        app.globalData.playerId = data.playerId;
        this.setData({ statusText: '' });
      });
      socketManager.on('room_created', (data) => {
        wx.navigateTo({ url: `/pages/room/room?roomId=${data.roomId}&isHost=true` });
      });
      socketManager.on('room_joined', (data) => {
        wx.navigateTo({ url: `/pages/room/room?roomId=${data.roomId}&isHost=false` });
      });
    } catch (e) {
      this.setData({ statusText: '连接失败，点击重试' });
    }
  },

  onQuickMatch() {
    this.setData({ statusText: '匹配中...' });
    socketManager.send('quick_match');
  },

  onCreateRoom() {
    socketManager.send('create_room');
  },

  onJoinRoom() {
    wx.showModal({
      title: '加入房间',
      editable: true,
      placeholderText: '请输入房间号',
      success: (res) => {
        if (res.confirm && res.content) {
          socketManager.send('join_room', { roomId: res.content.toUpperCase() });
        }
      },
    });
  },

  onUnload() {
    socketManager.close();
  },
});
