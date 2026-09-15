'use client';

import { FileSearch } from 'lucide-react';

import { EditableCell } from '@/components/registry/editable-cell';
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
import { formatNumber } from '@/lib/registry/normalize.js';

function NumberCell({ value }) {
  return (
    <span className="tabular-nums">
      {Number.isFinite(value) ? formatNumber(value) : ''}
    </span>
  );
}

const centeredEditorClass =
  'justify-center text-center [&_button]:justify-center [&_button]:text-center [&_input]:text-center';

export function BuildingRegistryTable({
  buildings,
  owners,
  onUpdateBuilding,
  onUpdateOwner,
}) {
  if (!buildings.length) {
    return (
      <Empty className="min-h-64 border-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileSearch aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>沒有符合的建物資料</EmptyTitle>
          <EmptyDescription>
            請調整搜尋條件，或上傳建物謄本 PDF。
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Table
      className="min-w-[2300px] text-center [&_td]:text-center [&_th]:text-center"
      containerClassName="max-h-[68vh] overflow-auto"
    >
      <TableHeader className="sticky top-0 z-30 bg-[#fffec8]">
        <TableRow>
          {[
            '地號',
            '建號',
            '門牌',
            '層次',
            '層數',
            '主要建材',
            '坐落地號',
            '建築完成日',
            '主建物(㎡)',
            '附屬建物(㎡)',
            '停車場(㎡)',
            '公設(㎡)',
            '建物總面積(㎡)',
            '建物總面積(坪)',
            '所有權人',
            '建物持分',
            '持有面積(㎡)',
            '持有面積(坪)',
            '來源',
          ].map((header, index) => (
            <TableHead
              key={header}
              className={`${index === 0 ? 'sticky left-0 z-40' : ''} bg-[#fffec8] text-center text-slate-800`}
            >
              {header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {buildings.flatMap((building, buildingIndex) => {
          const sourceBuildingId = building.sourceBuildingId || building.id;
          const buildingOwners = owners.filter(
            (owner) => owner.buildingId === sourceBuildingId,
          );
          const displayOwners = buildingOwners.length ? buildingOwners : [null];
          const tone =
            buildingIndex % 2 ? 'bg-emerald-50/65' : 'bg-orange-50/65';
          return displayOwners.map((owner, ownerIndex) => (
            <TableRow
              key={`${building.rowId ?? building.id}-${owner?.id ?? 'empty'}`}
              data-building-row={building.rowId ?? building.id}
              className={`${tone} hover:bg-primary/5`}
            >
              {ownerIndex === 0 && (
                <TableCell
                  rowSpan={displayOwners.length}
                  className={`sticky left-0 z-10 border-r text-center font-semibold ${tone}`}
                >
                  {building.displayParcelNo ?? building.parcelNos.join('、')}
                </TableCell>
              )}
              {ownerIndex === 0 && (
                <TableCell
                  rowSpan={displayOwners.length}
                  className="border-r text-center align-top"
                >
                  {building.isPlaceholder ? (
                    building.buildingNo
                  ) : (
                    <EditableCell
                      value={building.buildingNo}
                      onSave={(value) =>
                        onUpdateBuilding(sourceBuildingId, 'buildingNo', value)
                      }
                      label={`${building.buildingNo}，建號`}
                      className={centeredEditorClass}
                    />
                  )}
                </TableCell>
              )}
              {ownerIndex === 0 && (
                <TableCell
                  rowSpan={displayOwners.length}
                  className="min-w-60 border-r whitespace-normal align-top"
                >
                  {building.isPlaceholder ? (
                    ''
                  ) : (
                    <EditableCell
                      value={building.address}
                      onSave={(value) =>
                        onUpdateBuilding(sourceBuildingId, 'address', value)
                      }
                      label={`${building.buildingNo}，門牌`}
                      className={centeredEditorClass}
                    />
                  )}
                </TableCell>
              )}
              {ownerIndex === 0 && (
                <TableCell
                  rowSpan={displayOwners.length}
                  className="border-r text-center"
                >
                  {building.levels}
                </TableCell>
              )}
              {ownerIndex === 0 && (
                <TableCell
                  rowSpan={displayOwners.length}
                  className="border-r text-center"
                >
                  {building.floorCount ? `${building.floorCount}層` : ''}
                </TableCell>
              )}
              {ownerIndex === 0 && (
                <TableCell
                  rowSpan={displayOwners.length}
                  className="min-w-44 border-r text-center whitespace-normal"
                >
                  {building.primaryMaterial}
                </TableCell>
              )}
              {ownerIndex === 0 && (
                <TableCell
                  rowSpan={displayOwners.length}
                  className="min-w-44 border-r whitespace-normal text-center"
                >
                  {building.parcelNos.join('、')}
                </TableCell>
              )}
              {ownerIndex === 0 && (
                <TableCell
                  rowSpan={displayOwners.length}
                  className="border-r text-center"
                >
                  {building.completionDateROC}
                </TableCell>
              )}
              {[
                ['mainBuildingAreaSqm', building.mainBuildingAreaSqm],
                ['attachedBuildingAreaSqm', building.attachedBuildingAreaSqm],
                ['parkingAreaSqm', building.parkingAreaSqm],
                ['publicAreaSqm', building.publicAreaSqm],
              ].map(([field, value]) =>
                ownerIndex === 0 ? (
                  <TableCell
                    key={field}
                    rowSpan={displayOwners.length}
                    className="border-r text-center align-top"
                  >
                    {building.isPlaceholder ? (
                      ''
                    ) : (
                      <EditableCell
                        value={value}
                        displayValue={formatNumber(value)}
                        type="number"
                        onSave={(nextValue) =>
                          onUpdateBuilding(sourceBuildingId, field, nextValue)
                        }
                        label={`${building.buildingNo}，${field}`}
                        className={centeredEditorClass}
                      />
                    )}
                  </TableCell>
                ) : null,
              )}
              {ownerIndex === 0 && (
                <TableCell
                  rowSpan={displayOwners.length}
                  className="border-r text-center"
                >
                  <NumberCell value={building.totalAreaSqm} />
                </TableCell>
              )}
              {ownerIndex === 0 && (
                <TableCell
                  rowSpan={displayOwners.length}
                  className="border-r text-center"
                >
                  <NumberCell value={building.totalAreaPing} />
                </TableCell>
              )}
              <TableCell className="min-w-36 text-center align-top">
                {owner ? (
                  <>
                    <EditableCell
                      value={owner.ownerName}
                      onSave={(value) =>
                        onUpdateOwner(owner.id, 'ownerName', value)
                      }
                      label={`${building.buildingNo}，所有權人`}
                      className={centeredEditorClass}
                    />
                    <p className="text-xs text-muted-foreground">
                      {owner.ownerId || '無統編'}
                    </p>
                  </>
                ) : (
                  ''
                )}
              </TableCell>
              <TableCell className="text-center align-top">
                {owner ? (
                  <EditableCell
                    value={owner.shareText}
                    displayValue={
                      Number.isFinite(owner.shareNumerator)
                        ? `${owner.shareNumerator} / ${owner.shareDenominator}`
                        : owner.shareText
                    }
                    onSave={(value) =>
                      onUpdateOwner(owner.id, 'shareText', value)
                    }
                    label={`${building.buildingNo}，建物持分`}
                    className={centeredEditorClass}
                  />
                ) : (
                  ''
                )}
              </TableCell>
              <TableCell className="text-center">
                <NumberCell value={owner?.heldAreaSqm} />
              </TableCell>
              <TableCell className="text-center">
                <NumberCell value={owner?.heldAreaPing} />
              </TableCell>
              {ownerIndex === 0 && (
                <TableCell
                  rowSpan={displayOwners.length}
                  className="max-w-36 whitespace-normal text-xs text-muted-foreground"
                >
                  {!building.isPlaceholder && (
                    <>
                      P. {building.sourcePages.join(', ')}
                      <br />
                      {building.sourceFileName}
                    </>
                  )}
                </TableCell>
              )}
            </TableRow>
          ));
        })}
      </TableBody>
    </Table>
  );
}
