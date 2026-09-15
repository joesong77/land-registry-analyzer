'use client';

import { useCallback, useMemo, useReducer, useState } from 'react';

import { usePdfParser } from '@/hooks/use-pdf-parser.js';
import { countUniqueBuildingOwners } from '@/lib/registry/building-aggregation.js';
import { exportBuildingRegistryWorkbook } from '@/lib/registry/building-excel.js';
import {
  normalizeBuildingNo,
  parseBuildingRegistryDocuments,
} from '@/lib/registry/building-parser.js';
import {
  normalizeNumber,
  parseShare,
  sqmToPing,
} from '@/lib/registry/normalize.js';
import { fillKnownOwnerAddresses } from '@/lib/registry/aggregation.js';

const initialState = { files: [], pages: [], buildings: [], owners: [] };

function updateOriginal(record, field, value) {
  const originalValue = { ...record.originalValue };
  if (!(field in originalValue)) originalValue[field] = record[field];
  return { ...record, [field]: value, originalValue, isManuallyEdited: true };
}

function recalculateBuilding(building, patch = {}) {
  const updated = { ...building, ...patch };
  updated.totalAreaSqm = [
    updated.mainBuildingAreaSqm,
    updated.attachedBuildingAreaSqm,
    updated.parkingAreaSqm,
    updated.publicAreaSqm,
  ].reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
  updated.totalAreaPing = sqmToPing(updated.totalAreaSqm);
  return updated;
}

function reducer(state, action) {
  switch (action.type) {
    case 'ADD_FILES':
      return { ...state, files: [...state.files, ...action.files] };
    case 'UPDATE_FILE':
      return {
        ...state,
        files: state.files.map((file) =>
          file.id === action.id ? { ...file, ...action.patch } : file,
        ),
      };
    case 'APPEND_PARSED': {
      const fileIds = new Set(action.fileIds);
      return {
        ...state,
        pages: [
          ...state.pages.filter((page) => !fileIds.has(page.sourceFileId)),
          ...action.pages,
        ],
        buildings: [
          ...state.buildings.filter(
            (building) => !fileIds.has(building.sourceFileId),
          ),
          ...action.buildings,
        ],
        owners: [
          ...state.owners.filter((owner) => !fileIds.has(owner.sourceFileId)),
          ...action.owners,
        ],
      };
    }
    case 'REMOVE_FILE':
      return {
        ...state,
        files: state.files.filter((file) => file.id !== action.id),
        pages: state.pages.filter((page) => page.sourceFileId !== action.id),
        buildings: state.buildings.filter(
          (building) => building.sourceFileId !== action.id,
        ),
        owners: state.owners.filter(
          (owner) => owner.sourceFileId !== action.id,
        ),
      };
    case 'UPDATE_BUILDING': {
      const numericFields = new Set([
        'mainBuildingAreaSqm',
        'attachedBuildingAreaSqm',
        'parkingAreaSqm',
        'publicAreaSqm',
      ]);
      const value = numericFields.has(action.field)
        ? normalizeNumber(action.value)
        : action.field === 'buildingNo'
          ? normalizeBuildingNo(action.value)
          : action.value;
      let changedBuilding;
      const buildings = state.buildings.map((building) => {
        if (building.id !== action.id) return building;
        const changed = updateOriginal(building, action.field, value);
        changedBuilding = numericFields.has(action.field)
          ? recalculateBuilding(changed)
          : changed;
        return changedBuilding;
      });
      if (!changedBuilding) return state;
      const owners = state.owners.map((owner) => {
        if (owner.buildingId !== action.id) return owner;
        const heldAreaSqm = Number.isFinite(owner.shareDecimal)
          ? changedBuilding.totalAreaSqm * owner.shareDecimal
          : null;
        return {
          ...owner,
          buildingNo: changedBuilding.buildingNo,
          heldAreaSqm,
          heldAreaPing: sqmToPing(heldAreaSqm),
        };
      });
      return { ...state, buildings, owners };
    }
    case 'UPDATE_OWNER':
      return {
        ...state,
        owners: state.owners.map((owner) => {
          if (owner.id !== action.id) return owner;
          let updated = updateOriginal(owner, action.field, action.value);
          if (action.field === 'shareText') {
            const share = parseShare(action.value);
            updated = { ...updated, legalShareText: action.value, ...share };
          }
          const building = state.buildings.find(
            (candidate) => candidate.id === owner.buildingId,
          );
          const heldAreaSqm =
            Number.isFinite(building?.totalAreaSqm) &&
            Number.isFinite(updated.shareDecimal)
              ? building.totalAreaSqm * updated.shareDecimal
              : null;
          return {
            ...updated,
            heldAreaSqm,
            heldAreaPing: sqmToPing(heldAreaSqm),
          };
        }),
      };
    case 'CLEAR_ALL':
      return initialState;
    default:
      return state;
  }
}

export function useBuildingRegistryWorkbench() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [exportStatus, setExportStatus] = useState('idle');
  const [exportMessage, setExportMessage] = useState('');
  const { parseFiles, isParsing } = usePdfParser();
  const owners = useMemo(
    () => fillKnownOwnerAddresses(state.owners),
    [state.owners],
  );

  const summary = useMemo(() => {
    const totalAreaSqm = state.buildings.reduce(
      (sum, building) => sum + (building.totalAreaSqm ?? 0),
      0,
    );
    return {
      buildingCount: state.buildings.length,
      ownerCount: owners.length,
      uniqueOwnerCount: countUniqueBuildingOwners(owners),
      totalAreaSqm,
      totalAreaPing: sqmToPing(totalAreaSqm) ?? 0,
      riskCount: state.buildings.filter(
        (building) => building.hasMortgage || building.hasRestriction,
      ).length,
      warningCount: state.buildings.reduce(
        (sum, building) => sum + building.parseWarnings.length,
        0,
      ),
    };
  }, [state.buildings, owners]);

  const addFiles = useCallback(
    async (incoming) => {
      const known = new Set(
        state.files.map((file) => `${file.name}:${file.size}`),
      );
      const entries = Array.from(incoming)
        .filter(
          (file) =>
            (file.type === 'application/pdf' ||
              file.name.toLowerCase().endsWith('.pdf')) &&
            !known.has(`${file.name}:${file.size}`),
        )
        .map((file) => ({
          id:
            globalThis.crypto?.randomUUID?.() ??
            `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          file,
          name: file.name,
          size: file.size,
          pageCount: null,
          currentPage: 0,
          progress: 0,
          status: 'queued',
          recognizedRecords: 0,
          warningCount: 0,
          error: '',
        }));
      if (!entries.length) return;
      dispatch({ type: 'ADD_FILES', files: entries });
      const extracted = await parseFiles(entries, (id, patch) =>
        dispatch({ type: 'UPDATE_FILE', id, patch }),
      );
      const parsed = parseBuildingRegistryDocuments(extracted.pages);
      dispatch({
        type: 'APPEND_PARSED',
        fileIds: entries.map((entry) => entry.id),
        pages: extracted.pages,
        ...parsed,
      });
      for (const result of extracted.results) {
        const fileBuildings = parsed.buildings.filter(
          (building) => building.sourceFileId === result.id,
        );
        const warningCount = fileBuildings.reduce(
          (sum, building) => sum + building.parseWarnings.length,
          0,
        );
        const noBuildings =
          result.status === 'complete' && !fileBuildings.length;
        dispatch({
          type: 'UPDATE_FILE',
          id: result.id,
          patch: {
            ...result,
            status: noBuildings || warningCount ? 'warning' : result.status,
            error: noBuildings
              ? '未辨識到建物謄本，請確認功能選項與 PDF 類型'
              : result.error,
            recognizedRecords: fileBuildings.length,
            warningCount,
          },
        });
      }
    },
    [parseFiles, state.files],
  );

  const exportWorkbook = useCallback(
    async (displayBuildings) => {
      const buildings = displayBuildings ?? state.buildings;
      if (!buildings.length || isParsing) return null;
      setExportStatus('exporting');
      setExportMessage('');
      try {
        const fileName = await exportBuildingRegistryWorkbook({
          buildings,
          owners,
        });
        setExportStatus('success');
        setExportMessage(`已匯出 ${fileName}`);
        return fileName;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Excel 匯出失敗';
        setExportStatus('error');
        setExportMessage(message);
        throw error;
      }
    },
    [state.buildings, owners, isParsing],
  );

  return {
    ...state,
    owners,
    summary,
    isParsing,
    exportStatus,
    exportMessage,
    addFiles,
    exportWorkbook,
    removeFile: (id) => dispatch({ type: 'REMOVE_FILE', id }),
    clearAll: () => dispatch({ type: 'CLEAR_ALL' }),
    updateBuilding: (id, field, value) =>
      dispatch({ type: 'UPDATE_BUILDING', id, field, value }),
    updateOwner: (id, field, value) =>
      dispatch({ type: 'UPDATE_OWNER', id, field, value }),
  };
}
