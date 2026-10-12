import { describe, expect, it } from 'vitest';
import { settle, toTwd } from './money';

describe('money', () => {
  it('converts JPY to TWD with the trip rate', () => {
    expect(toTwd(1000, 'JPY', 0.2)).toBe(200);
    expect(toTwd(500, 'TWD', 0.2)).toBe(500);
  });

  it('splits even expenses and ignores solo ones', () => {
    const r = settle(
      [
        { amount: 10000, currency: 'JPY', paidBy: 'a', split: 'even' }, // NT$2000, b owes 1000
        { amount: 600, currency: 'TWD', paidBy: 'b', split: 'even' }, // a owes 300
        { amount: 5000, currency: 'JPY', paidBy: 'a', split: 'solo' }, // own shopping
        { amount: 999, currency: 'TWD', paidBy: null }, // unknown payer
      ],
      ['a', 'b'],
      0.2,
    );
    expect(r.net).toEqual({ a: 700, b: -700 });
    expect(r.transfers).toEqual([{ from: 'b', to: 'a', amount: 700 }]);
  });

  it('needs at least two members to settle', () => {
    expect(settle([{ amount: 100, currency: 'TWD', paidBy: 'a' }], ['a'], 0.2).transfers).toEqual([]);
  });
});
