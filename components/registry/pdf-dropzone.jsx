'use client';

import { useRef, useState } from 'react';
import { FilePlus2, FileUp, LockKeyhole } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function PdfDropzone({
  onFilesSelected,
  disabled,
  compact = false,
  registryLabel = '土地謄本',
}) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const openPicker = () => inputRef.current?.click();
  const submitFiles = (files) => {
    if (files?.length) onFilesSelected(files);
  };

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="application/pdf,.pdf"
      multiple
      disabled={disabled}
      className="sr-only"
      onChange={(event) => {
        submitFiles(event.target.files);
        event.target.value = '';
      }}
    />
  );

  if (compact) {
    return (
      <>
        <Button variant="outline" onClick={openPicker} disabled={disabled}>
          <FilePlus2 aria-hidden="true" />
          新增 PDF
        </Button>
        {input}
      </>
    );
  }

  return (
    <Card className="border-0 bg-white/96 py-0 shadow-[0_18px_65px_rgb(22_52_68/10%)] ring-1 ring-slate-950/8">
      <CardContent className="p-3 sm:p-4">
        <Button
          type="button"
          variant="ghost"
          disabled={disabled}
          aria-label={`上傳${registryLabel} PDF`}
          onClick={openPicker}
          onDragEnter={(event) => {
            event.preventDefault();
            if (!disabled) setIsDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            if (event.currentTarget === event.target) setIsDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            if (!disabled) submitFiles(event.dataTransfer.files);
          }}
          className={`group grid h-auto min-h-72 w-full place-items-center whitespace-normal rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/25 ${
            disabled
              ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-70'
              : isDragging
                ? 'cursor-copy border-primary bg-accent/65'
                : 'cursor-pointer border-slate-300 bg-[linear-gradient(135deg,rgba(236,247,249,.78),rgba(248,250,252,.8))] hover:border-primary/60'
          }`}
        >
          <div className="max-w-xl">
            <div className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl border border-primary/15 bg-white text-primary shadow-sm transition-transform group-hover:-translate-y-0.5">
              <FileUp aria-hidden="true" className="size-7" />
            </div>
            <p className="text-xl font-bold">拖曳{registryLabel}至此</p>
            <p className="mt-2 text-base text-muted-foreground">
              或點擊選擇一份或多份 PDF
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="bg-white">
                保留來源頁碼
              </Badge>
              <Badge variant="outline" className="bg-white">
                <LockKeyhole aria-hidden="true" />
                瀏覽器本機解析
              </Badge>
              <Badge variant="outline" className="bg-white">
                純掃描檔需人工處理
              </Badge>
            </div>
          </div>
        </Button>
        {input}
      </CardContent>
    </Card>
  );
}
