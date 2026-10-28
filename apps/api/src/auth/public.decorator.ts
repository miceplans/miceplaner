import { SetMetadata } from '@nestjs/common';

/** 로그인 없이 열어 두는 핸들러에 붙인다. */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
