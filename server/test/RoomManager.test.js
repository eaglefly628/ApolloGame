const { RoomManager } = require('../src/core/RoomManager');

// Mock ConnectionManager
function mockConnectionManager() {
  return {
    send: jest.fn(),
    broadcast: jest.fn(),
    setRoom: jest.fn(),
    getConnection: jest.fn(() => ({ roomId: null })),
  };
}

describe('RoomManager', () => {
  let rm;
  let cm;

  beforeEach(() => {
    rm = new RoomManager();
    cm = mockConnectionManager();
  });

  afterEach(() => {
    rm.destroy();
  });

  test('createRoom returns a room with 6-char ID', () => {
    const result = rm.createRoom('player1');
    expect(result.room).toBeDefined();
    expect(result.room.id).toHaveLength(6);
    expect(result.room.players).toEqual(['player1']);
    expect(result.room.host).toBe('player1');
  });

  test('joinRoom adds player to room', () => {
    const { room } = rm.createRoom('p1');
    const result = rm.joinRoom(room.id, 'p2', cm);
    expect(result.room.players).toEqual(['p1', 'p2']);
    expect(cm.send).toHaveBeenCalledWith('p1', expect.objectContaining({ type: 'player_joined' }));
  });

  test('joinRoom rejects if room full', () => {
    const { room } = rm.createRoom('p1');
    rm.joinRoom(room.id, 'p2', cm);
    const result = rm.joinRoom(room.id, 'p3', cm);
    expect(result.error).toBe('Room is full');
  });

  test('quickMatch finds existing waiting room', () => {
    const { room } = rm.createRoom('p1');
    cm.setRoom.mockClear();
    const result = rm.quickMatch('p2', cm);
    expect(result.room.id).toBe(room.id);
    expect(result.room.players).toContain('p2');
  });

  test('quickMatch creates new room if none available', () => {
    const result = rm.quickMatch('p1', cm);
    expect(result.room).toBeDefined();
    expect(result.room.players).toEqual(['p1']);
  });

  test('startGame requires host and 2 players', () => {
    const { room } = rm.createRoom('p1');
    rm.joinRoom(room.id, 'p2', cm);

    const fail = rm.startGame(room.id, 'p2', cm);
    expect(fail.error).toBe('Only host can start');

    const success = rm.startGame(room.id, 'p1', cm);
    expect(success.room.state).toBe('playing');
    expect(cm.broadcast).toHaveBeenCalledWith(
      ['p1', 'p2'],
      expect.objectContaining({ type: 'game_start' })
    );
  });

  test('leaveRoom cleans up empty rooms', () => {
    const { room } = rm.createRoom('p1');
    rm.leaveRoom(room.id, 'p1', cm);
    expect(rm.getRoom(room.id)).toBeUndefined();
  });

  test('leaveRoom during game notifies opponent', () => {
    const { room } = rm.createRoom('p1');
    rm.joinRoom(room.id, 'p2', cm);
    rm.startGame(room.id, 'p1', cm);
    cm.broadcast.mockClear();

    rm.leaveRoom(room.id, 'p1', cm);
    expect(cm.broadcast).toHaveBeenCalledWith(
      ['p2'],
      expect.objectContaining({ type: 'opponent_left' })
    );
  });
});
