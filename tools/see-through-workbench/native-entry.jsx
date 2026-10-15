import React, { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import App from '@/App';
import CanvasViewport from '@/components/canvas/CanvasViewport';
import { ThemeProvider } from '@/contexts/ThemeProvider';
import { useAudioSync } from '@/components/timeline/TimelinePanel';
import { useAnimationStore } from '@/store/animationStore';
import { useProjectStore } from '@/store/projectStore';
import '@/index.css';
import '@fontsource/inter';
import '@fontsource/roboto';
import '@fontsource/open-sans';
import '@fontsource/lato';
import '@fontsource/montserrat';
import '@fontsource/source-sans-3';
import '@fontsource/poppins';
import { installNativeBridge } from './native-bridge.mjs';

const player = new URLSearchParams(location.search).get('mode') === 'player';
document.body.style.margin = '0';
document.getElementById('root').style.cssText = 'position:absolute;inset:0';
if (player) {
  // Remove only the native editor backdrop. The original character render pass
  // remains responsible for all geometry, textures, clipping and blending.
  const style = document.createElement('style');
  style.textContent = 'html,body,#root,.apollo-native-player,.apollo-native-player>div{background:transparent!important}.apollo-native-player{position:absolute;inset:0;pointer-events:none}.apollo-native-player svg{display:none}';
  document.head.append(style);
}
function NativeApplication() {
  const loadRef = useRef(null);
  useEffect(() => installNativeBridge(player ? loadRef : null), []);
  return player
    ? <div className="apollo-native-player"><NativeAudio /><CanvasViewport loadRef={loadRef} /></div>
    : <App />;
}
function NativeAudio() {
  const animation = useAnimationStore();
  const project = useProjectStore(s => s.project);
  useAudioSync(project.animations.find(a => a.id === animation.activeAnimationId), animation);
  return null;
}
createRoot(document.getElementById('root')).render(<ThemeProvider><NativeApplication /></ThemeProvider>);
