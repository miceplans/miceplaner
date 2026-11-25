import { VISIBILITY_TONE, type DocVisibility } from './event-docs-model';

export function Avatar({ name, color, size = 24, ring = true }: { name: string; color: string; size?: number; ring?: boolean }) {
  return (
    <span
      title={name}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-fg-inverse ${color} ${ring ? 'border-2 border-solid border-surface' : ''}`}
    >
      {name.slice(0, 1)}
    </span>
  );
}

export function VisibilityChip({ value }: { value: DocVisibility }) {
  return (
    <span className={`flex h-[22px] shrink-0 items-center rounded-full px-[8px] text-2xs font-semibold ${VISIBILITY_TONE[value]}`}>
      {value}
    </span>
  );
}
