import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';

/**
 * 폼 필드 공통 컴포넌트.
 * 크기·모양 토큰은 docs/design-system.md의 스케일을 따른다.
 * 드롭다운은 select.tsx의 커스텀 Select를 쓴다.
 */

/** 필드 크기. sm=필터·인라인(26px), md=폼 기본(32px), lg=큰 폼(40px). */
export type FieldSize = 'sm' | 'md' | 'lg';

/**
 * 필드 모양. outline=테두리 기본, chip=칩 배경(테두리 없음),
 * ghost=배경·테두리·크기 없음(주변 텍스트 스타일을 상속해 인라인 편집에 쓴다).
 */
export type FieldVariant = 'outline' | 'chip' | 'ghost';

export const SIZE_CLS: Record<FieldSize, string> = {
  sm: 'h-[26px] rounded-sm px-[8px] text-xs',
  md: 'h-[32px] rounded-md px-[10px] text-base',
  lg: 'h-[40px] rounded-lg px-[12px] text-base',
};

const TEXTAREA_SIZE_CLS: Record<FieldSize, string> = {
  sm: 'rounded-sm px-[8px] py-[5px] text-xs',
  md: 'rounded-md px-[10px] py-[8px] text-base',
  lg: 'rounded-lg px-[12px] py-[10px] text-base',
};

export const VARIANT_CLS: Record<FieldVariant, string> = {
  outline: 'border border-solid border-border bg-surface focus:border-brand',
  chip: 'bg-surface-chip',
  ghost: '',
};

/** 크기·모양 클래스. ghost는 크기 클래스를 무시한다. */
const controlCls = (size: FieldSize, variant: FieldVariant, textarea = false): string =>
  `min-w-0 text-fg outline-none placeholder:text-fg-tertiary ${variant === 'ghost' ? '' : textarea ? TEXTAREA_SIZE_CLS[size] : SIZE_CLS[size]} ${VARIANT_CLS[variant]}`;

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  size?: FieldSize;
  variant?: FieldVariant;
  /** 검증 실패 표시. outline에서 테두리를 에러 색으로 바꾼다. */
  invalid?: boolean;
};

/** 표준 텍스트 입력. date·search 등 type은 네이티브 속성을 그대로 전달한다. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = 'md', variant = 'outline', invalid = false, className = '', ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={`${controlCls(size, variant)} ${invalid ? 'border-error!' : ''} ${className}`}
      {...rest}
    />
  );
});

export type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> & {
  size?: FieldSize;
  variant?: FieldVariant;
  invalid?: boolean;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { size = 'md', variant = 'outline', invalid = false, rows = 3, className = '', ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={`${controlCls(size, variant, true)} resize-none ${invalid ? 'border-error!' : ''} ${className}`}
      {...rest}
    />
  );
});

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> & {
  size?: 'sm' | 'md';
};

/** 체크박스. sm=14px, md=16px. 브랜드 색상을 따른다. */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { size = 'md', className = '', ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type="checkbox"
      className={`shrink-0 cursor-pointer accent-brand ${size === 'sm' ? 'size-[14px]' : 'size-[16px]'} ${className}`}
      {...rest}
    />
  );
});
