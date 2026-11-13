import * as fs from 'node:fs';
import * as path from 'node:path';

const HORIZON_COUNT = 240;
const ESTIMATION_WINDOW_SIZE = 720;
const OUTER_WIDTH = 0.9;
const INNER_WIDTH = 0.45;
const ADJUSTMENT_CAP = 0.05;

function percentile(values: number[], fraction: number): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function interquartileScale(values: number[]): number | undefined {
  const lower = percentile(values, 0.25);
  const upper = percentile(values, 0.75);
  if (lower === undefined || upper === undefined) return undefined;
  return (upper - lower) / 1.349;
}

function computeHorizonSpreads(priceWindow: number[]): number[] {
  const spreads: number[] = [];
  let runningMaximum = 0;
  for (let horizon = 1; horizon <= HORIZON_COUNT; horizon += 1) {
    const moves: number[] = [];
    for (let index = horizon; index < priceWindow.length; index += 1) {
      moves.push(priceWindow[index] - priceWindow[index - horizon]);
    }
    const estimatedSpread = moves.length < 100
      ? 0.0025 * Math.sqrt(horizon)
      : (interquartileScale(moves) ?? 0.0025 * Math.sqrt(horizon));
    runningMaximum = Math.max(runningMaximum, estimatedSpread);
    const spreadWithFloor = Math.max(runningMaximum, 0.0005 * Math.sqrt(horizon));
    spreads.push(spreadWithFloor);
  }
  return spreads;
}

function computeRegimeFactor(prices: number[]): number {
  const differences: number[] = [];
  for (let index = 1; index < prices.length; index += 1) {
    differences.push(prices[index] - prices[index - 1]);
  }
  const recent = interquartileScale(differences.slice(-60));
  const long = interquartileScale(differences.slice(-1440));
  if (long === undefined || long === 0 || recent === undefined) return 1;
  return Math.max(0.5, Math.min(2, recent / long));
}

function computeMedianAdjustment(markets: any[]): number {
  const sum = markets.reduce((total, market) => total + Number(market.prices.at(-1)), 0);
  const deviation = sum > 0 ? 1 / sum - 1 : 0;
  return 1 + Math.max(-ADJUSTMENT_CAP, Math.min(ADJUSTMENT_CAP, deviation));
}

function roundForecast(value: number): number {
  return Number((Math.max(0, Math.min(1, value))).toFixed(6)) + 0;
}

function forecastMarket(market: any, adjustment: number): { id: string; q: number[][] } {
  const prices: number[] = market.prices.map(Number);
  const lastPrice = prices.at(-1) ?? 0;
  const center = lastPrice * adjustment;
  const priceWindow = prices.slice(-ESTIMATION_WINDOW_SIZE);
  const spreads = computeHorizonSpreads(priceWindow);
  const regime = computeRegimeFactor(prices);
  const q: number[][] = spreads.map((baseSpread) => {
    const sigma = baseSpread * regime;
    return [
      roundForecast(center - 1.644854 * OUTER_WIDTH * sigma),
      roundForecast(center - 0.67449 * INNER_WIDTH * sigma),
      roundForecast(center),
      roundForecast(center + 0.67449 * INNER_WIDTH * sigma),
      roundForecast(center + 1.644854 * OUTER_WIDTH * sigma),
    ];
  });
  return { id: market.id, q };
}

function run(): void {
  const inputDirectory = process.env.MAKEFUN_INPUT_DIR ?? '/input';
  const outputDirectory = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  fs.mkdirSync(outputDirectory, { recursive: true });
  const inputNames = fs.readdirSync(inputDirectory)
    .filter((name) => name.endsWith('.in'))
    .sort();
  for (const inputName of inputNames) {
    const input = JSON.parse(fs.readFileSync(path.join(inputDirectory, inputName), 'utf8'));
    const adjustment = computeMedianAdjustment(input.markets);
    const forecasts = input.markets.map((market: any) => forecastMarket(market, adjustment));
    const output = JSON.stringify({ forecasts }) + '\n';
    const outputName = `${input.case}.out`;
    if (Buffer.byteLength(output, 'utf8') > 1024 * 1024) throw new Error(`Output too large: ${outputName}`);
    fs.writeFileSync(path.join(outputDirectory, outputName), output);
  }
}

run();
