import { describe, expect, test } from 'vitest';
import { targetDimensions, formatBytes } from './image';

describe('targetDimensions', () => {
  test('a photo already small enough is left alone', () => {
    expect(targetDimensions(800, 600)).toEqual({ width: 800, height: 600 });
  });

  test('a landscape phone photo is scaled by its long edge', () => {
    expect(targetDimensions(4032, 3024)).toEqual({ width: 1600, height: 1200 });
  });

  test('a portrait photo is scaled by its long edge too', () => {
    expect(targetDimensions(3024, 4032)).toEqual({ width: 1200, height: 1600 });
  });

  test('aspect ratio is preserved', () => {
    const { width, height } = targetDimensions(4000, 2000);
    expect(width / height).toBeCloseTo(2, 5);
  });

  test('a photo exactly at the limit is not resized', () => {
    expect(targetDimensions(1600, 900)).toEqual({ width: 1600, height: 900 });
  });
});

describe('formatBytes', () => {
  test('reads in units a person recognises', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});
