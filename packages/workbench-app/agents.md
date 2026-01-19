code should be in typescript, completely and fully typed (never use 'any' or escape from the type system), also strict mode is on and indexing must always be checked. 
Always prefer early returns and never nested logic. 
Prefer const 
Chained Ternaries are fine as long as the chain is flat (one condition at a time, etc).
file-names-use-kebab-case
In types, prefer `undefined |` at the front of the type instead of the end
prefer undefined and use null only when needed to reset values (like in json)
avoid else, instead use early return
for functions, prefer const lambda declarations if short, only use function syntax for large functions and top level declarations.
for types, use interface unless working with type algebra