import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Engine } from '../../../runtime/engine.js';
import {
  CHIPS_ID,
  BET_ID,
  BLACKJACK_LIMIT,
  DEALER_STAND_AT,
  INITIAL_CHIPS,
  MIN_BET,
  MAX_BET,
  GAME_STATES,
  buildDeck,
  type Card,
  type Hand,
} from '../theme.js';
import { GAME_STATE_ENTITY, CHIPS_ENTITY, BET_ENTITY } from '../blueprint.js';
import { calculateScore, canSplit } from './utils.js';

interface GameSession {
  deck: Card[];
  playerHands: Hand[];
  currentHandIndex: number;
  dealerCards: Card[];
  gameState: string;
  outcome?: string;
}

// 3D Model Generators
function createCardMesh(card: Card | null, hidden = false): THREE.Mesh {
  const cardWidth = 1;
  const cardHeight = 1.4;
  const cardDepth = 0.05;

  const geometry = new THREE.BoxGeometry(cardWidth, cardHeight, cardDepth);

  let material: THREE.Material;
  if (hidden) {
    // Card back (red gradient)
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 360;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 256, 360);
    grad.addColorStop(0, '#b1402f');
    grad.addColorStop(0.5, '#7d2a1e');
    grad.addColorStop(1, '#5a1a12');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 360);
    ctx.strokeStyle = '#fbf7ef';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, 256, 360);

    const texture = new THREE.CanvasTexture(canvas);
    material = new THREE.MeshStandardMaterial({ map: texture });
  } else if (card) {
    // Card front (white with suit/rank)
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 360;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fcf9f1';
    ctx.fillRect(0, 0, 256, 360);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, 256, 360);

    const suitColors: Record<string, string> = { hearts: '#c0392b', diamonds: '#c0651a', clubs: '#2d6a3f', spades: '#22303f' };
    const suitSymbols: Record<string, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };

    // Top-left rank and suit
    ctx.fillStyle = suitColors[card.suit];
    ctx.font = 'bold 48px system-ui';
    ctx.fillText(card.display, 16, 60);
    ctx.font = 'bold 56px system-ui';
    ctx.fillText(suitSymbols[card.suit], 16, 100);

    // Center suit symbol
    ctx.font = 'bold 120px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(suitSymbols[card.suit], 128, 180);

    // Bottom-right (upside down)
    ctx.save();
    ctx.translate(240, 340);
    ctx.rotate(Math.PI);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 48px system-ui';
    ctx.fillText(card.display, 0, 0);
    ctx.font = 'bold 56px system-ui';
    ctx.fillText(suitSymbols[card.suit], 0, 50);
    ctx.restore();

    const texture = new THREE.CanvasTexture(canvas);
    material = new THREE.MeshStandardMaterial({ map: texture });
  } else {
    material = new THREE.MeshStandardMaterial({ color: 0xcccccc });
  }

  return new THREE.Mesh(geometry, material);
}

function createChipMesh(value: number): THREE.Mesh {
  const geometry = new THREE.CylinderGeometry(0.35, 0.35, 0.15, 32);

  // Chip color based on value
  const colors: Record<number, string> = {
    5: '#e74c3c',
    25: '#2ecc71',
    50: '#3498db',
    100: '#f39c12',
    250: '#9b59b6',
    500: '#34495e',
  };
  const color = colors[value] || '#95a5a6';
  const material = new THREE.MeshStandardMaterial({ color });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createTableMesh(): THREE.Mesh {
  // Green felt table
  const geometry = new THREE.PlaneGeometry(20, 14);
  const material = new THREE.MeshStandardMaterial({
    color: 0x1a6e4e,
    roughness: 0.3,
    metalness: 0.1,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

interface Blackjack3DStageProps {
  engine: Engine;
}

export function Blackjack3DStage({ engine }: Blackjack3DStageProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshesRef = useRef<Map<string, THREE.Mesh>>(new Map());

  const [gameSession, setGameSession] = useState<GameSession>(() => ({
    deck: [],
    playerHands: [],
    currentHandIndex: 0,
    dealerCards: [],
    gameState: GAME_STATES.BETTING,
  }));

  const [currentBet, setCurrentBet] = useState(0);
  const [chips, setChips] = useState(INITIAL_CHIPS);
  const [uiVisible, setUiVisible] = useState(true);

  // Initialize three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a4d2e);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 12, 0);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(8, 10, 8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.6);
    fillLight.position.set(-8, 6, -8);
    scene.add(fillLight);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    // Table
    const table = createTableMesh();
    scene.add(table);

    // Handle window resize
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  // Render game state to 3D
  useEffect(() => {
    if (!sceneRef.current) return;

    const scene = sceneRef.current;
    const meshes = meshesRef.current;

    // Clear old card meshes
    meshes.forEach((mesh: THREE.Mesh) => {
      scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    });
    meshes.clear();

    // Render dealer cards (top of table)
    gameSession.dealerCards.forEach((card: Card, i: number) => {
      const cardMesh = createCardMesh(card, gameSession.gameState === GAME_STATES.PLAYER_TURN && i === gameSession.dealerCards.length - 1);
      cardMesh.position.set(-3 + i * 1.3, 1, -6);
      cardMesh.castShadow = true;
      scene.add(cardMesh);
      meshes.set(`dealer-${i}`, cardMesh);
    });

    // Render player hands (bottom of table)
    gameSession.playerHands.forEach((hand: Hand, handIdx: number) => {
      const startX = -2 + handIdx * 3;
      hand.cards.forEach((card: Card, cardIdx: number) => {
        const cardMesh = createCardMesh(card);
        cardMesh.position.set(startX + cardIdx * 1.1, 1, 6);
        cardMesh.castShadow = true;
        scene.add(cardMesh);
        meshes.set(`player-${handIdx}-${cardIdx}`, cardMesh);
      });
    });

    // Render chips for current bet
    const chipValues = [500, 100, 50, 25, 10, 5, 1];
    let betAmount = currentBet;
    let chipCount = 0;
    for (const value of chipValues) {
      while (betAmount >= value && chipCount < 20) {
        const chipMesh = createChipMesh(value);
        const angle = (chipCount / 20) * Math.PI * 2;
        const radius = 3;
        chipMesh.position.set(
          Math.cos(angle) * radius,
          0.3,
          Math.sin(angle) * radius
        );
        scene.add(chipMesh);
        meshes.set(`chip-${chipCount}`, chipMesh);
        betAmount -= value;
        chipCount++;
      }
    }
  }, [gameSession, currentBet]);

  const initializeGame = useCallback((bet: number) => {
    const fullDeck = buildDeck();
    const deck = [...fullDeck].sort(() => Math.random() - 0.5);
    const playerCards = [deck.pop()!, deck.pop()!];
    const dealerCards = [deck.pop()!, deck.pop()!];

    setGameSession({
      deck,
      playerHands: [{ cards: playerCards, bet, status: 'active' }],
      currentHandIndex: 0,
      dealerCards,
      gameState: GAME_STATES.PLAYER_TURN,
    });

    setCurrentBet(0);
  }, []);

  const onHit = useCallback(() => {
    setGameSession((prev: GameSession) => {
      const newSession = { ...prev };
      const hand = newSession.playerHands[newSession.currentHandIndex];

      if (newSession.deck.length === 0) return prev;
      hand.cards.push(newSession.deck.pop()!);

      const { score } = calculateScore(hand.cards);
      if (score > BLACKJACK_LIMIT) {
        hand.status = 'bust';
        if (newSession.currentHandIndex < newSession.playerHands.length - 1) {
          newSession.currentHandIndex += 1;
        } else {
          newSession.gameState = GAME_STATES.DEALER_TURN;
        }
      }

      return newSession;
    });
  }, []);

  const onStand = useCallback(() => {
    setGameSession((prev: GameSession) => {
      const newSession = { ...prev };
      const hand = newSession.playerHands[newSession.currentHandIndex];
      hand.status = 'stand';

      if (newSession.currentHandIndex < newSession.playerHands.length - 1) {
        newSession.currentHandIndex += 1;
      } else {
        newSession.gameState = GAME_STATES.DEALER_TURN;
      }

      return newSession;
    });
  }, []);

  const onSplit = useCallback(() => {
    setGameSession((prev: GameSession) => {
      const newSession = { ...prev };
      const hand = newSession.playerHands[newSession.currentHandIndex];

      if (!canSplit(hand) || newSession.deck.length < 2) return prev;

      const splitCard = hand.cards.pop()!;
      const newHand: Hand = {
        cards: [splitCard, newSession.deck.pop()!],
        bet: hand.bet,
        status: 'active',
      };

      hand.cards.push(newSession.deck.pop()!);
      newSession.playerHands.push(newHand);

      return newSession;
    });
  }, []);

  const currentHand = gameSession.playerHands[gameSession.currentHandIndex];
  const isPlayerTurn = gameSession.gameState === GAME_STATES.PLAYER_TURN;
  const isBetting = gameSession.gameState === GAME_STATES.BETTING;

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100vh', overflow: 'hidden' }}>
      {uiVisible && (
        <div style={{
          position: 'fixed',
          bottom: 20,
          left: 20,
          right: 20,
          background: 'rgba(0,0,0,0.8)',
          color: '#fff',
          padding: '20px',
          borderRadius: '8px',
          fontFamily: 'monospace',
          zIndex: 100,
        }}>
          <div style={{ marginBottom: '10px' }}>
            筹码: {chips} | 下注: {currentBet}
          </div>
          {isBetting && (
            <div style={{ display: 'flex', gap: '10px' }}>
              {[10, 25, 50, 100, 250, 500].map((bet) => (
                <button
                  key={bet}
                  onClick={() => setCurrentBet(Math.min(currentBet + bet, chips))}
                  style={{
                    padding: '8px 16px',
                    background: '#4ade80',
                    color: '#000',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                  }}
                >
                  +{bet}
                </button>
              ))}
              <button
                onClick={() => setCurrentBet(0)}
                style={{
                  padding: '8px 16px',
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                清空
              </button>
              {currentBet > 0 && (
                <button
                  onClick={() => {
                    initializeGame(currentBet);
                    setChips(chips - currentBet);
                  }}
                  style={{
                    padding: '8px 16px',
                    background: '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                  }}
                >
                  开始游戏
                </button>
              )}
            </div>
          )}
          {isPlayerTurn && currentHand && currentHand.status === 'active' && (
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button onClick={onHit} style={{
                padding: '8px 16px',
                background: '#4ade80',
                color: '#000',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}>
                要牌
              </button>
              <button onClick={onStand} style={{
                padding: '8px 16px',
                background: '#f59e0b',
                color: '#000',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}>
                停牌
              </button>
              {canSplit(currentHand) && chips >= currentHand.bet && (
                <button onClick={onSplit} style={{
                  padding: '8px 16px',
                  background: '#8b5cf6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}>
                  分牌
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
