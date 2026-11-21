# Official exam intake: offline preview only

The existing Mac scheduler is a separate project-local tool. It may mirror official catalog/PDF versions into quarantine and call the deterministic extractor; watch runs only for the process lifetime. This change installs no schedule and does not add the existing downloader or its environment to the public review branch.

Use a quarantined candidate JSON created by the existing extractor and Node 20.20.2. The wrapper consumes an 80-row capture of one exact paper and emits the plan, stable stage ID, prior-state version, and trace to stdout. If saving output, use a disposable, project-contained quarantine directory rather than source/public data.

    node -e 'const fs=require("node:fs");const capture=JSON.parse(fs.readFileSync(process.argv[1]));const prior=process.argv[2]?JSON.parse(fs.readFileSync(process.argv[2])):null;process.stdout.write(JSON.stringify({capture,prior}))' candidate.json       | node scripts/stage-official-ingest-capture.mjs

For idempotency checking, pass the preceding plan JSON as the second argument to the Node producer. Exact replay returns `already-planned` and the same stage ID. Do not supply an unsigned/manual capture as if it were official. A captured hash mark is only resolved when the exact paper, paired PDF hashes and recorded correction version match the curated local MOEX review data. Paid/model calls, public promotion and receipt modifications are out of scope.

Human reviews remain mandatory: original-page transcription and notation fidelity, option order, each image's page/location/reuse rights, the meaning of official correction notices and joint-vs-alternative answer sets, and exact source and rights verification for each explanation. No explanation generation is performed. RAG and public updates stay blocked.

Unit fixtures: `node --test tests/official-ingest-plan.test.mjs tests/official-ingest-capture.test.mjs`. A separate local integration rehearsal used mocked catalog/official PDF responses, real scheduler and extractor, and synthetic 80-question PDFs; no external intake service was started.
