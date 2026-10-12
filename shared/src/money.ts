export type Currency = 'JPY' | 'TWD';

export interface MoneyLine {
  amount: number;
  currency: Currency;
  /** Who paid; lines without a payer are left out of the settlement. */
  paidBy?: string | null;
  /** even = shared by all members; solo = the payer's own spending. */
  split?: 'even' | 'solo';
}

/** fx = how many TWD one JPY is worth (e.g. 0.2). */
export function toTwd(amount: number, currency: Currency, fx: number): number {
  return currency === 'TWD' ? amount : amount * fx;
}

export interface Transfer {
  from: string;
  to: string;
  amount: number;
}

/**
 * Net balance per member in TWD (positive = others owe them) and the fewest
 * transfers that settle it.
 */
export function settle(lines: MoneyLine[], members: string[], fx: number): { net: Record<string, number>; transfers: Transfer[] } {
  const net: Record<string, number> = Object.fromEntries(members.map((m) => [m, 0]));
  if (members.length < 2) return { net, transfers: [] };
  for (const l of lines) {
    if (!l.paidBy || !(l.paidBy in net) || l.split === 'solo') continue;
    const twd = toTwd(l.amount, l.currency, fx);
    net[l.paidBy] += twd;
    for (const m of members) net[m] -= twd / members.length;
  }
  const debtors = members.filter((m) => net[m] < -0.5).map((m) => ({ m, v: -net[m] })).sort((a, b) => b.v - a.v);
  const creditors = members.filter((m) => net[m] > 0.5).map((m) => ({ m, v: net[m] })).sort((a, b) => b.v - a.v);
  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].v, creditors[j].v);
    transfers.push({ from: debtors[i].m, to: creditors[j].m, amount: Math.round(pay) });
    debtors[i].v -= pay;
    creditors[j].v -= pay;
    if (debtors[i].v < 0.5) i++;
    if (creditors[j].v < 0.5) j++;
  }
  return { net, transfers };
}
