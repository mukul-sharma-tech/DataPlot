import test from 'node:test';
import assert from 'node:assert/strict';

import { pickVisibleViewIds } from './viewSelection';

test('returns the first N visible views when no custom selection exists', () => {
  const ids = ['view_1', 'view_2', 'view_3', 'view_4', 'view_5'];
  assert.deepEqual(pickVisibleViewIds(ids, 3, []), ['view_1', 'view_2', 'view_3']);
});

test('keeps the chosen view order and respects the layout cap', () => {
  const ids = ['view_1', 'view_2', 'view_3', 'view_4', 'view_5'];
  assert.deepEqual(pickVisibleViewIds(ids, 3, ['view_5', 'view_2']), ['view_5', 'view_2']);
  assert.deepEqual(pickVisibleViewIds(ids, 2, ['view_3', 'view_4', 'view_5']), ['view_3', 'view_4']);
});

test('falls back to the first available view when the selection is invalid', () => {
  const ids = ['view_1', 'view_2', 'view_3'];
  assert.deepEqual(pickVisibleViewIds(ids, 2, ['missing_id']), ['view_1', 'view_2']);
});
