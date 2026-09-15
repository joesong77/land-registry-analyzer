'use client';

import { useEffect } from 'react';

const views = ['land', 'aggregate', 'owners', 'encumbrances', 'validation'];

export function useRegistryWebMcp({
  summary,
  setActiveTab,
  exportWorkbook,
  canExport,
}) {
  useEffect(() => {
    const context =
      typeof document === 'undefined' ? undefined : document.modelContext;
    if (!context?.registerTool) return undefined;

    const lifecycle = new AbortController();
    const reportError = (error) => {
      if (error?.name === 'AbortError') return;
      console.warn('WebMCP tool registration failed', error);
    };

    const register = (tool) => {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(reportError);
      } catch (error) {
        reportError(error);
      }
    };

    register({
      name: 'get_registry_summary',
      title: '讀取謄本解析摘要',
      description: '讀取目前畫面中的土地、地主、風險及待確認筆數，不修改資料。',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute() {
        return {
          landCount: summary.landCount,
          ownerRecordCount: summary.ownerCount,
          uniqueOwnerCount: summary.uniqueOwnerCount,
          riskLandCount: summary.riskCount,
          unresolvedCount: summary.unresolvedCount,
        };
      },
    });

    register({
      name: 'open_registry_view',
      title: '開啟謄本工作視圖',
      description: '切換目前土地謄本工作台至指定清冊或解析檢核視圖。',
      inputSchema: {
        type: 'object',
        properties: {
          view: { type: 'string', enum: views },
        },
        required: ['view'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (!input || !views.includes(input.view))
          throw new Error('不支援的工作視圖');
        setActiveTab(input.view);
        return { activeView: input.view };
      },
    });

    register({
      name: 'export_registry_workbook',
      title: '匯出土地謄本 Excel',
      description:
        '將目前已解析與人工修正的資料匯出成六個工作表的 Excel 清冊。',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute() {
        if (!canExport)
          throw new Error('目前沒有可匯出的土地資料，或仍在解析中');
        const fileName = await exportWorkbook();
        return { status: 'downloaded', fileName };
      },
    });

    return () => lifecycle.abort();
  }, [summary, setActiveTab, exportWorkbook, canExport]);
}
