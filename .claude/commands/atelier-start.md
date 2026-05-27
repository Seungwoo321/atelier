---
description: Drop a request into the inbox and run the G1–G5 graph.
argument-hint: <request text>
---

Run the local CLI with the user's request:

```bash
atelier start "$ARGUMENTS"
```

Then read back the result from `./artifacts/default/result.json` and
summarize the five gate outputs in 5 bullet points.
