# Essential Patterns

> Source: [Four Essential TypeScript Patterns You Can't Work Without](https://www.totaltypescript.com/four-essential-typescript-patterns) — Matt Pocock

## 1. Branded Types

Create **validation boundaries** by tagging base types with a unique label. Prevents mixing validated and unvalidated values of the same underlying type.

```typescript
type Brand<T, TBrand extends string> = T & { __brand: TBrand };

type Password = Brand<string, "Password">;
type Email = Brand<string, "Email">;

function validatePassword(input: string): Password {
  if (input.length < 8) throw new Error("Too short");
  return input as Password;
}

function login(email: Email, password: Password) {
  // Both values are guaranteed to have been validated
}

// login("user@test.com", "short") — Error! Raw strings are not Password/Email
```

**When to use:** Anywhere you need to ensure a value has passed through validation — passwords, emails, sanitized HTML, monetary amounts, database IDs.

## 2. Globals

Understand and manage TypeScript's **global type scope** for typing JavaScript globals like `process.env`, `window`, or custom global functions.

```typescript
declare global {
  function myGlobalFunc(): boolean;
  var myGlobalVar: number;
}

// Now available everywhere without imports
console.log(myGlobalVar);
myGlobalFunc();
```

**Practical use — strongly typing `process.env`:**

```typescript
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DATABASE_URL: string;
      API_KEY: string;
      NODE_ENV: "development" | "production" | "test";
    }
  }
}

// process.env.DATABASE_URL is now typed as string (not string | undefined)
```

## 3. Assertion Functions & Type Predicates

Both patterns improve TypeScript's ability to narrow types.

### Type Predicates

Narrow types within conditionals using `is`:

```typescript
const values = ["a", "b", undefined, "c", undefined];

const filtered = values.filter((v): v is string => Boolean(v));
// string[] — TypeScript knows undefined was removed
```

### Assertion Functions

Enforce type guarantees or throw errors using `asserts`:

```typescript
function assertIsString(value: unknown): asserts value is string {
  if (typeof value !== "string") {
    throw new Error(`Expected string, got ${typeof value}`);
  }
}

function process(input: unknown) {
  assertIsString(input);
  // input is narrowed to string from here on
  console.log(input.toUpperCase());
}
```

**Key difference:** Predicates return `boolean` and work in `if`/`filter`. Assertions return `void` and narrow the type for all subsequent code in the scope.

## 4. Classes (for Library APIs)

Classes enable the **builder pattern** and self-typing structures — particularly useful in library code.

```typescript
class SDK {
  loggedInUser?: User;

  constructor(loggedInUser?: User) {
    this.loggedInUser = loggedInUser;
  }

  assertIsLoggedIn(): asserts this is this & { loggedInUser: User } {
    if (!this.loggedInUser) {
      throw new Error("Not logged in");
    }
  }
}

const sdk = new SDK();
sdk.assertIsLoggedIn();
// sdk.loggedInUser is now User (not User | undefined)
```

**When to use:** Libraries and SDKs where you need fluent APIs, chainable methods, or internal type refinement. This pattern powers libraries like tRPC.
