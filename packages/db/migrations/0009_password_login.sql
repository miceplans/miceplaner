-- 이메일·비밀번호 로그인 (명세 F-01). 해시는 scrypt 문자열이며 앱 코드의 repository만 읽는다.
ALTER TABLE users ADD COLUMN password_hash text;
