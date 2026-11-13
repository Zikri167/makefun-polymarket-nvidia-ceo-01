import * as fs from 'node:fs';
import * as path from 'node:path';

const inputDir = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const ESTIMATION_WINDOW = 1440;
const zScores = [-1.644854, -0.67449, 0, 0.67449, 1.644854];

function percentile(sorted: number[], p: number): number {
  const position = (sorted.length - 1) * p;
  const lower = Math.floor(position);
  const fraction = position - lower;
  return sorted[lower] + (sorted[Math.min(lower + 1, sorted.length - 1)] - sorted[lower]) * fraction;
}

function forecast(prices: number[]): number[][] {
  const center = prices[prices.length - 1];
  const window = prices.slice(-ESTIMATION_WINDOW);
  let previousSpread = 0;
  const rows: number[][] = [];

  for (let h = 1; h <= 240; h++) {
    const rootH = Math.sqrt(h);
    let spread: number;
    const count = window.length - h;
    if (count < 100) {
      spread = 0.0025 * rootH;
    } else {
      const moves = new Array<number>(count);
      for (let i = h; i < window.length; i++) moves[i - h] = window[i] - window[i - h];
      moves.sort((a, b) => a - b);
      spread = (percentile(moves, 0.75) - percentile(moves, 0.25)) / 1.349;
    }
    spread = Math.max(previousSpread, spread, 0.0005 * rootH);
    previousSpread = spread;
    const scale = 0.55 * spread;
    rows.push(zScores.map(z => {
      const rounded = Math.round((center + z * scale) * 1_000_000) / 1_000_000;
      return Math.max(0, Math.min(1, rounded)) + 0;
    }));
  }
  return rows;
}

fs.mkdirSync(outputDir, { recursive: true });
const files = fs.readdirSync(inputDir).filter(name => name.endsWith('.in')).sort();
for (const file of files) {
  const input = JSON.parse(fs.readFileSync(path.join(inputDir, file), 'utf8'));
  const forecasts = input.markets.map((market: { id: string; prices: number[] }) => ({
    id: market.id,
    q: forecast(market.prices),
  }));
  const output = JSON.stringify({ forecasts }) + '\n';
  fs.writeFileSync(path.join(outputDir, `${input.case}.out`), output);
}
