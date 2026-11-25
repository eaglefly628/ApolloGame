import {Engine} from './runtime/src/runtime/engine.js';
import {parseManifest} from './runtime/src/assembly/manifest.js';
import {ThreeRenderer} from './runtime/src/renderer/three-renderer.js';
import {AssetManager, ModelAssetLoader, ImageAssetLoader} from './runtime/src/assets/index.js';
import {KeyboardInputSource, type KeyMap} from './runtime/src/net/host/local-input.js';
import {QueuedInputSource} from './runtime/src/net/host/queued-input.js';
import {MultiInputSource} from './runtime/src/net/commands.js';
import {mountUI, resolveDialogue, validateLayoutNode, apolloOnyx, type LayoutNode, type DialogueSource} from './runtime/src/ui/components/index.js';
import {optionAvailable, type DialogueScript} from './runtime/src/skills/tier3/dialogue.js';
import type {State} from './runtime/src/engine/protocol/components.js';
import type {InteractionAgent, InteractionTarget} from './interaction.js';
import {CharacterPresentation} from './character-presentation.js';
import scene from './scene.json';

async function main() {
  const models = new ModelAssetLoader();
  const images = new ImageAssetLoader();
  const assets = new AssetManager({load: descriptor => descriptor.kind === 'model' ? models.load(descriptor) : images.load(descriptor)});
  for (const asset of scene.assets) assets.register(asset as any);
  await assets.loadAll();
  const queue = new QueuedInputSource('p1');
  const keymap: KeyMap = {
    ArrowLeft: {dx: -1}, KeyA: {dx: -1}, ArrowRight: {dx: 1}, KeyD: {dx: 1},
    ArrowUp: {dy: -1}, KeyW: {dy: -1}, ArrowDown: {dy: 1}, KeyS: {dy: 1},
    KeyE: {action: 'interaction.confirm'}, Escape: {action: 'interaction.cancel'},
  };
  const keys = new KeyboardInputSource('p1', window, keymap);
  // Existing keyboard source suppresses OS repeats. The release adapter adds the
  // explicit up event required to preserve the engine-side held latch in snapshots.
  const release = (event: KeyboardEvent) => {
    const action = keymap[event.code]?.action;
    if (action) queue.enqueue({source: 'p1', key: action, phase: 'up'});
  };
  const blur = () => {
    queue.enqueue({source: 'p1', key: 'interaction.confirm', phase: 'up'});
    queue.enqueueAction('interaction.cancel');
  };
  window.addEventListener('keyup', release);
  window.addEventListener('blur', blur);
  const engine = new Engine({tickRate: 60, input: new MultiInputSource([keys, queue])});
  engine.load(parseManifest(scene.manifest));
  const characters = new CharacterPresentation(engine.world, scene.characters);
  const shell: LayoutNode = {type: 'Panel', id: 'pilot', props: {},
    layout: {direction: 'column', gap: 8, padding: 12, height: Math.max(360, window.innerHeight - 26)}, children: [
      {type: 'Label', id: 'title', props: {text: '梧桐街 · 面包房', size: 'lg', bold: true}},
      {type: 'Panel', id: 'scene-stage', props: {bare: true}, layout: {flex: 1, minHeight: 0}},
      {type: 'Panel', id: 'conversation-hud', props: {bare: true}, layout: {height: 230}},
    ]};
  const issues = validateLayoutNode(shell);
  if (issues.length) throw Error(JSON.stringify(issues));
  const unmountShell = mountUI(document.getElementById('root')!, shell, {}, apolloOnyx);
  const renderer = new ThreeRenderer({width: 1280, height: 600, assets, dprCap: 1.5, shadowMapSize: 2048});
  const stage = document.getElementById('scene-stage')!;
  stage.tabIndex = 0;
  stage.setAttribute('aria-label', '梧桐街行走场景');
  engine.attachRenderer(renderer, stage);
  const source: DialogueSource = {current(id) {
    const script = engine.world.getComponent<DialogueScript>(id, 'DialogueScript');
    const state = engine.world.getComponent<State>(id, 'State');
    const node = script && state && script.nodes[state.current];
    if (!node) return;
    return {kind: node.kind, speaker: node.speaker, text: node.kind === 'line' ? node.text : node.prompt,
      options: node.kind === 'choice' ? node.options.map(option => ({label: option.text, available: optionAvailable(engine.world, option)})) : []};
  }};
  const names: Record<string, string> = {'shopkeeper-1': '面包房店主', 'shopkeeper-0': '隔壁店主'};
  const session = () => engine.world.getComponent<InteractionAgent>('player', 'InteractionAgent')!;
  function hud(): LayoutNode {
    const agent = session();
    const target = agent.target && engine.world.getComponent<InteractionTarget>(agent.target, 'InteractionTarget');
    const receiver = target ? target.dialogueEntity : '';
    const view = receiver && source.current(receiver);
    const active = Boolean(agent.target);
    return resolveDialogue({type: 'Panel', id: 'conversation', props: {glass: true},
      layout: {direction: 'column', gap: 8, padding: 12}, children: [
        {type: 'Label', id: 'hint', props: {text: active ? `正在与${names[agent.target]}交谈` :
          agent.candidate ? `E · 与${names[agent.candidate]}交谈` : '走近店主并面向对方，可以交谈。', size: 'md'}},
        ...(active ? [
          {type: 'dialog', id: 'dialogue-line', props: {bind: receiver, advanceAction: 'interaction.confirm', typewriter: 0, edge: 'gold'}} as LayoutNode,
          {type: 'choiceList', id: 'dialogue-choices', props: {bind: receiver, chooseAction: 'interaction.choose', hoverSheen: true}} as LayoutNode,
        ] : []),
        {type: 'Panel', id: 'talk-buttons', props: {bare: true}, layout: {direction: 'row', gap: 12}, children: [
          {type: 'Button', id: 'talk-confirm', props: {label: active ? '继续 · E' : '交谈 · E',
            action: 'interaction.confirm', disabled: active ? Boolean(view && view.kind === 'choice') : !agent.candidate, kind: 'primary'}},
          ...(active ? [{type: 'Button', id: 'talk-cancel', props: {label: '告辞 · Esc', action: 'interaction.cancel'}} as LayoutNode] : []),
        ]},
        {type: 'Label', id: 'controls', props: {text: '方向键 / WASD 行走 · E 确认 · Esc 取消 · Tab 选按钮，Enter 激活', size: 'sm'}},
      ]}, source);
  }
  let previousFocus: HTMLElement | null = null;
  let previousTarget = '';
  let previousKey = '';
  let initialTree = hud();
  const unmountHud = mountUI(document.getElementById('conversation-hud')!, initialTree, {}, apolloOnyx,
    {enqueueAction: (name, value) => queue.enqueueAction(name, value)});
  function update() {
    characters.update(performance.now());
    const agent = session();
    const receiver = agent.target && engine.world.getComponent<InteractionTarget>(agent.target, 'InteractionTarget')?.dialogueEntity;
    const node = receiver && engine.world.getComponent<State>(receiver, 'State')?.current;
    const key = [agent.target, agent.candidate, node, agent.sequence].join('|');
    if (key === previousKey) return;
    previousKey = key;
    if (!previousTarget && agent.target) previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    initialTree = hud();
    const errors = validateLayoutNode(initialTree);
    if (errors.length) throw Error(JSON.stringify(errors));
    unmountHud.update(initialTree);
    if (agent.target) {
      const focus = document.querySelector<HTMLButtonElement>('#dialogue-choices button:not(:disabled)') ?? document.getElementById('talk-confirm');
      focus?.focus({preventScroll: true});
    } else if (previousTarget) {
      const previous = previousFocus?.isConnected && previousFocus !== document.body && !previousFocus.matches(':disabled') ? previousFocus : null;
      const button = document.querySelector<HTMLButtonElement>('#talk-confirm:not(:disabled)');
      (previous ?? button ?? stage).focus({preventScroll: true});
    }
    previousTarget = agent.target;
  }
  engine.subscribe(update);
  update();
  engine.start();
  console.info('[interaction-pilot:ready]', {capability: 't2-interaction', isolation: 'local-snapshot'});
  window.addEventListener('pagehide', () => {
    engine.stop(); keys.dispose(); renderer.destroy(true); unmountHud(); unmountShell(); assets.clear();
    window.removeEventListener('keyup', release); window.removeEventListener('blur', blur);
  }, {once: true});
}
main().catch(error => console.error('[interaction-pilot:failed]', error));
