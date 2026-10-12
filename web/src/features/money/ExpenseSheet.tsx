import { toTwd } from '@ping/shared';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Sheet } from '../../components/Sheet';
import type { Expense } from '../../data/model';
import { newId } from '../../data/model';
import { todayInTz } from '../../lib/time';
import { useApp } from '../../store';
import { CATEGORIES, CATEGORY, membersOf, METHODS, twd } from './meta';

export function newExpense(defaultPayer: string): Expense {
  return {
    id: newId('ex_'),
    date: todayInTz(),
    title: '',
    amount: 0,
    currency: 'JPY',
    category: 'food',
    paidBy: defaultPayer,
    split: 'even',
    method: null,
    createdAt: Date.now(),
  };
}

export function ExpenseSheet({ expense, onClose }: { expense: Expense; onClose: () => void }) {
  const { trip, expenses, putExpense, deleteExpense } = useApp();
  const isNew = !expenses.some((e) => e.id === expense.id);
  const [e, setE] = useState<Expense>(expense);
  const [amountText, setAmountText] = useState(expense.amount ? String(expense.amount) : '');
  const members = membersOf(trip!);
  const set = (p: Partial<Expense>) => setE((x) => ({ ...x, ...p }));
  const amount = Number(amountText.replace(/,/g, ''));
  const valid = Number.isFinite(amount) && amount > 0;

  const save = async () => {
    if (!valid) return;
    await putExpense({ ...e, amount, title: e.title.trim() || CATEGORY[e.category].label });
    onClose();
  };

  return (
    <Sheet title={isNew ? '記一筆' : '編輯花費'} onClose={onClose}>
      <div className="row" style={{ alignItems: 'stretch' }}>
        <div className="seg" role="group" aria-label="幣別" style={{ flexDirection: 'column', borderRadius: 14 }}>
          {(['JPY', 'TWD'] as const).map((c) => (
            <button key={c} aria-pressed={e.currency === c} onClick={() => set({ currency: c })}>
              {c === 'JPY' ? '¥ 日圓' : 'NT$ 台幣'}
            </button>
          ))}
        </div>
        <input
          className="input num amount-input"
          inputMode="decimal"
          autoFocus={isNew}
          placeholder="0"
          value={amountText}
          onChange={(ev) => setAmountText(ev.target.value.replace(/[^\d.,]/g, ''))}
          aria-label="金額"
        />
      </div>
      {valid && e.currency === 'JPY' && <div className="tiny muted num" style={{ marginTop: -8 }}>≈ {twd(toTwd(amount, 'JPY', trip!.fxRate))}（¥1 = NT${trip!.fxRate}）</div>}

      <div className="cat-grid">
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          return (
            <button key={c.id} className="mode-opt" aria-pressed={e.category === c.id} onClick={() => set({ category: c.id })}>
              <Icon size={18} />
              {c.label}
            </button>
          );
        })}
      </div>

      <label className="field">
        <span>項目（選填）</span>
        <input className="input" value={e.title} onChange={(ev) => set({ title: ev.target.value })} placeholder={`例如：一蘭拉麵 / Suica 加值 / ${CATEGORY[e.category].label}`} />
      </label>

      <div className="grid-2">
        <label className="field">
          <span>日期</span>
          <input className="input" type="date" value={e.date} onChange={(ev) => ev.target.value && set({ date: ev.target.value })} />
        </label>
        <label className="field">
          <span>付款方式</span>
          <select className="select" value={e.method ?? ''} onChange={(ev) => set({ method: (ev.target.value || null) as Expense['method'] })}>
            <option value="">—</option>
            {METHODS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {members.length > 1 && (
        <>
          <div className="field">
            <span>誰付的</span>
            <div className="seg" role="group" aria-label="付款人">
              {members.map((m) => (
                <button key={m.id} aria-pressed={e.paidBy === m.id} onClick={() => set({ paidBy: m.id })}>
                  {m.name}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span>怎麼分</span>
            <div className="seg" role="group" aria-label="分攤">
              <button aria-pressed={e.split === 'even'} onClick={() => set({ split: 'even' })}>
                大家平分
              </button>
              <button aria-pressed={e.split === 'solo'} onClick={() => set({ split: 'solo' })}>
                付款人自己的
              </button>
            </div>
          </div>
        </>
      )}

      <div className="row">
        {!isNew && (
          <button
            className="btn danger"
            onClick={() => {
              void deleteExpense(e.id);
              onClose();
            }}
          >
            <Trash2 size={16} /> 刪除
          </button>
        )}
        <div className="spacer" />
        <button className="btn primary" disabled={!valid} onClick={() => void save()}>
          儲存
        </button>
      </div>
    </Sheet>
  );
}
