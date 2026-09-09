'use client';

import { useCallback, useState } from 'react';

import { normalizeRegistryText } from '@/lib/registry/normalize.js';
import { rebuildPageText } from '@/lib/registry/parser.js';

let pdfModulesPromise;

async function loadPdfJs() {
  pdfModulesPromise ??= Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs'),
  ]).then(([pdfjs, pdfWorker]) => {
    globalThis.pdfjsWorker = {
      WorkerMessageHandler: pdfWorker.WorkerMessageHandler,
    };
    return pdfjs;
  });
  return pdfModulesPromise;
}

export function usePdfParser() {
  const [isParsing, setIsParsing] = useState(false);

  const parseFiles = useCallback(async (entries, onProgress) => {
    setIsParsing(true);
    const pages = [];
    const results = [];

    try {
      const pdfjs = await loadPdfJs();

      for (const entry of entries) {
        let document;
        try {
          onProgress?.(entry.id, {
            status: 'parsing',
            progress: 0,
            currentPage: 0,
            pageCount: null,
          });
          const data = new Uint8Array(await entry.file.arrayBuffer());
          document = await pdfjs.getDocument({
            data,
            verbosity: pdfjs.VerbosityLevel.ERRORS,
          }).promise;
          let readablePages = 0;

          onProgress?.(entry.id, { pageCount: document.numPages });

          for (
            let pageNumber = 1;
            pageNumber <= document.numPages;
            pageNumber += 1
          ) {
            const page = await document.getPage(pageNumber);
            const content = await page.getTextContent();
            const rawText = rebuildPageText(content.items);
            const normalizedText = normalizeRegistryText(rawText);
            if (normalizedText) readablePages += 1;
            pages.push({
              sourceFileId: entry.id,
              sourceFileName: entry.file.name,
              pageNumber,
              rawText,
              normalizedText,
            });

            onProgress?.(entry.id, {
              status: 'parsing',
              currentPage: pageNumber,
              pageCount: document.numPages,
              progress: Math.round((pageNumber / document.numPages) * 100),
            });
            await new Promise((resolve) => setTimeout(resolve, 0));
          }

          if (readablePages === 0) {
            throw new Error('此 PDF 無可讀文字層；目前版本尚未啟用 OCR。');
          }

          results.push({
            id: entry.id,
            status: 'complete',
            pageCount: document.numPages,
            progress: 100,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'PDF 解析失敗';
          results.push({
            id: entry.id,
            status: 'failed',
            error: message,
            progress: 0,
          });
          onProgress?.(entry.id, {
            status: 'failed',
            error: message,
          });
        } finally {
          await document?.destroy?.();
        }
      }

      return { pages, results };
    } finally {
      setIsParsing(false);
    }
  }, []);

  return { parseFiles, isParsing };
}
