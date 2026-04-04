# Runtime Validation

> Source: [When Should You Use Zod?](https://www.totaltypescript.com/when-should-you-use-zod) — Matt Pocock

## The Framework: Trust Boundaries

Matt's recommendation is based on how much you trust the data entering your application.

## Use Zod: Untrusted Inputs

Validate data you don't control. These are attack vectors and sources of runtime surprises:

- **CLI arguments** (`process.argv`)
- **Public API endpoints** (path params, headers, request bodies)
- **Form submissions**
- **WebSocket connections**
- **`localStorage`** (users can manipulate it directly)

```typescript
import { z } from "zod";

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().int().positive(),
});

// At the API boundary
const result = CreateUserSchema.safeParse(req.body);
if (!result.success) {
  return res.status(400).json(result.error);
}
// result.data is now fully typed and validated
```

As Matt notes: "If these APIs are exposed to the world, anyone can ping them. If they aren't validated, many might even be vectors for attack."

## Consider Zod: Third-Party APIs

APIs you don't control can change without warning. Validation at the boundary catches drift early:

> "Validation will be thrown early, right when the data enters your app. This makes it much easier to debug and fix."

**Tradeoff:** Zod adds ~12kb gzipped. Consider whether that matters for your bundle.

## Skip Zod: Controlled Inputs

When you control both ends of the data flow (e.g., fullstack app where your frontend talks to your own backend):

- Version drift is "usually just a browser refresh away from a better experience"
- The security risk is minimal since you control the server
- The overhead of maintaining schemas for internal data isn't worth it

## Summary

| Data Source | Trust Level | Validate? |
|---|---|---|
| User input (forms, CLI, localStorage) | None | Yes |
| Public API endpoints | None | Yes |
| Third-party APIs | Low | Recommended |
| Your own backend (same deploy) | High | Usually skip |
| Internal function calls | Full | Never |
