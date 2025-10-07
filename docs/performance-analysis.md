# Performance hotspots and async optimization opportunities

This document summarizes CPU- and I/O-bound code paths that are worth
optimizing with asynchronous streaming, worker threads, or more efficient
algorithms. Line references use the current repository state.

## Rolling average helpers (`apps/backend/src/utils/power.ts`)

* `computeRollingAverages` uses `Array.shift()` inside a tight loop to evict
  stale samples.【F:apps/backend/src/utils/power.ts†L28-L56】 Because `shift()`
  has *O(n)* cost, maintaining a sliding window of length *W* across *N*
  samples degrades to *O(N·W)*. The same helper feeds higher-level calls such as
  `computeBestRollingAverage`, multiplying the overhead when multiple window
  sizes are evaluated for every activity.【F:apps/backend/src/utils/power.ts†L75-L89】
* **Recommendation:** Replace the `Array.shift()` queue with a fixed-size ring
  buffer or start/end indices so the window update stays *O(1)* per sample.
  When backfilling historical analytics, consider running these pure-CPU loops
  in a Node.js `worker_thread` pool to keep the event loop responsive while
  processing large activities.

## Depth analysis moving averages (`apps/backend/src/services/depthAnalysisService.ts`)

* The internal `computeRollingAverage` helper repeats the same
  `Array.shift()` pattern to maintain a sliding window over daily energy
  totals.【F:apps/backend/src/services/depthAnalysisService.ts†L210-L237】 This
  incurs the same quadratic behaviour when the reporting window (e.g. 90 days)
  grows, which is costly during bulk recomputations.
* **Recommendation:** Share the ring-buffer implementation from the power
  utilities (above) or rewrite the helper to keep a running sum with head/tail
  indices. For very long histories, move the rolling computation onto a worker
  so Prisma query responses can be streamed back to the API thread without long
  pauses.

## FIT file ingestion (`apps/backend/src/parsers/fit.ts`)

* `parseFitFile` reads the entire FIT file into memory before handing it to the
  parser and then normalises every record in the main event loop, including
  expensive timestamp parsing, coordinate conversion, and sample interpolation
  across potentially tens of thousands of records.【F:apps/backend/src/parsers/fit.ts†L194-L300】
* **Recommendation:** Switch to `fs.createReadStream` and feed the parser via a
  stream interface to avoid loading large uploads entirely into memory. Because
  the sanitisation loop is CPU-heavy and independent per file, offload the
  parsing/normalisation to a dedicated worker thread or external job queue. The
  API process would then await the worker’s result or enqueue a background job,
  keeping upload endpoints responsive.

## Why prioritise these spots?

* All three hotspots run inside API-triggered code paths where long-running
  synchronous CPU work blocks other requests.
* The rolling-average helpers are reused across multiple analytics services, so
  lowering their complexity yields compound benefits.
* FIT parsing is naturally parallel across uploads, making it an ideal
  candidate for worker threads or an ingestion queue.

Adopting these improvements should reduce request latency and improve
throughput without requiring major architectural changes.
