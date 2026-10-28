/** timestamptz를 항상 UTC ISO 8601 문자열(Z)로 돌려준다. pg가 Date로 파싱하지 않게 SQL에서 변환하며 contracts의 isoDateTime과 맞는다. */
export const isoTs = (column: string, alias: string): string => `to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "${alias}"`;
