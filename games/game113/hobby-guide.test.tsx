// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HOBBIES } from './data.js';
import { FocusHallView } from './focus-hall-view.js';
import { guideJourneyFor } from './guide-journeys.js';
import { guideArtFor, guidePhoto } from './guide-art.js';
import { SAKE_MENTOR_CHAPTERS } from './sake-mentor.js';
import { CIGAR_MENTOR_CHAPTERS } from './cigar-mentor.js';
import { cigarMentorPanels } from './cigar-mentor-panels.js';
import { cigarHotspots } from './cigar-hotspots.js';
import { CigarCultureView } from './cigar-culture-view.js';
import { CIGAR_BRAND_FILES, CIGAR_CULTURE_TIMELINE } from './cigar-culture.js';
import { cigarScrollCanOpen } from './cigar-scroll.js';
import { sakeMentorPanels } from './sake-mentor-panels.js';
import { readGuideProgress } from './hobby-guide-view.js';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const sake = HOBBIES.find((hobby) => hobby.id === 'sake')! as typeof HOBBIES[number] & { id: 'sake' };
const cigar = HOBBIES.find((hobby) => hobby.id === 'cigar')! as typeof HOBBIES[number] & { id: 'cigar' };
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.localStorage.clear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

async function passCurrentChapter(chapterIndex: number) {
  for (const _ of SAKE_MENTOR_CHAPTERS[chapterIndex].observations) {
    await act(async () => (host.querySelector('.g113-mentor-action') as HTMLButtonElement).click());
    await act(async () => (host.querySelector('.g113-mentor-action') as HTMLButtonElement).click());
  }
  for (const question of SAKE_MENTOR_CHAPTERS[chapterIndex].exam) {
    await act(async () => (host.querySelectorAll('.g113-mentor-options button')[question.correct] as HTMLButtonElement).click());
    await act(async () => (host.querySelector('.g113-mentor-feedback button') as HTMLButtonElement).click());
  }
}

describe('game113 guided sake entrance', () => {
  it('has a truthful local documentary photograph for every sake and cigar observation', () => {
    for (const [chapters, getPanels] of [[SAKE_MENTOR_CHAPTERS, sakeMentorPanels], [CIGAR_MENTOR_CHAPTERS, cigarMentorPanels]] as const) {
      for (const chapter of chapters) {
        const panels = getPanels(chapter.id);
        expect(panels, chapter.id).toHaveLength(chapter.observations.length);
        for (const panel of panels) {
          const photo = guidePhoto(panel.assetId);
          expect(photo, panel.assetId).toBeDefined();
          expect(existsSync(resolve('public', photo!.src.slice(1))), panel.assetId).toBe(true);
          expect(panel.caption).toContain('·');
          expect(panel.deep.length).toBe(2);
        }
        expect(chapter.exam.every((question) => panels[question.imageStep])).toBe(true);
      }
    }
  });
  it('does not turn earlier choice-only progress into a passed exam', () => {
    window.localStorage.setItem('game113-guide-v2-sake', JSON.stringify({ scene: 4, completed: 5, answers: [0, 0, 0, 0, 0] }));
    expect(readGuideProgress('sake', 5)).toMatchObject({ scene: 0, completed: 0 });
  });

  it('pairs each sake chapter with a local licensed photograph and a readable diagram', () => {
    for (const chapter of guideJourneyFor(sake).scenes) {
      const art = guideArtFor('sake', chapter.id);
      expect(art, chapter.id).toBeDefined();
      expect(art!.steps.length, chapter.id).toBeGreaterThanOrEqual(3);
      const photo = guidePhoto(art!.assetId);
      expect(photo, chapter.id).toBeDefined();
      expect(photo!.license, chapter.id).toMatch(/^CC0 |^CC BY/);
      expect(photo!.sourceUrl, chapter.id).toContain('commons.wikimedia.org/wiki/File:');
      expect(existsSync(resolve('public', photo!.src.slice(1))), chapter.id).toBe(true);
    }
  });

  it('keeps the age gate, then lets the mentor teach, examine, remember, and open deeper files', async () => {
    const onSaveNote = vi.fn();
    const renderHall = () => <FocusHallView hobby={sake} following={false} note="" onFollow={() => {}} onCircle={() => {}} onCompose={() => {}} onOpenItem={() => {}} onSaveNote={onSaveNote}/>;
    await act(async () => root.render(renderHall()));
    expect(host.textContent).toContain('我已达到当地法定饮酒年龄');
    expect(host.textContent).not.toContain('杉翁');

    await act(async () => (host.querySelector('.g113-focus-gate button') as HTMLButtonElement).click());
    expect(host.textContent).toContain('清酒长卷');
    expect(host.textContent).toContain('阅历 0 / 5');
    expect(host.textContent).not.toContain('品牌索引');
    expect(host.querySelector('.g113-sake-scroll-library')).toBeNull();
    await act(async () => (host.querySelectorAll('.g113-sake-scroll-primary button')[1] as HTMLButtonElement).click());
    expect(host.textContent).toContain('SAKE COMPETITION 2026');
    await act(async () => (host.querySelectorAll('.g113-sake-scroll-primary button')[0] as HTMLButtonElement).click());
    expect(host.textContent).toContain('杉翁');
    expect(host.textContent).toContain('时间的门');
    expect(host.querySelector('.g113-mentor-photo img')?.getAttribute('src')).toContain('sugidama-kiku-cc0.jpg');
    expect(host.textContent).toContain('先抬头');
    expect(host.textContent).not.toContain('它叫杉玉，也叫酒林');
    await act(async () => (host.querySelector('.g113-mentor-action') as HTMLButtonElement).click());
    expect(host.textContent).toContain('它叫杉玉，也叫酒林');
    expect(host.textContent).not.toContain('时序初明');
    await act(async () => (host.querySelector('.g113-mentor-action') as HTMLButtonElement).click());
    for (let index = 1; index < 3; index += 1) {
      await act(async () => (host.querySelector('.g113-mentor-action') as HTMLButtonElement).click());
      await act(async () => (host.querySelector('.g113-mentor-action') as HTMLButtonElement).click());
    }
    expect(host.textContent).toContain('出门小考');
    await act(async () => (host.querySelectorAll('.g113-mentor-options button')[2] as HTMLButtonElement).click());
    expect(host.textContent).toContain('回头看看线索');
    expect(host.querySelector('.g113-sake-scroll-library')).toBeNull();
    await act(async () => (host.querySelector('.g113-mentor-feedback button') as HTMLButtonElement).click());
    for (const question of SAKE_MENTOR_CHAPTERS[0].exam) {
      await act(async () => (host.querySelectorAll('.g113-mentor-options button')[question.correct] as HTMLButtonElement).click());
      await act(async () => (host.querySelector('.g113-mentor-feedback button') as HTMLButtonElement).click());
    }
    expect(host.textContent).toContain('时序初明');
    expect(host.textContent).toContain('阅历 1 / 5');
    expect(host.querySelector('.g113-sake-scroll-library')).not.toBeNull();
    await act(async () => (host.querySelectorAll('.g113-mentor-next button')[1] as HTMLButtonElement).click());
    expect(host.textContent).toContain('米的另一种命运');
    expect(JSON.parse(window.localStorage.getItem('game113-guide-v3-sake')!)).toMatchObject({ scene: 1, completed: 1 });

    await act(async () => root.unmount());
    root = createRoot(host);
    await act(async () => root.render(renderHall()));
    await act(async () => (host.querySelector('.g113-focus-gate button') as HTMLButtonElement).click());
    expect(host.textContent).toContain('米的另一种命运');
  });

  it('does not expose the brand catalogue until the third chapter is claimed', async () => {
    await act(async () => root.render(<FocusHallView hobby={sake} following={false} note="" onFollow={() => {}} onCircle={() => {}} onCompose={() => {}} onOpenItem={() => {}} onSaveNote={() => {}}/>));
    await act(async () => (host.querySelector('.g113-focus-gate button') as HTMLButtonElement).click());
    for (let chapter = 0; chapter < 3; chapter += 1) {
      expect(host.querySelector('.g113-sake-scroll-library')?.textContent ?? '').not.toContain('品牌目录');
      await passCurrentChapter(chapter);
      if (chapter < 2) await act(async () => (host.querySelectorAll('.g113-mentor-next button')[1] as HTMLButtonElement).click());
    }
    expect(host.textContent).toContain('一纸有据');
    expect(host.querySelector('.g113-sake-scroll-library')?.textContent).toContain('品牌目录');
    const brandButton = Array.from(host.querySelectorAll('.g113-sake-scroll-library button')).find((button) => button.textContent?.includes('品牌目录')) as HTMLButtonElement;
    await act(async () => brandButton.click());
    expect(host.textContent).toContain('清酒品牌目录');
  });
});

describe('game113 novice cigar craft scroll', () => {
  it('uses an adult gate, real photos, optional depth and two correct answers to unlock a chapter', async () => {
    await act(async () => root.render(<FocusHallView hobby={cigar} following={false} note="" onFollow={() => {}} onCircle={() => {}} onCompose={() => {}} onOpenItem={() => {}} onSaveNote={() => {}}/>));
    expect(host.textContent).toContain('法定烟草年龄');
    expect(host.textContent).toContain('所有形式的烟草使用都有害');
    expect(host.textContent).not.toContain('叶伯');
    await act(async () => (host.querySelector('.g113-focus-gate button') as HTMLButtonElement).click());
    expect(host.textContent).toContain('雪茄工艺长卷');
    expect(host.textContent).toContain('一支雪茄的内外');
    expect(host.textContent).not.toContain('一片叶的来处');
    expect(host.querySelector('.g113-mentor-photo img')?.getAttribute('src')).toContain('cigar-section-cc-by.jpg');
    expect(host.querySelector('.g113-sake-scroll-library')).toBeNull();
    await act(async () => (host.querySelector('.g113-mentor-hotspot') as HTMLButtonElement).click());
    expect(host.textContent).toContain('茄衣');
    expect(host.textContent).toContain('仍需追问');
    const depth = host.querySelector('.g113-mentor-depth') as HTMLDetailsElement;
    expect(depth).not.toBeNull();
    expect(depth.open).toBe(false);
    for (let index = 1; index < 3; index += 1) {
      await act(async () => (host.querySelector('.g113-mentor-action') as HTMLButtonElement).click());
      await act(async () => (host.querySelector('.g113-mentor-hotspot-index button') as HTMLButtonElement).click());
    }
    await act(async () => (host.querySelector('.g113-mentor-action') as HTMLButtonElement).click());
    expect(host.textContent).toContain('出门小考');
    expect(host.querySelector('.g113-mentor-photo img')?.getAttribute('src')).toContain('/games/game113/real/');
    for (const question of CIGAR_MENTOR_CHAPTERS[0].exam) {
      await act(async () => (host.querySelectorAll('.g113-mentor-options button')[question.correct] as HTMLButtonElement).click());
      await act(async () => (host.querySelector('.g113-mentor-feedback button') as HTMLButtonElement).click());
    }
    expect(host.textContent).toContain('三层初识');
    expect(host.querySelector('.g113-sake-scroll-library')).not.toBeNull();
    await act(async () => (host.querySelectorAll('.g113-mentor-next button')[1] as HTMLButtonElement).click());
    expect(host.textContent).toContain('一片叶的来处');
    expect(JSON.parse(window.localStorage.getItem('game113-guide-v3-cigar')!)).toMatchObject({ scene: 1, completed: 1 });
  });

  it('keeps the culture volume locked until craft chapter, then lets readers choose cultural clues', async () => {
    expect(cigarScrollCanOpen('culture', 2)).toBe(false);
    expect(cigarScrollCanOpen('culture', 3)).toBe(true);
    expect(CIGAR_CULTURE_TIMELINE).toHaveLength(5);
    expect(CIGAR_BRAND_FILES).toHaveLength(8);
    for (const chapter of CIGAR_MENTOR_CHAPTERS) for (let step = 0; step < chapter.observations.length; step += 1) expect(cigarHotspots(chapter.id, step)).toHaveLength(2);
    const onDiscuss = vi.fn();
    await act(async () => root.render(<CigarCultureView onDiscuss={onDiscuss}/>));
    expect(host.textContent).toContain('工坊有声音');
    await act(async () => (Array.from(host.querySelectorAll('.g113-cigar-culture-reel button')).find((button) => button.textContent?.includes('1935')) as HTMLButtonElement).click());
    expect(host.textContent).toContain('基督山伯爵');
    await act(async () => (host.querySelectorAll('.g113-cigar-culture-tabs button')[2] as HTMLButtonElement).click());
    await act(async () => (Array.from(host.querySelectorAll('.g113-cigar-brand-list button')).find((button) => button.textContent?.includes('Partagás')) as HTMLButtonElement).click());
    expect(host.textContent).toContain('工坊与街道记忆');
    expect(host.textContent).toContain('对应品牌实物照片待授权');
    await act(async () => (host.querySelector('.g113-cigar-culture-after button') as HTMLButtonElement).click());
    expect(onDiscuss).toHaveBeenCalledOnce();
  });
});
