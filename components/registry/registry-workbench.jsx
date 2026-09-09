'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  FileSpreadsheet,
  LandPlot,
  LockKeyhole,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileQueue } from '@/components/registry/file-queue';
import { PdfDropzone } from '@/components/registry/pdf-dropzone';
import {
  AggregationTable,
  EncumbranceTable,
  LandGroupTable,
  OwnerTable,
  ValidationTable,
} from '@/components/registry/registry-tables';
import { SummaryCards } from '@/components/registry/summary-cards';
import { useRegistryWebMcp } from '@/hooks/use-registry-webmcp.js';
import { useRegistryWorkbench } from '@/hooks/use-registry-workbench.js';

function includesQuery(values, query) {
  if (!query) return true;
  const haystack = values
    .flat(Infinity)
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export function RegistryWorkbench() {
  const registry = useRegistryWorkbench();
  const [activeTab, setActiveTab] = useState('land');
  const [query, setQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [clearOpen, setClearOpen] = useState(false);

  const changeTab = useCallback((value) => setActiveTab(value), []);
  const canExport = registry.lands.length > 0 && !registry.isParsing;

  useRegistryWebMcp({
    summary: registry.summary,
    setActiveTab: changeTab,
    exportWorkbook: registry.exportWorkbook,
    canExport,
  });

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const panel = document.querySelector(
        `[data-registry-panel="${activeTab}"]`,
      );
      const scroller = panel?.querySelector('[data-slot="table-container"]');
      if (scroller) scroller.scrollTop = 0;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeTab]);

  const filteredLands = useMemo(
    () =>
      registry.lands.filter((land) => {
        const landOwners = registry.owners.filter(
          (owner) => owner.parcelId === land.id,
        );
        const matchesSearch = includesQuery(
          [
            land.parcelNo,
            land.parcelNoRaw,
            land.district,
            land.section,
            land.buildingNos,
            landOwners.map((owner) => [
              owner.ownerName,
              owner.ownerId,
              owner.address,
            ]),
          ],
          query,
        );
        const matchesRisk =
          riskFilter === 'all' ||
          (riskFilter === 'mortgage' && land.hasMortgage) ||
          (riskFilter === 'restriction' && land.hasRestriction) ||
          (riskFilter === 'building' && land.buildingNos.length > 0) ||
          (riskFilter === 'review' && land.parseConfidence < 0.8);
        return matchesSearch && matchesRisk;
      }),
    [registry.lands, registry.owners, query, riskFilter],
  );

  const visibleLandIds = useMemo(
    () => new Set(filteredLands.map((land) => land.id)),
    [filteredLands],
  );
  const filteredOwners = useMemo(
    () =>
      registry.owners.filter(
        (owner) =>
          visibleLandIds.has(owner.parcelId) &&
          includesQuery(
            [owner.parcelNo, owner.ownerName, owner.ownerId, owner.address],
            query,
          ),
      ),
    [registry.owners, visibleLandIds, query],
  );
  const filteredAggregates = useMemo(
    () =>
      registry.aggregatedOwners.filter((owner) =>
        includesQuery(
          [owner.ownerName, owner.ownerId, owner.address, owner.parcelNos],
          query,
        ),
      ),
    [registry.aggregatedOwners, query],
  );
  const filteredEncumbrances = useMemo(
    () =>
      registry.encumbrances.filter(
        (record) =>
          visibleLandIds.has(record.parcelId) &&
          includesQuery(
            [
              record.parcelNo,
              record.rightType,
              record.rightHolder,
              record.registrationSequence,
            ],
            query,
          ),
      ),
    [registry.encumbrances, visibleLandIds, query],
  );
  const filteredValidations = useMemo(
    () =>
      registry.validations.filter((issue) =>
        includesQuery(
          [
            issue.parcelNo,
            issue.dataType,
            issue.field,
            issue.message,
            issue.sourceFileName,
          ],
          query,
        ),
      ),
    [registry.validations, query],
  );

  const resultCount = {
    land: filteredLands.length,
    aggregate: filteredAggregates.length,
    owners: filteredOwners.length,
    encumbrances: filteredEncumbrances.length,
    validation: filteredValidations.length,
  }[activeTab];

  const openValidation = () => {
    setActiveTab('validation');
    window.setTimeout(
      () =>
        document
          .getElementById('registry-workbench')
          ?.scrollIntoView({ behavior: 'smooth' }),
      0,
    );
  };

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-white/92 backdrop-blur-xl">
        <div className="mx-auto flex min-h-18 max-w-[1540px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <LandPlot aria-hidden="true" className="size-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold tracking-tight sm:text-xl">
                土地謄本清冊
              </h1>
              <p className="hidden text-xs font-medium tracking-[0.08em] text-muted-foreground sm:block">
                LAND REGISTRY PARSER
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="hidden h-7 border-emerald-200 bg-emerald-50 px-2.5 text-emerald-800 lg:inline-flex"
            >
              <LockKeyhole aria-hidden="true" />
              PDF 僅在本機處理
            </Badge>
            {registry.files.length > 0 && (
              <PdfDropzone
                onFilesSelected={registry.addFiles}
                disabled={registry.isParsing}
                compact
              />
            )}
            {registry.files.length > 0 && (
              <Button variant="ghost" onClick={() => setClearOpen(true)}>
                <Trash2 aria-hidden="true" />
                <span className="hidden md:inline">清除資料</span>
              </Button>
            )}
            <Button
              disabled={!canExport || registry.exportStatus === 'exporting'}
              onClick={registry.exportWorkbook}
            >
              <FileSpreadsheet aria-hidden="true" />
              {registry.exportStatus === 'exporting' ? '匯出中…' : '匯出 Excel'}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1540px] space-y-5 px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
        {registry.files.length === 0 ? (
          <section
            aria-labelledby="intake-title"
            className="mx-auto max-w-5xl pt-2 lg:pt-4"
          >
            <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="mb-1 font-mono text-xs font-semibold tracking-[0.14em] text-primary">
                  STEP 01 · 匯入謄本
                </p>
                <h2
                  id="intake-title"
                  className="text-2xl font-bold tracking-tight sm:text-3xl"
                >
                  將 PDF 整理成可用的地主清冊
                </h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-muted-foreground">
                支援單檔與多檔。系統會逐頁辨識地號、所有權人、持分、抵押權與限制登記。
              </p>
            </div>
            <PdfDropzone
              onFilesSelected={registry.addFiles}
              disabled={registry.isParsing}
            />
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                ['01', '辨識謄本', '逐頁保留原文與來源'],
                ['02', '人工檢核', '集中確認異常資料'],
                ['03', '匯出清冊', '產出六張工作表'],
              ].map(([step, title, description]) => (
                <div
                  key={step}
                  className="flex gap-3 rounded-lg border bg-white/70 px-4 py-3"
                >
                  <span className="font-mono text-xs font-bold text-primary">
                    {step}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <>
            <FileQueue files={registry.files} onRemove={registry.removeFile} />

            {registry.lands.length > 0 && (
              <SummaryCards summary={registry.summary} />
            )}

            {registry.summary.unresolvedCount > 0 && (
              <Alert className="border-amber-200 bg-amber-50/90 text-amber-950">
                <AlertTriangle aria-hidden="true" />
                <AlertTitle>
                  尚有 {registry.summary.unresolvedCount} 筆需要確認
                </AlertTitle>
                <AlertDescription>
                  資料仍可匯出；建議先核對高風險與解析警告。
                </AlertDescription>
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute right-2 top-2 border-amber-300 bg-white"
                  onClick={openValidation}
                >
                  查看檢核
                </Button>
              </Alert>
            )}

            {registry.exportMessage && (
              <Alert
                variant={
                  registry.exportStatus === 'error' ? 'destructive' : 'default'
                }
              >
                <ShieldCheck aria-hidden="true" />
                <AlertTitle>
                  {registry.exportStatus === 'error'
                    ? '匯出失敗'
                    : 'Excel 已完成'}
                </AlertTitle>
                <AlertDescription>{registry.exportMessage}</AlertDescription>
              </Alert>
            )}

            {registry.lands.length > 0 && (
              <section
                id="registry-workbench"
                aria-label="謄本資料工作台"
                className="overflow-hidden rounded-xl border bg-white/94 shadow-sm"
              >
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <div className="sticky top-[73px] z-30 border-b bg-white/96 px-3 pt-3 backdrop-blur sm:px-4">
                    <div className="overflow-x-auto pb-1">
                      <TabsList variant="line" className="min-w-max">
                        <TabsTrigger value="land">
                          土地總表{' '}
                          <Badge variant="secondary">
                            {registry.lands.length}
                          </Badge>
                        </TabsTrigger>
                        <TabsTrigger value="aggregate">
                          地主整合{' '}
                          <Badge variant="secondary">
                            {registry.aggregatedOwners.length}
                          </Badge>
                        </TabsTrigger>
                        <TabsTrigger value="owners">
                          所有權明細{' '}
                          <Badge variant="secondary">
                            {registry.owners.length}
                          </Badge>
                        </TabsTrigger>
                        <TabsTrigger value="encumbrances">
                          他項權利{' '}
                          <Badge variant="secondary">
                            {registry.encumbrances.length}
                          </Badge>
                        </TabsTrigger>
                        <TabsTrigger value="validation">
                          解析檢核{' '}
                          <Badge
                            variant={
                              registry.summary.unresolvedCount
                                ? 'destructive'
                                : 'secondary'
                            }
                          >
                            {registry.summary.unresolvedCount}
                          </Badge>
                        </TabsTrigger>
                      </TabsList>
                    </div>
                    <div className="flex flex-col gap-2 border-t py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                        <div className="relative max-w-lg flex-1">
                          <Search
                            aria-hidden="true"
                            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                          />
                          <Input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="搜尋地號、地主、統編、地址或建號"
                            aria-label="搜尋清冊"
                            className="h-10 pl-9"
                          />
                        </div>
                        <NativeSelect
                          value={riskFilter}
                          onChange={(event) =>
                            setRiskFilter(event.target.value)
                          }
                          aria-label="產權篩選"
                          className="w-full sm:w-48 [&_select]:h-10"
                        >
                          <NativeSelectOption value="all">
                            全部產權狀態
                          </NativeSelectOption>
                          <NativeSelectOption value="mortgage">
                            有抵押權
                          </NativeSelectOption>
                          <NativeSelectOption value="restriction">
                            有限制登記
                          </NativeSelectOption>
                          <NativeSelectOption value="building">
                            有地上建物
                          </NativeSelectOption>
                          <NativeSelectOption value="review">
                            解析待確認
                          </NativeSelectOption>
                        </NativeSelect>
                      </div>
                      <p className="shrink-0 text-xs font-medium text-muted-foreground">
                        顯示 {resultCount} 筆
                      </p>
                    </div>
                  </div>

                  <TabsContent
                    value="land"
                    data-registry-panel="land"
                    className="min-h-0"
                  >
                    <LandGroupTable
                      lands={filteredLands}
                      owners={registry.owners}
                      onUpdateLand={registry.updateLand}
                      onUpdateOwner={registry.updateOwner}
                    />
                  </TabsContent>
                  <TabsContent
                    value="aggregate"
                    data-registry-panel="aggregate"
                    className="min-h-0"
                  >
                    <AggregationTable owners={filteredAggregates} />
                  </TabsContent>
                  <TabsContent
                    value="owners"
                    data-registry-panel="owners"
                    className="min-h-0"
                  >
                    <OwnerTable
                      owners={filteredOwners}
                      lands={registry.lands}
                      onUpdateOwner={registry.updateOwner}
                    />
                  </TabsContent>
                  <TabsContent
                    value="encumbrances"
                    data-registry-panel="encumbrances"
                    className="min-h-0"
                  >
                    <EncumbranceTable
                      records={filteredEncumbrances}
                      onUpdate={registry.updateEncumbrance}
                    />
                  </TabsContent>
                  <TabsContent
                    value="validation"
                    data-registry-panel="validation"
                    className="min-h-0"
                  >
                    <ValidationTable
                      issues={filteredValidations}
                      onConfirm={registry.confirmIssue}
                    />
                  </TabsContent>
                </Tabs>
              </section>
            )}
          </>
        )}
      </div>

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Trash2 aria-hidden="true" />
            </AlertDialogMedia>
            <AlertDialogTitle>清除目前所有資料？</AlertDialogTitle>
            <AlertDialogDescription>
              將移除 {registry.files.length} 份 PDF、{registry.lands.length}{' '}
              筆土地資料與所有人工修改。此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                registry.clearAll();
                setClearOpen(false);
              }}
            >
              清除資料
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
