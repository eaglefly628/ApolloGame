/**
 * Example game plugin: Tic-Tac-Toe
 * Demonstrates how to build a specific game on top of the framework.
 * Replace or extend this for your own game logic.
 */
class TicTacToePlugin {
  static initState(players) {
    return {
      board: Array(9).fill(null),
      turn: players[0],
      players: {
        [players[0]]: 'X',
        [players[1]]: 'O',
      },
      winner: null,
    };
  }

  static applyAction(gameState, playerId, action) {
    if (gameState.winner) return { error: 'Game is over' };
    if (gameState.turn !== playerId) return { error: 'Not your turn' };

    const { position } = action;
    if (position < 0 || position > 8 || gameState.board[position] !== null) {
      return { error: 'Invalid move' };
    }

    gameState.board[position] = gameState.players[playerId];
    const winner = TicTacToePlugin.checkWinner(gameState.board);

    if (winner) {
      gameState.winner = playerId;
      return { gameState, finished: true, result: { winner: playerId } };
    }

    if (gameState.board.every((cell) => cell !== null)) {
      return { gameState, finished: true, result: { winner: null, draw: true } };
    }

    // Switch turn
    const otherPlayer = Object.keys(gameState.players).find((id) => id !== playerId);
    gameState.turn = otherPlayer;
    return { gameState, finished: false };
  }

  static checkWinner(board) {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
      [0, 4, 8], [2, 4, 6],             // diagonals
    ];
    for (const [a, b, c] of lines) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a];
      }
    }
    return null;
  }
}

module.exports = { TicTacToePlugin };
