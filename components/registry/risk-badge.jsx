import { AlertTriangle, CheckCircle2, Landmark } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

export function RiskBadges({ land }) {
  const badges = [];
  if (land.hasMortgage) {
    badges.push(
      <Badge
        key="mortgage"
        variant="outline"
        className="border-amber-200 bg-amber-50 text-amber-800"
      >
        <Landmark aria-hidden="true" />
        抵押權
      </Badge>,
    );
  }
  const restrictions = [
    ...new Set(
      land.flags
        .filter((flag) => flag.type === 'RESTRICTION')
        .map((flag) => flag.subtype),
    ),
  ];
  restrictions.forEach((label) => {
    badges.push(
      <Badge key={label} variant="destructive">
        <AlertTriangle aria-hidden="true" />
        {label}
      </Badge>,
    );
  });

  return badges.length ? (
    <div className="flex flex-wrap gap-1">{badges}</div>
  ) : (
    <Badge
      variant="outline"
      className="border-emerald-200 bg-emerald-50 text-emerald-700"
    >
      <CheckCircle2 aria-hidden="true" />
      正常
    </Badge>
  );
}

export function ConfidenceBadge({ value }) {
  if (value >= 0.8) return null;
  return (
    <Badge
      variant="outline"
      className="border-yellow-200 bg-yellow-50 text-yellow-800"
    >
      <AlertTriangle aria-hidden="true" />
      待人工確認
    </Badge>
  );
}
