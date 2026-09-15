import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  LoaderCircle,
  Trash2,
  XCircle,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

const statusConfig = {
  queued: {
    label: '等待解析',
    icon: FileText,
    className: 'bg-slate-100 text-slate-700',
  },
  parsing: {
    label: '解析中',
    icon: LoaderCircle,
    className: 'bg-blue-50 text-blue-700',
  },
  complete: {
    label: '完成',
    icon: CheckCircle2,
    className: 'bg-emerald-50 text-emerald-700',
  },
  warning: {
    label: '有警告',
    icon: AlertTriangle,
    className: 'bg-amber-50 text-amber-800',
  },
  failed: { label: '失敗', icon: XCircle, className: 'bg-red-50 text-red-700' },
};

export function FileQueue({ files, onRemove, recordLabel = '地號' }) {
  return (
    <section
      aria-labelledby="file-queue-title"
      className="rounded-xl border bg-white/88 shadow-sm"
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 id="file-queue-title" className="text-sm font-bold">
            PDF 檔案
          </h2>
          <p className="text-xs text-muted-foreground">
            共 {files.length} 份，逐頁在本機解析
          </p>
        </div>
      </div>
      <div className="divide-y" aria-live="polite">
        {files.map((file) => {
          const config = statusConfig[file.status] ?? statusConfig.queued;
          const StatusIcon = config.icon;
          return (
            <div
              key={file.id}
              className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_minmax(200px,320px)_auto] lg:items-center"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">
                  <FileText aria-hidden="true" className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{file.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                    {file.pageCount ? ` · ${file.pageCount} 頁` : ''}
                    {file.recognizedRecords || file.recognizedParcels
                      ? ` · ${file.recognizedRecords ?? file.recognizedParcels} 筆${recordLabel}`
                      : ''}
                  </p>
                </div>
              </div>

              <div className="min-w-0">
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <Badge
                    variant="outline"
                    className={`border-transparent ${config.className}`}
                  >
                    <StatusIcon
                      aria-hidden="true"
                      className={
                        file.status === 'parsing' ? 'animate-spin' : ''
                      }
                    />
                    {config.label}
                  </Badge>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {file.status === 'parsing' && file.pageCount
                      ? `${file.currentPage} / ${file.pageCount} 頁`
                      : file.error ||
                        (file.warningCount
                          ? `${file.warningCount} 個提示`
                          : '')}
                  </span>
                </div>
                <Progress
                  value={file.progress ?? 0}
                  aria-label={`${file.name} 解析進度`}
                />
              </div>

              <Button
                variant="ghost"
                size="icon"
                aria-label={`移除 ${file.name}`}
                disabled={file.status === 'parsing'}
                onClick={() => onRemove(file.id)}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
