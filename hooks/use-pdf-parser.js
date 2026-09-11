'use client';

import { useCallback, useState } from 'react';

import {
  findAddressImagePlacements,
  recognizeAddressImageItems,
} from '@/lib/registry/address-ocr.js';
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

async function createAddressOcrWorker() {
  const { createWorker, PSM } = await import('tesseract.js');
  const assetRoot = `${import.meta.env.BASE_URL}tesseract`;
  const worker = await createWorker('chi_tra', 1, {
    workerPath: `${assetRoot}/worker.min.js`,
    corePath: `${assetRoot}/tesseract-core-simd-lstm.wasm.js`,
    langPath: assetRoot,
    gzip: true,
  });
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_LINE,
    preserve_interword_spaces: '1',
    user_defined_dpi: '300',
  });
  return worker;
}

export function usePdfParser() {
  const [isParsing, setIsParsing] = useState(false);

  const parseFiles = useCallback(async (entries, onProgress) => {
    setIsParsing(true);
    const pages = [];
    const results = [];
    let addressOcrWorker;

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
          let recognizedAddressCount = 0;
          let addressOcrError = '';

          onProgress?.(entry.id, { pageCount: document.numPages });

          for (
            let pageNumber = 1;
            pageNumber <= document.numPages;
            pageNumber += 1
          ) {
            const page = await document.getPage(pageNumber);
            const content = await page.getTextContent();
            let addressItems = [];
            try {
              const operatorList = await page.getOperatorList();
              const placements = findAddressImagePlacements(
                pdfjs,
                operatorList,
              );
              if (placements.length) {
                addressOcrWorker ??= await createAddressOcrWorker();
                addressItems = await recognizeAddressImageItems({
                  pdfjs,
                  page,
                  worker: addressOcrWorker,
                  placements,
                });
                recognizedAddressCount += addressItems.length;
              }
            } catch (error) {
              addressOcrError =
                error instanceof Error ? error.message : '住址影像辨識失敗';
            }

            const rawText = rebuildPageText([
              ...content.items,
              ...addressItems,
            ]);
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
            status: addressOcrError ? 'warning' : 'complete',
            pageCount: document.numPages,
            progress: 100,
            recognizedAddressCount,
            error: addressOcrError
              ? `住址影像辨識未完成：${addressOcrError}`
              : recognizedAddressCount
                ? `${recognizedAddressCount} 筆住址由本機影像辨識，請人工核對`
                : '',
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
      await addressOcrWorker?.terminate?.();
      setIsParsing(false);
    }
  }, []);

  return { parseFiles, isParsing };
}
