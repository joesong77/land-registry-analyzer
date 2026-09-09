'use client';

import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EditableCell } from '@/components/registry/editable-cell';
import { ConfidenceBadge, RiskBadges } from '@/components/registry/risk-badge';
import { formatMoney, formatNumber } from '@/lib/registry/normalize.js';

const ownershipLabels = {
  SINGLE: '單獨所有',
  SEPARATE_COOWNERSHIP: '分別共有',
  JOINT_OWNERSHIP: '公同共有',
  UNKNOWN: '待確認',
};

function TableEmpty({
  title = '沒有符合的資料',
  description = '請調整搜尋或篩選條件。',
}) {
  return (
    <Empty className="min-h-64 border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileSearch aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function sourceLabel(record) {
  const pages =
    record.sourcePages ?? (record.sourcePage ? [record.sourcePage] : []);
  return pages.length ? `P. ${pages.join(', ')}` : '—';
}

export function LandGroupTable({ lands, owners, onUpdateLand, onUpdateOwner }) {
  if (!lands.length) return <TableEmpty />;

  return (
    <Table
      className="min-w-[1180px]"
      containerClassName="max-h-[66vh] overflow-auto"
    >
      <TableHeader className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur">
        <TableRow>
          <TableHead className="sticky left-0 z-20 w-28 bg-slate-50">
            地號
          </TableHead>
          <TableHead className="w-28">土地面積</TableHead>
          <TableHead className="w-32">地上建號</TableHead>
          <TableHead className="w-32">所有權人</TableHead>
          <TableHead className="min-w-64">所有權人地址</TableHead>
          <TableHead className="w-28">持分</TableHead>
          <TableHead className="w-28">持有面積</TableHead>
          <TableHead className="w-44">風險</TableHead>
          <TableHead className="w-24">來源</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lands.map((land, landIndex) => {
          const landOwners = owners.filter(
            (owner) => owner.parcelId === land.id,
          );
          const displayOwners = landOwners.length ? landOwners : [null];
          const groupTone =
            landIndex % 2 ? 'bg-emerald-50/35' : 'bg-orange-50/35';

          return displayOwners.map((owner, ownerIndex) => {
            const joint = owner?.ownershipType === 'JOINT_OWNERSHIP';
            const areaSqm = joint
              ? owner?.calculatedOwnershipAreaSqm
              : owner?.ownershipAreaSqm;
            const areaPing = joint
              ? owner?.calculatedOwnershipAreaPing
              : owner?.ownershipAreaPing;
            const shareDisplay = joint
              ? owner?.calculatedShareNumerator &&
                owner?.calculatedShareDenominator
                ? `試算 ${owner.calculatedShareNumerator}/${owner.calculatedShareDenominator}`
                : '公同共有'
              : owner?.shareNumerator && owner?.shareDenominator
                ? `${owner.shareNumerator}/${owner.shareDenominator}`
                : owner?.shareText || '—';

            return (
              <TableRow
                key={owner?.id ?? `${land.id}-empty`}
                className={`${groupTone} hover:bg-primary/5`}
              >
                {ownerIndex === 0 && (
                  <TableCell
                    rowSpan={displayOwners.length}
                    className={`sticky left-0 z-10 border-r align-top ${groupTone}`}
                  >
                    <EditableCell
                      value={land.parcelNo}
                      onSave={(value) =>
                        onUpdateLand(land.id, 'parcelNo', value)
                      }
                      label={`${land.parcelNo}，地號`}
                      isEdited={
                        land.isManuallyEdited &&
                        'parcelNo' in land.originalValue
                      }
                      originalValue={land.originalValue?.parcelNo}
                    />
                    <p className="mt-1 px-1.5 text-[11px] text-muted-foreground">
                      {land.district} · {land.section}
                    </p>
                  </TableCell>
                )}
                {ownerIndex === 0 && (
                  <TableCell
                    rowSpan={displayOwners.length}
                    className="border-r align-top"
                  >
                    <EditableCell
                      value={land.areaSqm}
                      displayValue={`${formatNumber(land.areaSqm)} ㎡`}
                      type="number"
                      onSave={(value) =>
                        onUpdateLand(land.id, 'areaSqm', value)
                      }
                      label={`${land.parcelNo}，土地面積`}
                      isEdited={
                        land.isManuallyEdited && 'areaSqm' in land.originalValue
                      }
                      originalValue={land.originalValue?.areaSqm}
                    />
                    <p className="px-1.5 text-xs text-muted-foreground">
                      {formatNumber(land.areaPing)} 坪
                    </p>
                  </TableCell>
                )}
                {ownerIndex === 0 && (
                  <TableCell
                    rowSpan={displayOwners.length}
                    className="border-r align-top whitespace-normal"
                  >
                    {land.buildingNos.length
                      ? land.buildingNos.join('\n')
                      : '—'}
                  </TableCell>
                )}
                <TableCell className="align-top">
                  {owner ? (
                    <>
                      <EditableCell
                        value={owner.ownerName}
                        onSave={(value) =>
                          onUpdateOwner(owner.id, 'ownerName', value)
                        }
                        label={`${land.parcelNo}，所有權人`}
                        isEdited={
                          owner.isManuallyEdited &&
                          'ownerName' in owner.originalValue
                        }
                        originalValue={owner.originalValue?.ownerName}
                      />
                      <p className="px-1.5 text-[11px] text-muted-foreground">
                        {owner.ownerId || '無統編'}
                      </p>
                    </>
                  ) : (
                    '未辨識'
                  )}
                </TableCell>
                <TableCell className="max-w-80 align-top whitespace-normal">
                  {owner ? (
                    <EditableCell
                      value={owner.address}
                      displayValue={owner.address || '謄本未載（點擊補登）'}
                      onSave={(value) =>
                        onUpdateOwner(owner.id, 'address', value)
                      }
                      label={`${land.parcelNo}，${owner.ownerName}地址`}
                      isEdited={
                        owner.isManuallyEdited &&
                        'address' in owner.originalValue
                      }
                      originalValue={owner.originalValue?.address}
                    />
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell className="align-top">
                  {owner ? (
                    <>
                      <EditableCell
                        value={owner.shareText}
                        displayValue={shareDisplay}
                        onSave={(value) =>
                          onUpdateOwner(owner.id, 'shareText', value)
                        }
                        label={`${land.parcelNo}，${owner.ownerName}持分`}
                        isEdited={
                          owner.isManuallyEdited &&
                          'shareText' in owner.originalValue
                        }
                        originalValue={owner.originalValue?.shareText}
                      />
                      <p className="px-1.5 text-[11px] text-muted-foreground">
                        {ownershipLabels[owner.ownershipType]}
                      </p>
                    </>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell className="align-top tabular-nums">
                  <p>{formatNumber(areaSqm)} ㎡</p>
                  <p className="text-xs text-muted-foreground">
                    {formatNumber(areaPing)} 坪
                  </p>
                </TableCell>
                {ownerIndex === 0 && (
                  <TableCell
                    rowSpan={displayOwners.length}
                    className="border-l align-top whitespace-normal"
                  >
                    <RiskBadges land={land} />
                    <div className="mt-1">
                      <ConfidenceBadge value={land.parseConfidence} />
                    </div>
                  </TableCell>
                )}
                {ownerIndex === 0 && (
                  <TableCell
                    rowSpan={displayOwners.length}
                    className="align-top text-xs text-muted-foreground"
                  >
                    <p>{sourceLabel(land)}</p>
                    <p
                      className="mt-1 max-w-28 truncate"
                      title={land.sourceFileName}
                    >
                      {land.sourceFileName}
                    </p>
                  </TableCell>
                )}
              </TableRow>
            );
          });
        })}
      </TableBody>
    </Table>
  );
}

export function OwnerTable({ owners, lands, onUpdateOwner }) {
  if (!owners.length) return <TableEmpty />;
  const landById = new Map(lands.map((land) => [land.id, land]));
  return (
    <Table
      className="min-w-[1320px]"
      containerClassName="max-h-[66vh] overflow-auto"
    >
      <TableHeader className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur">
        <TableRow>
          <TableHead className="sticky left-0 z-20 bg-slate-50">地號</TableHead>
          <TableHead>次序</TableHead>
          <TableHead>所有權人</TableHead>
          <TableHead>統一編號</TableHead>
          <TableHead className="min-w-72">所有權人地址</TableHead>
          <TableHead>權利範圍</TableHead>
          <TableHead>持有面積㎡</TableHead>
          <TableHead>登記日期</TableHead>
          <TableHead>登記原因</TableHead>
          <TableHead>權狀字號</TableHead>
          <TableHead>相關他項</TableHead>
          <TableHead>來源</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {owners.map((owner) => {
          const land = landById.get(owner.parcelId);
          const area =
            owner.ownershipType === 'JOINT_OWNERSHIP'
              ? owner.calculatedOwnershipAreaSqm
              : owner.ownershipAreaSqm;
          return (
            <TableRow key={owner.id}>
              <TableCell className="sticky left-0 bg-white font-semibold">
                {owner.parcelNo}
              </TableCell>
              <TableCell>{owner.registrationSequence}</TableCell>
              <TableCell>
                <EditableCell
                  value={owner.ownerName}
                  onSave={(value) =>
                    onUpdateOwner(owner.id, 'ownerName', value)
                  }
                  label={`${owner.parcelNo}所有權人`}
                />
              </TableCell>
              <TableCell>{owner.ownerId || '—'}</TableCell>
              <TableCell className="max-w-96 whitespace-normal">
                <EditableCell
                  value={owner.address}
                  displayValue={owner.address || '謄本未載（點擊補登）'}
                  onSave={(value) => onUpdateOwner(owner.id, 'address', value)}
                  label={`${owner.parcelNo}${owner.ownerName}地址`}
                />
              </TableCell>
              <TableCell>
                <EditableCell
                  value={owner.shareText}
                  onSave={(value) =>
                    onUpdateOwner(owner.id, 'shareText', value)
                  }
                  label={`${owner.parcelNo}${owner.ownerName}持分`}
                />
              </TableCell>
              <TableCell className="tabular-nums">
                {formatNumber(area)}
              </TableCell>
              <TableCell>{owner.registrationDateROC || '—'}</TableCell>
              <TableCell>{owner.registrationReason || '—'}</TableCell>
              <TableCell>{owner.deedNo || '—'}</TableCell>
              <TableCell>
                {owner.relatedEncumbranceSequences.join(', ') || '—'}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {sourceLabel(owner)}
                <br />
                {land?.section}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export function AggregationTable({ owners }) {
  if (!owners.length) return <TableEmpty />;
  return (
    <Table
      className="min-w-[980px]"
      containerClassName="max-h-[66vh] overflow-auto"
    >
      <TableHeader className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur">
        <TableRow>
          <TableHead>所有權人</TableHead>
          <TableHead>統一編號</TableHead>
          <TableHead className="min-w-72">所有權人地址</TableHead>
          <TableHead>地號數</TableHead>
          <TableHead className="min-w-52">持有地號</TableHead>
          <TableHead>總持有㎡</TableHead>
          <TableHead>總持有坪</TableHead>
          <TableHead>產權狀態</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {owners.map((owner) => (
          <TableRow key={owner.ownerKey}>
            <TableCell className="font-semibold">
              {owner.ownerName || '未辨識'}
            </TableCell>
            <TableCell>{owner.ownerId || '—'}</TableCell>
            <TableCell className="whitespace-normal">
              {owner.address || '謄本未載'}
            </TableCell>
            <TableCell>{owner.parcelCount}</TableCell>
            <TableCell className="whitespace-normal">
              {owner.parcelNos.join('、')}
            </TableCell>
            <TableCell className="tabular-nums">
              {formatNumber(owner.ownershipAreaSqmTotal)}
            </TableCell>
            <TableCell className="tabular-nums">
              {formatNumber(owner.ownershipAreaPingTotal)}
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                {owner.hasMortgageRelated && (
                  <Badge
                    variant="outline"
                    className="border-amber-200 bg-amber-50 text-amber-800"
                  >
                    涉及抵押權
                  </Badge>
                )}
                {owner.hasRestriction && (
                  <Badge variant="destructive">有限制登記</Badge>
                )}
                {owner.possibleDuplicate && (
                  <Badge variant="outline">推定合併</Badge>
                )}
                {!owner.hasMortgageRelated &&
                  !owner.hasRestriction &&
                  !owner.possibleDuplicate && (
                    <Badge variant="outline" className="text-emerald-700">
                      正常
                    </Badge>
                  )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function EncumbranceTable({ records, onUpdate }) {
  if (!records.length)
    return (
      <TableEmpty
        title="沒有他項權利紀錄"
        description="目前解析結果未發現抵押權或其他他項權利。"
      />
    );
  return (
    <Table
      className="min-w-[1280px]"
      containerClassName="max-h-[66vh] overflow-auto"
    >
      <TableHeader className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur">
        <TableRow>
          <TableHead>地號</TableHead>
          <TableHead>登記次序</TableHead>
          <TableHead>權利種類</TableHead>
          <TableHead>權利人</TableHead>
          <TableHead>擔保總金額</TableHead>
          <TableHead>設定範圍</TableHead>
          <TableHead>標的次序</TableHead>
          <TableHead>共同擔保地號</TableHead>
          <TableHead>共同擔保建號</TableHead>
          <TableHead>來源</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((record) => (
          <TableRow key={record.id}>
            <TableCell className="font-semibold">{record.parcelNo}</TableCell>
            <TableCell>{record.registrationSequence}</TableCell>
            <TableCell>
              <Badge
                variant="outline"
                className="border-amber-200 bg-amber-50 text-amber-800"
              >
                {record.rightType || '未識別'}
              </Badge>
            </TableCell>
            <TableCell>{record.rightHolder || '—'}</TableCell>
            <TableCell>
              <EditableCell
                value={record.securedAmount}
                displayValue={formatMoney(record.securedAmount)}
                type="number"
                onSave={(value) => onUpdate(record.id, 'securedAmount', value)}
                label={`${record.parcelNo}${record.rightType}擔保金額`}
              />
            </TableCell>
            <TableCell>{record.rightShareText || '—'}</TableCell>
            <TableCell>
              {record.targetRegistrationSequences.join(', ') || '—'}
            </TableCell>
            <TableCell className="whitespace-normal">
              {record.jointCollateralParcelNos.join('、') || '—'}
            </TableCell>
            <TableCell className="whitespace-normal">
              {record.jointCollateralBuildingNos.join('、') || '—'}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {sourceLabel(record)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function ValidationTable({ issues, onConfirm }) {
  if (!issues.length) {
    return (
      <Empty className="min-h-64 border-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ClipboardCheck aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>所有檢核皆已通過</EmptyTitle>
          <EmptyDescription>目前沒有需要人工確認的解析問題。</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <Table
      className="min-w-[1100px]"
      containerClassName="max-h-[66vh] overflow-auto"
    >
      <TableHeader className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur">
        <TableRow>
          <TableHead>狀態</TableHead>
          <TableHead>地號</TableHead>
          <TableHead>資料類型</TableHead>
          <TableHead>欄位</TableHead>
          <TableHead className="min-w-72">問題</TableHead>
          <TableHead>來源</TableHead>
          <TableHead className="w-28">處理</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {issues.map((issue) => (
          <TableRow
            key={issue.id}
            className={issue.confirmed ? 'opacity-60' : ''}
          >
            <TableCell>
              <Badge
                variant={
                  issue.severity === 'high' || issue.severity === 'error'
                    ? 'destructive'
                    : 'outline'
                }
                className={
                  issue.severity === 'warning'
                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                    : ''
                }
              >
                {issue.confirmed ? (
                  <CheckCircle2 aria-hidden="true" />
                ) : (
                  <AlertCircle aria-hidden="true" />
                )}
                {issue.confirmed
                  ? '已確認'
                  : issue.severity === 'high'
                    ? '高風險'
                    : issue.severity === 'error'
                      ? '錯誤'
                      : '待確認'}
              </Badge>
            </TableCell>
            <TableCell className="font-semibold">
              {issue.parcelNo || '—'}
            </TableCell>
            <TableCell>{issue.dataType}</TableCell>
            <TableCell>{issue.field}</TableCell>
            <TableCell className="whitespace-normal">{issue.message}</TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {sourceLabel(issue)}
              <br />
              {issue.sourceFileName}
            </TableCell>
            <TableCell>
              <Button
                variant="outline"
                size="sm"
                disabled={issue.confirmed}
                onClick={() => onConfirm(issue.id)}
              >
                <CheckCircle2 aria-hidden="true" />
                確認
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
