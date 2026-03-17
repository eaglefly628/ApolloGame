const { TicTacToePlugin } = require('../src/game/TicTacToePlugin');

describe('TicTacToePlugin', () => {
  const players = ['p1', 'p2'];

  test('initState creates empty board', () => {
    const state = TicTacToePlugin.initState(players);
    expect(state.board).toHaveLength(9);
    expect(state.board.every((c) => c === null)).toBe(true);
    expect(state.turn).toBe('p1');
  });

  test('applyAction places mark and switches turn', () => {
    const state = TicTacToePlugin.initState(players);
    const result = TicTacToePlugin.applyAction(state, 'p1', { position: 4 });
    expect(result.finished).toBe(false);
    expect(result.gameState.board[4]).toBe('X');
    expect(result.gameState.turn).toBe('p2');
  });

  test('rejects move on wrong turn', () => {
    const state = TicTacToePlugin.initState(players);
    const result = TicTacToePlugin.applyAction(state, 'p2', { position: 0 });
    expect(result.error).toBe('Not your turn');
  });

  test('detects winner', () => {
    const state = TicTacToePlugin.initState(players);
    // X: 0,1,2 (top row)
    TicTacToePlugin.applyAction(state, 'p1', { position: 0 });
    TicTacToePlugin.applyAction(state, 'p2', { position: 3 });
    TicTacToePlugin.applyAction(state, 'p1', { position: 1 });
    TicTacToePlugin.applyAction(state, 'p2', { position: 4 });
    const result = TicTacToePlugin.applyAction(state, 'p1', { position: 2 });
    expect(result.finished).toBe(true);
    expect(result.result.winner).toBe('p1');
  });

  test('detects draw', () => {
    const state = TicTacToePlugin.initState(players);
    // Fill board with no winner: X O X / X X O / O X O
    const moves = [
      ['p1', 0], ['p2', 1], ['p1', 2],
      ['p2', 5], ['p1', 3], ['p2', 6],
      ['p1', 4], ['p2', 8], ['p1', 7],
    ];
    let result;
    for (const [player, pos] of moves) {
      result = TicTacToePlugin.applyAction(state, player, { position: pos });
    }
    expect(result.finished).toBe(true);
    expect(result.result.draw).toBe(true);
  });
});
