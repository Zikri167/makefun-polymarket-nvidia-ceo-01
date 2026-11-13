# NVIDIA CEO forecast

`main.ts` reads sorted `.in` case files from `MAKEFUN_INPUT_DIR` (default `/input`) and writes one forecast file per case to `MAKEFUN_OUTPUT_DIR` (default `/output`).

For each market it centers forecasts on the last Yes price and estimates horizon spreads from the interquartile range of historical moves in the latest 1,440 prices. Spreads have a low-sample fallback, a volatility floor, and are kept non-decreasing across horizons. Five normal-based quantiles are clamped to `[0, 1]` and rounded to six decimals.

The program uses Node.js standard-library modules only and has no clock, randomness, or network dependency.
