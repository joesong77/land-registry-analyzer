import { AlertOctagon, LandPlot, Ruler, UsersRound } from 'lucide-react';

import { formatNumber } from '@/lib/registry/normalize.js';

export function SummaryCards({ summary }) {
  const cards = [
    {
      label: '土地筆數',
      value: summary.landCount,
      meta: '筆地號',
      icon: LandPlot,
      tone: 'text-sky-700 bg-sky-50',
    },
    {
      label: '所有權紀錄',
      value: summary.ownerCount,
      meta: `${summary.uniqueOwnerCount} 位推定地主`,
      icon: UsersRound,
      tone: 'text-teal-700 bg-teal-50',
    },
    {
      label: '權利／限制異常',
      value: summary.riskCount,
      meta: summary.highRiskCount
        ? `${summary.highRiskCount} 筆高風險`
        : '目前無高風險',
      icon: AlertOctagon,
      tone: 'text-amber-800 bg-amber-50',
    },
    {
      label: '總土地面積',
      value: formatNumber(summary.totalAreaSqm),
      meta: `${formatNumber(summary.totalAreaPing)} 坪`,
      icon: Ruler,
      tone: 'text-indigo-700 bg-indigo-50',
    },
  ];

  return (
    <section
      aria-label="解析摘要"
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <article
            key={card.label}
            className="rounded-xl border bg-white/92 p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {card.label}
                </p>
                <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums">
                  {card.value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {card.meta}
                </p>
              </div>
              <div
                className={`grid size-9 place-items-center rounded-lg ${card.tone}`}
              >
                <Icon aria-hidden="true" className="size-4" />
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}
