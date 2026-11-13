# Polymarket NVIDIA CEO forecast

This deterministic Node 22 program reads JSON cases from `MAKEFUN_INPUT_DIR` (or `/input`) and writes one forecast file per case to `MAKEFUN_OUTPUT_DIR` (or `/output`).

For each market it estimates horizon spreads from recent price moves, scales them by a recent versus long run volatility regime, and applies a case wide median adjustment. It emits five bounded quantiles for each of the next 240 minutes.
