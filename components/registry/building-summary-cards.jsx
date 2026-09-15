import { AlertOctagon, Building2, Ruler, UsersRound } from 'lucide-react';

import { formatNumber } from '@/lib/registry/normalize.js';

export function BuildingSummaryCards({ summary }) {
  const cards = [
    {
      label: '建物筆數',
      value: summary.buildingCount,
      meta: '筆建號',
      icon: Building2,
      tone: 'text-sky-700 bg-sky-50',
    },
    {
      label: '不重複所有權人',
      value: summary.uniqueOwnerCount,
      meta: `${summary.ownerCount} 筆所有權紀錄`,
      icon: UsersRound,
      tone: 'text-teal-700 bg-teal-50',
    },
    {
      label: '權利／限制提示',
      value: summary.riskCount,
      meta: summary.warningCount
        ? `${summary.warningCount} 筆解析待確認`
        : '解析欄位完整',
      icon: AlertOctagon,
      tone: 'text-amber-800 bg-amber-50',
    },
    {
      label: '總建物面積',
      value: formatNumber(summary.totalAreaSqm),
      meta: `${formatNumber(summary.totalAreaPing)} 坪`,
      icon: Ruler,
      tone: 'text-indigo-700 bg-indigo-50',
    },
  ];

  return (
    <section
      aria-label="建物解析摘要"
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
