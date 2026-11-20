import { ClientLoginView } from './client-login-view';

export const metadata = { title: 'Client 포털 로그인' };

/** client. 서브도메인에서 `/login`으로 매핑하는 Client 포털 로그인 화면. */
export default function ClientLoginPage() {
  return <ClientLoginView />;
}
