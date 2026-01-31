# Code Standards

- No any: Code is completely typed; strictly no use of any or escapes from the type system.
- Early Returns: Always use early returns; strictly avoid nested logic blocks.
- Floating Promises: Always await promises or explicitly handle catch blocks. Unhandled promises cause instability.
- Index Safety: Array/Object indexing is checked and handled safely. Accessing without checks causes crashes.
- Type Casting Safety: When type casting always use a partial type 'as { maybe?: string }' to prevent runtime lies.
- Immutability: Treat data as immutable by default. Mutation leads to unpredictable state bugs.
- Input Paranoia: Never trust function inputs at the boundary. Validate early.
- Error Handling: Never swallow errors. Catch, Log (with context), and User-Face (if needed).
- Null vs Undefined: Prefer undefined; use null only when specifically needed to reset values (or for JSON compatibility).
- Union Ordering: Place undefined at the start of the union (e.g., undefined | string) for visibility.
- Named References: A string that references an object should have a suitable suffix: i.e. `branchName`, `userId`, not just `user`.
- Avoid Else: Avoid else blocks; rely on early returns.
- Variable Scoping: Prefer const and tight scopes.
- Short Functions: Use const lambda declarations.
- Large/Top-Level Functions: Use standard function syntax.
- Ternaries: Chained ternaries are permitted only if the chain is flat.
- Filenames: Use kebab-case (e.g., my-feature-utils.ts).

- Collocation is king: code should be declared as near as possible to where it is used (especially if used only once, but in a farther scope if used in many places)