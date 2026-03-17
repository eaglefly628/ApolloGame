const { socketManager } = require('../../utils/socket');
const app = getApp();

Page({
  data: {
    roomId: '',
    board: Array(9).fill(null),
    myMark: '',
    isMyTurn: false,
    turnText: '',
    resultText: '',
    gameOver: false,
  },

  onLoad(options) {
    const gameState = JSON.parse(decodeURIComponent(options.gameState));
    const players = JSON.parse(decodeURIComponent(options.players));
    const myId = app.globalData.playerId;

    const myMark = gameState.players[myId];
    const isMyTurn = gameState.turn === myId;

    this.gameState = gameState;
    this.myId = myId;

    this.setData({
      roomId: options.roomId,
      board: gameState.board,
      myMark,
      isMyTurn,
      turnText: isMyTurn ? `你的回合 (${myMark})` : '对方回合...',
    });

    socketManager.on('game_action', this.onOpponentAction.bind(this));
    socketManager.on('game_end', this.onGameEnd.bind(this));
    socketManager.on('opponent_left', this.onOpponentLeft.bind(this));
  },

  onCellTap(e) {
    if (this.data.gameOver || !this.data.isMyTurn) return;

    const index = e.currentTarget.dataset.index;
    if (this.data.board[index]) return;

    // Apply locally
    const board = [...this.data.board];
    board[index] = this.data.myMark;

    this.setData({
      board,
      isMyTurn: false,
      turnText: '对方回合...',
    });

    // Send to server
    socketManager.send('game_action', {
      action: { position: index },
    });

    // Check win locally
    const winner = this.checkWinner(board);
    if (winner) {
      this.setData({ resultText: '你赢了!', gameOver: true });
      socketManager.send('game_end', { result: { winner: this.myId } });
    } else if (board.every((c) => c !== null)) {
      this.setData({ resultText: '平局!', gameOver: true });
      socketManager.send('game_end', { result: { draw: true } });
    }
  },

  onOpponentAction(data) {
    const { action } = data;
    const board = [...this.data.board];
    const opponentMark = this.data.myMark === 'X' ? 'O' : 'X';
    board[action.position] = opponentMark;

    const winner = this.checkWinner(board);
    if (winner) {
      this.setData({ board, resultText: '你输了!', gameOver: true });
      return;
    }
    if (board.every((c) => c !== null)) {
      this.setData({ board, resultText: '平局!', gameOver: true });
      return;
    }

    this.setData({
      board,
      isMyTurn: true,
      turnText: `你的回合 (${this.data.myMark})`,
    });
  },

  onGameEnd(data) {
    if (!this.data.gameOver) {
      const result = data.result;
      if (result.draw) {
        this.setData({ resultText: '平局!', gameOver: true });
      } else if (result.winner === this.myId) {
        this.setData({ resultText: '你赢了!', gameOver: true });
      } else {
        this.setData({ resultText: '你输了!', gameOver: true });
      }
    }
  },

  onOpponentLeft() {
    if (!this.data.gameOver) {
      this.setData({ resultText: '对方离开了，你赢了!', gameOver: true });
    }
  },

  checkWinner(board) {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6],
    ];
    for (const [a, b, c] of lines) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a];
      }
    }
    return null;
  },

  onBackToHome() {
    socketManager.send('leave_room');
    wx.reLaunch({ url: '/pages/index/index' });
  },

  onUnload() {
    socketManager.off('game_action', this.onOpponentAction);
    socketManager.off('game_end', this.onGameEnd);
    socketManager.off('opponent_left', this.onOpponentLeft);
  },
});
