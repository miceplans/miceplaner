import { createLlmClient } from '../client';
import { EVAL_CASES } from './cases';
import { runEval } from './run';

// 사용: LLM_BASE_URL=… LLM_API_KEY=… LLM_MODEL=… pnpm --filter @miceplans/ai eval [--min 0.8]
const { LLM_BASE_URL, LLM_API_KEY, LLM_MODEL } = process.env;
if (!LLM_BASE_URL || !LLM_API_KEY || !LLM_MODEL) {
  console.error('LLM_BASE_URL, LLM_API_KEY, LLM_MODEL이 필요하다');
  process.exit(2);
}
const minIdx = process.argv.indexOf('--min');
const min = minIdx >= 0 ? Number(process.argv[minIdx + 1]) : undefined;

const report = await runEval(createLlmClient({ baseUrl: LLM_BASE_URL, apiKey: LLM_API_KEY, model: LLM_MODEL }), EVAL_CASES);
for (const r of report.results) console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.id}  [${r.called.join(', ')}]${r.reasons.length ? `  ${r.reasons.join('; ')}` : ''}`);
console.log(`\n${LLM_MODEL}: ${report.passed}/${report.total} (${(report.rate * 100).toFixed(0)}%)`);
if (min !== undefined && report.rate < min) process.exit(1);
