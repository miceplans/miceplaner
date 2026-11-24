import type { ReactNode } from 'react';

export function Required() {
  return <span className="text-brand">*</span>;
}

export function TableTitle({ children }: { children: ReactNode }) {
  return <h2 className="m-0 text-lg font-semibold text-black">{children}</h2>;
}
