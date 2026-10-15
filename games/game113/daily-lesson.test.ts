import { describe, expect, it } from 'vitest';
import { HOBBIES, dailyRecommendation } from './data.js';
import { dailyCompletionKey, dailyLessonFor } from './daily-lesson.js';

describe('game113 daily mobile lesson', () => {
  it('has a real short path for every home recommendation', () => {
    for (let day = 1; day <= 31; day++) {
      const hobby = dailyRecommendation([], new Date(2026, 9, day));
      const lesson = dailyLessonFor(hobby.id);
      expect(lesson.title).toContain(hobby.name);
      expect(lesson.spots).toHaveLength(2);
      expect(lesson.answers[lesson.correct]).toBeTruthy();
      expect(HOBBIES.find((x) => x.id === hobby.id)?.image.kind).toBe('ai-demo');
    }
  });

  it('stores a local-date chapter key without depending on the UTC day', () => {
    expect(dailyCompletionKey('woodwork', new Date(2026, 9, 8))).toBe('2026-10-08:woodwork');
  });
});
