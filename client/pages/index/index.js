const { socketManager } = require('../../utils/socket');
const app = getApp();

Page({
  data: {
    statusText: '',
    selectedPathogen: 'tencent',
    pathogens: [
      { type: 'tencent', icon: '🐉', name: '私域小绿龙', origin: '腾讯系·真菌', desc: '同海域极快，跨区极难' },
      { type: 'bytedance', icon: '🦐', name: '算法摇摆虾', origin: '字节系·病毒', desc: '随机突变，信息茧房' },
      { type: 'ali', icon: '🔪', name: '屠龙大刀虾', origin: '阿里系·寄生虫', desc: '隐蔽收割，百亿补贴' },
      { type: 'xiaomi', icon: '🏎️', name: '苏七速跑龙', origin: '小米系·纳米', desc: '开局解药即启动' },
    ],
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
      // Solo mode: session created -> select pathogen -> go to world
      socketManager.on('inv_session_created', (data) => {
        app.globalData.sessionId = data.sessionId;
        socketManager.send('inv_select_pathogen', { pathogenType: this.data.selectedPathogen });
      });
      socketManager.on('inv_pathogen_selected', (data) => {
        app.globalData.pathogen = data.pathogen;
        app.globalData.regions = data.regions;
        wx.navigateTo({ url: '/pages/world/world' });
      });
    } catch (e) {
      this.setData({ statusText: '连接失败，点击重试' });
    }
  },

  onSelectPathogen(e) {
    this.setData({ selectedPathogen: e.currentTarget.dataset.type });
  },

  onSoloStart() {
    if (!this.data.selectedPathogen) {
      this.setData({ statusText: '请先选择病原体' });
      return;
    }
    socketManager.send('solo_start', { tickRate: 1200 });
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
