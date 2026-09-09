'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Pencil, RotateCcw, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function EditableCell({
  value,
  displayValue,
  onSave,
  label,
  type = 'text',
  isEdited = false,
  originalValue,
  className = '',
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    onSave(draft);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className={`flex min-w-36 items-center gap-1 ${className}`}>
        <Input
          ref={inputRef}
          type={type}
          value={draft}
          aria-label={label}
          className="h-9 min-h-9"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit();
            if (event.key === 'Escape') {
              setDraft(value ?? '');
              setEditing(false);
            }
          }}
        />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={commit}
          aria-label={`儲存${label}`}
        >
          <Check aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            setDraft(value ?? '');
            setEditing(false);
          }}
          aria-label={`取消編輯${label}`}
        >
          <X aria-hidden="true" />
        </Button>
      </div>
    );
  }

  return (
    <div className={`group/edit flex min-w-0 items-center gap-1 ${className}`}>
      <Button
        variant="ghost"
        className="h-auto min-h-8 max-w-full justify-start px-1.5 py-1 text-left whitespace-normal"
        onClick={() => {
          setDraft(value ?? '');
          setEditing(true);
        }}
        aria-label={`編輯${label}，目前值 ${displayValue ?? value ?? '空白'}`}
      >
        <span className="min-w-0 break-words">
          {displayValue ?? value ?? '—'}
        </span>
        <Pencil
          aria-hidden="true"
          className="size-3 opacity-0 transition-opacity group-hover/edit:opacity-60 group-focus-within/edit:opacity-60"
        />
      </Button>
      {isEdited && (
        <span
          className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-amber-700"
          title={`原值：${originalValue ?? '空白'}`}
        >
          <RotateCcw aria-hidden="true" className="size-3" />
          人工
        </span>
      )}
    </div>
  );
}
