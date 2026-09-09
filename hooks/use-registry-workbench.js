'use client';

import { useCallback, useMemo, useReducer, useState } from 'react';

import { usePdfParser } from '@/hooks/use-pdf-parser.js';
import { aggregateOwners } from '@/lib/registry/aggregation.js';
import { exportRegistryWorkbook } from '@/lib/registry/excel.js';
import {
  normalizeNumber,
  normalizeParcelNo,
  parseShare,
  sqmToPing,
} from '@/lib/registry/normalize.js';
import { parseRegistryDocuments } from '@/lib/registry/parser.js';
import { validateLandRegistry } from '@/lib/registry/validation.js';

const initialState = {
  files: [],
  pages: [],
  lands: [],
  owners: [],
  encumbrances: [],
  confirmedIssueIds: [],
};

function updateOriginal(record, field, value) {
  const originalValue = { ...record.originalValue };
  if (!(field in originalValue)) originalValue[field] = record[field];
  return {
    ...record,
    [field]: value,
    isManuallyEdited: true,
    originalValue,
  };
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
        lands: [
          ...state.lands.filter((land) => !fileIds.has(land.sourceFileId)),
          ...action.lands,
        ],
        owners: [
          ...state.owners.filter((owner) => !fileIds.has(owner.sourceFileId)),
          ...action.owners,
        ],
        encumbrances: [
          ...state.encumbrances.filter(
            (record) => !fileIds.has(record.sourceFileId),
          ),
          ...action.encumbrances,
        ],
      };
    }
    case 'REMOVE_FILE':
      return {
        ...state,
        files: state.files.filter((file) => file.id !== action.id),
        pages: state.pages.filter((page) => page.sourceFileId !== action.id),
        lands: state.lands.filter((land) => land.sourceFileId !== action.id),
        owners: state.owners.filter(
          (owner) => owner.sourceFileId !== action.id,
        ),
        encumbrances: state.encumbrances.filter(
          (record) => record.sourceFileId !== action.id,
        ),
      };
    case 'UPDATE_LAND': {
      const current = state.lands.find((land) => land.id === action.id);
      if (!current) return state;
      let value = action.value;
      if (action.field === 'areaSqm') value = normalizeNumber(value);
      if (action.field === 'parcelNo') value = normalizeParcelNo(value);
      const updated = updateOriginal(current, action.field, value);
      if (action.field === 'areaSqm') updated.areaPing = sqmToPing(value);

      const owners = state.owners.map((owner) => {
        if (owner.parcelId !== action.id) return owner;
        const effectiveShare =
          owner.ownershipType === 'JOINT_OWNERSHIP'
            ? owner.calculatedShareDecimal
            : owner.shareDecimal;
        const area =
          Number.isFinite(value) && Number.isFinite(effectiveShare)
            ? value * effectiveShare
            : null;
        return {
          ...owner,
          ...(action.field === 'parcelNo' ? { parcelNo: value } : {}),
          ...(action.field === 'areaSqm' &&
          owner.ownershipType === 'JOINT_OWNERSHIP'
            ? {
                calculatedOwnershipAreaSqm: area,
                calculatedOwnershipAreaPing: sqmToPing(area),
              }
            : action.field === 'areaSqm'
              ? { ownershipAreaSqm: area, ownershipAreaPing: sqmToPing(area) }
              : {}),
        };
      });

      const encumbrances =
        action.field === 'parcelNo'
          ? state.encumbrances.map((record) =>
              record.parcelId === action.id
                ? { ...record, parcelNo: value }
                : record,
            )
          : state.encumbrances;

      return {
        ...state,
        lands: state.lands.map((land) =>
          land.id === action.id ? updated : land,
        ),
        owners,
        encumbrances,
      };
    }
    case 'UPDATE_OWNER': {
      const landById = new Map(state.lands.map((land) => [land.id, land]));
      return {
        ...state,
        owners: state.owners.map((owner) => {
          if (owner.id !== action.id) return owner;
          let updated = updateOriginal(owner, action.field, action.value);
          if (action.field === 'shareText') {
            const parsed = parseShare(action.value);
            updated = {
              ...updated,
              ...parsed,
              legalShareText: action.value,
              ownershipType: /公同共有/.test(action.value)
                ? 'JOINT_OWNERSHIP'
                : state.owners.filter(
                      (candidate) => candidate.parcelId === owner.parcelId,
                    ).length === 1 && parsed.shareDecimal === 1
                  ? 'SINGLE'
                  : 'SEPARATE_COOWNERSHIP',
            };
          }

          const land = landById.get(owner.parcelId);
          const share =
            updated.ownershipType === 'JOINT_OWNERSHIP'
              ? updated.calculatedShareDecimal
              : updated.shareDecimal;
          const area =
            Number.isFinite(land?.areaSqm) && Number.isFinite(share)
              ? land.areaSqm * share
              : null;
          return updated.ownershipType === 'JOINT_OWNERSHIP'
            ? {
                ...updated,
                calculatedOwnershipAreaSqm: area,
                calculatedOwnershipAreaPing: sqmToPing(area),
              }
            : {
                ...updated,
                ownershipAreaSqm: area,
                ownershipAreaPing: sqmToPing(area),
              };
        }),
      };
    }
    case 'UPDATE_ENCUMBRANCE':
      return {
        ...state,
        encumbrances: state.encumbrances.map((record) => {
          if (record.id !== action.id) return record;
          const value =
            action.field === 'securedAmount'
              ? normalizeNumber(action.value)
              : action.value;
          return updateOriginal(record, action.field, value);
        }),
      };
    case 'CONFIRM_ISSUE':
      return state.confirmedIssueIds.includes(action.id)
        ? state
        : {
            ...state,
            confirmedIssueIds: [...state.confirmedIssueIds, action.id],
          };
    case 'CLEAR_ALL':
      return initialState;
    default:
      return state;
  }
}

export function useRegistryWorkbench() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [exportStatus, setExportStatus] = useState('idle');
  const [exportMessage, setExportMessage] = useState('');
  const { parseFiles, isParsing } = usePdfParser();

  const validations = useMemo(() => {
    const confirmed = new Set(state.confirmedIssueIds);
    return validateLandRegistry(state).map((issue) => ({
      ...issue,
      confirmed: confirmed.has(issue.id),
    }));
  }, [state]);

  const aggregatedOwners = useMemo(
    () => aggregateOwners(state.owners, state.lands),
    [state.owners, state.lands],
  );

  const summary = useMemo(() => {
    const totalAreaSqm = state.lands.reduce(
      (sum, land) => sum + (land.areaSqm ?? 0),
      0,
    );
    return {
      landCount: state.lands.length,
      ownerCount: state.owners.length,
      uniqueOwnerCount: aggregatedOwners.length,
      riskCount: state.lands.filter(
        (land) => land.hasMortgage || land.hasRestriction,
      ).length,
      totalAreaSqm,
      totalAreaPing: sqmToPing(totalAreaSqm) ?? 0,
      unresolvedCount: validations.filter((issue) => !issue.confirmed).length,
      highRiskCount: validations.filter(
        (issue) => issue.severity === 'high' && !issue.confirmed,
      ).length,
    };
  }, [state.lands, state.owners, aggregatedOwners, validations]);

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
          recognizedParcels: 0,
          warningCount: 0,
          error: '',
        }));

      if (!entries.length) return;
      dispatch({ type: 'ADD_FILES', files: entries });

      const extracted = await parseFiles(entries, (id, patch) => {
        dispatch({ type: 'UPDATE_FILE', id, patch });
      });
      const parsed = parseRegistryDocuments(extracted.pages);
      dispatch({
        type: 'APPEND_PARSED',
        fileIds: entries.map((entry) => entry.id),
        pages: extracted.pages,
        ...parsed,
      });

      for (const result of extracted.results) {
        const fileLands = parsed.lands.filter(
          (land) => land.sourceFileId === result.id,
        );
        const warningCount = fileLands.reduce(
          (sum, land) => sum + land.parseWarnings.length + land.flags.length,
          0,
        );
        dispatch({
          type: 'UPDATE_FILE',
          id: result.id,
          patch: {
            ...result,
            status:
              result.status === 'complete' && warningCount > 0
                ? 'warning'
                : result.status,
            recognizedParcels: fileLands.length,
            warningCount,
          },
        });
      }
    },
    [parseFiles, state.files],
  );

  const exportWorkbook = useCallback(async () => {
    if (!state.lands.length || isParsing) return null;
    setExportStatus('exporting');
    setExportMessage('');
    try {
      const fileName = await exportRegistryWorkbook({
        ...state,
        aggregatedOwners,
        validations,
      });
      setExportStatus('success');
      setExportMessage(`已匯出 ${fileName}`);
      return fileName;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Excel 匯出失敗';
      setExportStatus('error');
      setExportMessage(message);
      throw error;
    }
  }, [state, aggregatedOwners, validations, isParsing]);

  return {
    ...state,
    validations,
    aggregatedOwners,
    summary,
    isParsing,
    exportStatus,
    exportMessage,
    addFiles,
    exportWorkbook,
    removeFile: (id) => dispatch({ type: 'REMOVE_FILE', id }),
    clearAll: () => dispatch({ type: 'CLEAR_ALL' }),
    updateLand: (id, field, value) =>
      dispatch({ type: 'UPDATE_LAND', id, field, value }),
    updateOwner: (id, field, value) =>
      dispatch({ type: 'UPDATE_OWNER', id, field, value }),
    updateEncumbrance: (id, field, value) =>
      dispatch({ type: 'UPDATE_ENCUMBRANCE', id, field, value }),
    confirmIssue: (id) => dispatch({ type: 'CONFIRM_ISSUE', id }),
  };
}
