'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ViewToggle } from '@miceplans/ui';

const A = '/assets/events-by-year-2';

const OPTIONS = [
  { value: 'folder', label: '폴더 뷰', icon: `${A}/gallery-icon.svg` },
  { value: 'list', label: '리스트', icon: `${A}/list-icon.svg` },
] as const;

/** Rectangle 5.svg (폴더 뒷면) / Rectangle 4.svg (폴더 앞면) 윤곽 그대로. */
const BACK_PATH =
  'M0.0158252 12.6109C-0.333818 5.75245 5.13287 0 12.0003 0H80.7605C89.482 0 99.7299 11.2546 108.187 13.3847C110.881 14.063 114.302 14.4706 118.635 14.4706C136.696 14.4706 168.993 14.4706 186.774 14.4706C193.639 14.4706 199.084 20.2183 198.738 27.074L193.389 133.309C193.068 139.694 187.797 144.706 181.405 144.706H18.1538C11.7638 144.706 6.4947 139.699 6.16937 133.317L0.0158252 12.6109Z';
const FRONT_PATH =
  'M0.0227783 12.731C-0.398431 5.82892 5.08561 0 12.0005 0H186.577C193.46 0 198.932 5.77727 198.56 12.65L193.304 109.532C192.959 115.898 187.697 120.882 181.322 120.882H17.9129C11.5694 120.882 6.32159 115.945 5.93519 109.613L0.0227783 12.731Z';

const FOLDERS = [] as { year: number; color: string; photos: number[]; href?: string }[];

type FolderData = (typeof FOLDERS)[number];

function Folder({ year, color, photos, href }: FolderData & { href?: string }) {
  const body = (
    <div className="group flex flex-col items-center gap-[20px] self-stretch">
      <div className="relative h-[150px] w-[200px] shrink-0">
        <svg width="199" height="145" viewBox="0 0 199 145" fill="none" className="absolute left-0 top-0 block" aria-hidden>
          <path d={BACK_PATH} className={color} />
        </svg>
        {/* 폴터 사진 2장: 뒷면과 앞면 사이에서 호버 시 살짝 올라온다 */}
        <img
          alt=""
          src={`${A}/photos/p${photos[0]}.jpg`}
          className="absolute left-[26.9px] -top-[2.25px] h-[96.247px] w-[144.353px] max-w-none rounded-lg object-cover transition-transform duration-300 group-hover:-translate-y-[8px] group-hover:-rotate-[2deg]"
        />
        <img
          alt=""
          src={`${A}/photos/p${photos[1]}.jpg`}
          className="absolute left-[30.99px] top-[9.22px] h-[96.222px] w-[144.39px] max-w-none rounded-lg object-cover transition-transform duration-300 group-hover:-translate-y-[6px] group-hover:rotate-[2deg]"
        />
        {/* 앞면: 흰색 30% 유리 + 배경 블러, 윤곽은 Rectangle 4 */}
        <div
          className="absolute left-0 top-[42px] h-[108px] w-[199px] backdrop-blur-[30px]"
          style={{ clipPath: 'url(#folder-front-clip)' }}
        >
          <svg width="199" height="108" viewBox="0 0 199 121" preserveAspectRatio="none" fill="none" className="absolute inset-0 block" aria-hidden>
            <path d={FRONT_PATH} className="fill-fg-inverse/30" />
          </svg>
        </div>
      </div>
      <p className="m-0 whitespace-nowrap text-center text-2xl font-semibold tracking-[-1px] text-fg-strong">{year} 행사</p>
    </div>
  );
  return href ? (
    <a href={href} className="block rounded-xl no-underline outline-offset-4">
      {body}
    </a>
  ) : (
    body
  );
}

/** 앞면(Rectangle 4)을 높이만 줄여 쓰기 위한 비율 기반 클립. */
function FrontClip() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <clipPath id="folder-front-clip" clipPathUnits="objectBoundingBox">
        <path d={FRONT_PATH} transform="scale(0.005025 0.008264)" />
      </clipPath>
    </svg>
  );
}

export function EventsByYearFolders() {
  const router = useRouter();
  const [view, setView] = useState<'folder' | 'list'>('folder');

  return (
    <div className="flex w-full flex-col items-center leading-[normal]">
      <FrontClip />
      <div className="flex shrink-0 flex-col items-start gap-[64px] py-[60px]">
        <div className="flex w-full items-start justify-between">
          <h1 className="m-0 whitespace-nowrap text-3xl font-bold tracking-[-1px] text-fg">연도별 행사</h1>
          <ViewToggle
            options={OPTIONS}
            value={view}
            onChange={(v) => {
              setView(v);
              if (v === 'list') router.push('/events-by-year');
            }}
          />
        </div>
        <div className="grid w-[812px] shrink-0 grid-cols-3 gap-x-[40px] gap-y-[14px]">
          {FOLDERS.map((f) => (
            <Folder key={f.year} {...f} />
          ))}
        </div>
      </div>
    </div>
  );
}
