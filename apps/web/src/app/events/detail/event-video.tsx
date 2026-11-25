'use client';

import { useEffect, useState } from 'react';
import { Input, Select, toast } from '@miceplans/ui';
import { createPersistedStore, scopedStores, usePersisted } from '@miceplans/ui/persisted-store';

// 영상 종류는 정해진 목록에서 고른다.
const VIDEO_TYPES = ['루핑', '시상식', '오프닝', '홍보영상', '스케치 촬영 및 편집', '사진 촬영'] as const;
type VideoType = (typeof VIDEO_TYPES)[number];

type VideoSpec = {
  led: string; // LED 크기 및 피치 크기
  resolution: string; // 해상도
  videoType: VideoType; // 영상 종류
};

type VideoForm = { led: string; resolution: string; videoType: string };

const EMPTY_FORM: VideoForm = { led: '', resolution: '', videoType: '' };

function decodeSpec(raw: unknown): VideoSpec | null {
  if (!raw || typeof raw !== 'object') return null;
  const { led, resolution, videoType } = raw as Record<string, unknown>;
  if (typeof led !== 'string' || typeof resolution !== 'string' || typeof videoType !== 'string') return null;
  return { led, resolution, videoType: videoType as VideoType };
}

/** 서버 연결 전까지 영상 사양은 행사별로 브라우저에 저장한다. */
const videoStoreOf = scopedStores((eventId) =>
  createPersistedStore<VideoSpec | null>({ key: `miceplans.event-video.${eventId}`, fallback: null, decode: decodeSpec, encode: (spec) => spec ?? undefined }),
);

const HEAD = 'bg-surface-cell';
const LINE = 'border-border-strong';
const CELL = 'flex h-[40px] shrink-0 items-center rounded-lg px-[8px] text-[15px] text-fg';

function Required() {
  return <span className="text-brand">*</span>;
}

/** 영상 사양: LED 크기·피치, 해상도, 영상 종류를 입력한다. 모든 항목은 필수다. */
export function VideoSection({ eventId }: { eventId: string }) {
  const [saved, setSaved, loaded] = usePersisted(videoStoreOf(eventId));
  const [form, setForm] = useState<VideoForm>(EMPTY_FORM);
  const [editing, setEditing] = useState(true);
  const [errors, setErrors] = useState<{ led: boolean; resolution: boolean; videoType: boolean }>({ led: false, resolution: false, videoType: false });

  // 저장값을 읽은 뒤, 그리고 행사가 바뀌거나 저장값이 갱신되면 양식을 저장값에 맞춘다.
  useEffect(() => {
    if (!loaded) return;
    setForm(saved ?? EMPTY_FORM);
    setEditing(!saved);
  }, [saved, loaded]);

  const patch = (p: Partial<VideoForm>) => setForm((f) => ({ ...f, ...p }));

  const save = () => {
    const next = { led: !form.led.trim(), resolution: !form.resolution.trim(), videoType: !form.videoType };
    setErrors(next);
    if (next.led || next.resolution || next.videoType) {
      toast.error('[400] 필수 항목을 모두 입력해 주세요.');
      return;
    }
    setSaved({ led: form.led.trim(), resolution: form.resolution.trim(), videoType: form.videoType as VideoType });
    setEditing(false);
  };

  return (
    <section className="flex w-full flex-col gap-[12px]">
      <h2 className="m-0 text-lg font-semibold text-black">영상</h2>
      <div className="overflow-x-auto">
        <div className="flex min-w-[900px] flex-col">
          <div className={`flex items-center gap-[12px] rounded-t-lg px-[14px] py-[8px] ${HEAD}`}>
            <span className={`${CELL} w-[280px]`}>LED 크기 및 피치 크기 <Required /></span>
            <span className={`${CELL} w-[180px]`}>해상도 <Required /></span>
            <span className={`${CELL} w-[220px]`}>영상 종류 <Required /></span>
            <span className="flex-1" />
          </div>
          <div className={`flex items-center gap-[12px] rounded-b-lg border border-solid bg-surface px-[14px] py-[10px] ${LINE}`}>
            {editing ? (
              <>
                <Input
                  aria-label="LED 크기 및 피치 크기"
                  value={form.led}
                  onChange={(e) => patch({ led: e.target.value })}
                  placeholder="예: 12m × 3m, P3.9"
                  size="lg"
                  invalid={errors.led}
                  className="w-[280px]"
                />
                <Input
                  aria-label="해상도"
                  value={form.resolution}
                  onChange={(e) => patch({ resolution: e.target.value })}
                  placeholder="예: 3072 × 768"
                  size="lg"
                  invalid={errors.resolution}
                  className="w-[180px]"
                />
                <Select
                  aria-label="영상 종류"
                  value={form.videoType}
                  onChange={(e) => patch({ videoType: e.target.value })}
                  size="lg"
                  invalid={errors.videoType}
                  className="w-[220px]"
                >
                  <option value="">선택</option>
                  {VIDEO_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
                <span className="flex-1" />
                <button type="button" onClick={save} className="flex h-[40px] shrink-0 items-center rounded-lg bg-brand px-[16px] text-[15px] font-semibold text-fg-inverse">
                  저장
                </button>
              </>
            ) : (
              saved && (
                <>
                  <span className={`${CELL} w-[280px]`}>{saved.led}</span>
                  <span className={`${CELL} w-[180px]`}>{saved.resolution}</span>
                  <span className={`${CELL} w-[220px]`}>{saved.videoType}</span>
                  <span className="flex-1" />
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="h-[32px] shrink-0 rounded-sm border border-solid border-border px-[14px] text-base font-medium text-fg-secondary hover:bg-surface-subtle"
                  >
                    수정
                  </button>
                </>
              )
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
