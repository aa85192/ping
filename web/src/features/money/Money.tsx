import { settle, toTwd, type MoneyLine } from '@ping/shared';
import { ArrowRight, Plus, Receipt } from 'lucide-react';
import { useMemo, useState } from 'react';
import { StarMark } from '../../components/icons';
import type { Booking, Expense, ExpenseCategory } from '../../data/model';
import { tripDates } from '../../data/model';
import { dayLabel, shortDay, wallDate } from '../../lib/time';
import { useApp } from '../../store';
import { BookingSheet, STATUS_LABEL } from '../booking/BookingSheet';
import { ExpenseSheet, newExpense } from './ExpenseSheet';
import { bookingCategory, CATEGORIES, CATEGORY, jpy, membersOf, twd } from './meta';

/** Labelled horizontal bars: one hue, value printed, so no legend or tooltip is needed. */
function Bars({ rows }: { rows: { key: string; label: string; value: number; sub?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="bars" role="table">
      {rows.map((r) => (
        <div key={r.key} className="bar-row" role="row">
          <span className="bar-label" role="cell">
            {r.label}
            {r.sub && <span className="tiny muted"> {r.sub}</span>}
          </span>
          <span className="bar-track" role="cell" aria-hidden="true">
            {r.value > 0 && <span className="bar-fill" style={{ width: `${(r.value / max) * 100}%` }} />}
          </span>
          <span className="bar-value num" role="cell">
            {r.value > 0 ? twd(r.value) : '—'}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Money() {
  const { trip, bookings, expenses, user, putBooking } = useApp();
  const [editing, setEditing] = useState<Expense | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const fx = trip!.fxRate;
  const members = membersOf(trip!);
  const nameOf = (id?: string | null) => members.find((m) => m.id === id)?.name ?? '未設定';
  const me = user?.uid && members.some((m) => m.id === user.uid) ? user.uid : members[0].id;

  const paidBookings = bookings.filter((b) => b.amount && b.amount.amount > 0).sort((a, b) => a.start.localeCompare(b.start));
  const bookingTwd = (b: Booking) => toTwd(b.amount!.amount, b.amount!.currency === 'JPY' ? 'JPY' : 'TWD', fx);

  const stats = useMemo(() => {
    const byCat = Object.fromEntries(CATEGORIES.map((c) => [c.id, 0])) as Record<ExpenseCategory, number>;
    const byDay: Record<string, number> = {};
    let booked = 0;
    let daily = 0;
    let jpyCash = 0;
    for (const b of paidBookings) {
      const v = bookingTwd(b);
      booked += v;
      byCat[bookingCategory(b)] += v;
    }
    for (const e of expenses) {
      const v = toTwd(e.amount, e.currency, fx);
      daily += v;
      byCat[e.category] += v;
      byDay[e.date] = (byDay[e.date] ?? 0) + v;
      if (e.currency === 'JPY') jpyCash += e.amount;
    }
    const lines: MoneyLine[] = [
      ...expenses.map((e) => ({ amount: e.amount, currency: e.currency, paidBy: e.paidBy, split: e.split })),
      ...paidBookings.map((b) => ({ amount: b.amount!.amount, currency: (b.amount!.currency === 'JPY' ? 'JPY' : 'TWD') as 'JPY' | 'TWD', paidBy: b.paidBy, split: 'even' as const })),
    ];
    return { byCat, byDay, booked, daily, jpyCash, total: booked + daily, settlement: settle(lines, members.map((m) => m.id), fx) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings, expenses, fx, trip]);

  const dates = tripDates(trip!);
  const outside = Object.keys(stats.byDay).filter((d) => !dates.includes(d)).sort();
  const grouped = useMemo(() => {
    const m = new Map<string, Expense[]>();
    [...expenses].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).forEach((e) => m.set(e.date, [...(m.get(e.date) ?? []), e]));
    return [...m.entries()];
  }, [expenses]);
  const budget = trip!.budget ?? null;
  const perPerson = stats.total / Math.max(1, trip!.travelers);

  return (
    <>
      <header className="topbar">
        <StarMark size={30} />
        <div className="title">
          <h1>花費</h1>
          <div className="sub">¥1 = NT${fx}（設定頁可改）</div>
        </div>
      </header>
      <main className="page" style={{ paddingBottom: 84 }}>
        <div className="hero">
          <div className="small" style={{ fontWeight: 700 }}>
            這趟總花費
          </div>
          <div className="big num" style={{ marginTop: 6 }}>
            {twd(stats.total)}
          </div>
          <div className="small num" style={{ marginTop: 6 }}>
            預訂 {twd(stats.booked)} · 旅途記帳 {twd(stats.daily)} · 每人約 {twd(perPerson)}
          </div>
          {stats.jpyCash > 0 && <div className="tiny num">其中日圓支出 {jpy(stats.jpyCash)}</div>}
          {budget ? (
            <div style={{ marginTop: 10 }}>
              <div className="budget" style={{ background: 'rgba(255,255,255,.55)' }}>
                <div className="stay" style={{ width: `${Math.min(100, (stats.total / budget) * 100)}%`, background: stats.total > budget ? 'var(--cheek-ink)' : 'var(--ink)' }} />
              </div>
              <div className="tiny num" style={{ marginTop: 4 }}>
                預算 {twd(budget)} · {stats.total > budget ? `超出 ${twd(stats.total - budget)}` : `還剩 ${twd(budget - stats.total)}`}
              </div>
            </div>
          ) : (
            <div className="tiny" style={{ marginTop: 6 }}>可在設定 → 行程 設定預算</div>
          )}
        </div>

        {stats.settlement.transfers.length > 0 && (
          <section className="card">
            <div className="card-head">
              <h2>結算</h2>
            </div>
            {stats.settlement.transfers.map((t) => (
              <div key={`${t.from}-${t.to}`} className="row" style={{ fontSize: 16 }}>
                <b>{nameOf(t.from)}</b>
                <ArrowRight size={16} />
                <b>{nameOf(t.to)}</b>
                <span className="spacer" />
                <b className="num">{twd(t.amount)}</b>
              </div>
            ))}
            <div className="tiny muted" style={{ marginTop: 6 }}>只算「大家平分」且有填付款人的項目</div>
          </section>
        )}

        <section className="card">
          <div className="card-head">
            <h2>分類</h2>
          </div>
          <Bars
            rows={CATEGORIES.map((c) => ({ key: c.id, label: c.label, value: stats.byCat[c.id] }))
              .filter((r) => r.value > 0)
              .sort((a, b) => b.value - a.value)}
          />
          {stats.total === 0 && <div className="small muted">還沒有任何花費</div>}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>每天（旅途記帳）</h2>
          </div>
          <Bars
            rows={[
              ...outside.map((d) => ({ key: d, label: shortDay(d).md, sub: '出發前', value: stats.byDay[d] })),
              ...dates.map((d) => ({ key: d, label: shortDay(d).md, sub: shortDay(d).wd, value: stats.byDay[d] ?? 0 })),
            ]}
          />
        </section>

        <section className="card">
          <div className="card-head">
            <h2>預訂</h2>
            <span className="spacer" />
            <span className="small num muted">{twd(stats.booked)}</span>
          </div>
          <div className="list">
            {paidBookings.map((b) => (
              <div key={b.id} className="list-item">
                <div style={{ flex: 1, minWidth: 0 }} onClick={() => setEditingBooking(b)}>
                  <div className="ellipsis">{b.title}</div>
                  <div className="tiny muted">
                    {dayLabel(wallDate(b.start))} · <span className={`chip ${STATUS_LABEL[b.status].tone}`}>{STATUS_LABEL[b.status].label}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="num small">{b.amount!.currency === 'JPY' ? jpy(b.amount!.amount) : twd(b.amount!.amount)}</div>
                  {members.length > 1 && (
                    <select
                      className="tiny"
                      style={{ border: 0, background: 'transparent', color: 'var(--muted)' }}
                      value={b.paidBy ?? ''}
                      aria-label={`${b.title} 由誰付款`}
                      onChange={(e) => void putBooking({ ...b, paidBy: e.target.value || null })}
                    >
                      <option value="">誰付的？</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} 付
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            ))}
            {paidBookings.length === 0 && <div className="small muted">總覽的機票、住宿填了金額就會出現在這裡</div>}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <Receipt size={18} className="icon" />
            <h2>記帳明細</h2>
            <span className="spacer" />
            <span className="small muted">{expenses.length} 筆</span>
          </div>
          {grouped.length === 0 && <div className="small muted">按右下「記一筆」開始記帳</div>}
          {grouped.map(([date, list]) => (
            <div key={date} style={{ marginBottom: 8 }}>
              <div className="row tiny muted" style={{ marginTop: 6 }}>
                <b>{dayLabel(date)}</b>
                <span className="spacer" />
                <span className="num">{twd(list.reduce((s, e) => s + toTwd(e.amount, e.currency, fx), 0))}</span>
              </div>
              <div className="list">
                {list.map((e) => {
                  const Icon = CATEGORY[e.category].icon;
                  return (
                    <button key={e.id} className="list-item btn ghost" style={{ justifyContent: 'flex-start', borderRadius: 0, height: 'auto', padding: '8px 0', textAlign: 'left' }} onClick={() => setEditing(e)}>
                      <span className="link-icon">
                        <Icon size={16} />
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span className="ellipsis" style={{ display: 'block' }}>
                          {e.title}
                        </span>
                        {members.length > 1 && (
                          <span className="tiny muted">
                            {nameOf(e.paidBy)} 付 · {e.split === 'even' ? '平分' : '自己的'}
                          </span>
                        )}
                      </span>
                      <span style={{ textAlign: 'right' }}>
                        <b className="num">{e.currency === 'JPY' ? jpy(e.amount) : twd(e.amount)}</b>
                        {e.currency === 'JPY' && <span className="tiny muted num" style={{ display: 'block' }}>{twd(toTwd(e.amount, 'JPY', fx))}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      </main>
      <button className="fab" onClick={() => setEditing(newExpense(me))}>
        <Plus size={20} /> 記一筆
      </button>
      {editing && <ExpenseSheet expense={editing} onClose={() => setEditing(null)} />}
      {editingBooking && <BookingSheet booking={editingBooking} onClose={() => setEditingBooking(null)} />}
    </>
  );
}
