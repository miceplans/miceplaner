/**
 * LLM 경계의 개인정보 보호 도구. 실제 이름은 모델·호출 로그에 보내지 않고
 * 요청 안에서만 안정적인 토큰으로 바꾼다. 토큰의 원래 값은 API 프로세스 메모리에만 있다.
 */
export class PersonNameMasker {
  private readonly replacements: ReadonlyMap<string, string>;
  private readonly aliases: readonly string[];

  constructor(names: readonly string[]) {
    const unique = [...new Set(names.map((name) => name.trim()).filter((name) => name.length >= 2))]
      .sort((a, b) => b.length - a.length || a.localeCompare(b, 'ko'));
    this.replacements = new Map(unique.map((name, index) => [name, `<PERSON_${String(index + 1).padStart(3, '0')}>`]));
    this.aliases = [...this.replacements.values()];
  }

  /** 이름과 예산을 LLM에 전달하기 전에 제거한다. */
  redactText(text: string): string {
    let masked = redactBudget(text);
    for (const [name, alias] of this.replacements) masked = masked.replaceAll(name, alias);
    return masked;
  }

  /** 객체의 문자열 값도 같은 규칙으로 처리한다. `budget` 속성은 절대 전달하지 않는다. */
  redact(value: unknown): unknown {
    if (typeof value === 'string') return this.redactText(value);
    if (Array.isArray(value)) return value.map((item) => this.redact(item));
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [
        key,
        /budget|예산/i.test(key) ? '[REDACTED_BUDGET]' : this.redact(item),
      ]));
    }
    return value;
  }

  restoreText(text: string): string {
    let restored = text;
    for (const [name, alias] of this.replacements) restored = restored.replaceAll(alias, name);
    return restored;
  }

  restore(value: unknown): unknown {
    if (typeof value === 'string') return this.restoreText(value);
    if (Array.isArray(value)) return value.map((item) => this.restore(item));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, this.restore(item)]));
    return value;
  }

  /** SSE 청크 경계에서 `<PERSON_001>` 토큰이 나뉘어도 정상 이름으로 렌더링한다. */
  createStreamRestorer() {
    let pending = '';
    const trailingAliasPrefix = (text: string) => {
      for (let length = Math.min(text.length, 20); length > 0; length--) {
        const suffix = text.slice(-length);
        if (this.aliases.some((alias) => alias.length > suffix.length && alias.startsWith(suffix))) return suffix;
      }
      return '';
    };
    const emit = (flush: boolean) => {
      const hold = flush ? '' : trailingAliasPrefix(pending);
      const ready = hold ? pending.slice(0, -hold.length) : pending;
      pending = hold;
      return this.restoreText(ready);
    };
    return {
      push: (chunk: string) => { pending += chunk; return emit(false); },
      flush: () => emit(true),
    };
  }
}

/**
 * 예산은 가역 토큰도 만들지 않는다. 표의 예산 행과 일반 문장의 예산 문맥을 모두
 * 한 줄 단위로 제거하므로 금액이 이후 모델 대화에 남지 않는다.
 */
export function redactBudget(text: string): string {
  // 문서 일부만 가리면 표의 이웃 셀·다음 문단으로 금액을 유추할 수 있다. 예산이라는
  // 단어가 있는 문자열은 통째로 차단하고, 단독 통화값도 별도로 차단한다.
  if (/예산|budget/iu.test(text)) return '[REDACTED_BUDGET]';
  return text.replace(/(?:₩\s*)?\d{1,3}(?:,\d{3})+(?:\s*원|\s*만원|\s*억원)?|\d+(?:\.\d+)?\s*(?:만원|억원)/gu, '[REDACTED_BUDGET]');
}
