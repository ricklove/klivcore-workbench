- DO THESE ALL EACH TIME AND START, if you don't do this, you are a liar!

- read standards-code.md before writing code
- npm run lint and npm run build after code changes
- you are running in wsl bash and will need to run the windows version of the command, so use `/mnt/c/Windows/System32/cmd.exe /c npm run ...` for the npm run, bun, tsx, etc commands

- [x] create `packages/workbench-app/src/nodes/subflows/_subflow-nodes.tsx` like `packages/workbench-app/src/nodes/common/_common-nodes.tsx`
- [x] add `packages/workbench-app/src/nodes/subflows/subflow-inputs-node.tsx`
- [x] add `packages/workbench-app/src/nodes/subflows/subflow-outputs-node.tsx`
- [x] add `packages/workbench-app/src/nodes/subflows/subflow-ui-node.tsx`
- [x] add `packages/workbench-app/src/nodes/subflows/subflow-instance-node.tsx`
- [x] make these all have an empty node component that doesn't do anything yet, but base it on `packages/workbench-app/src/nodes/common/string-input-node.tsx`

- [ ] add `packages/workbench-app/src/nodes/subflows/components/field-editor.tsx`
    - [ ] this edits a legend state prop: `fields:{name:string, type:string}[]`
    - [ ] allow switching to json editor (as tab)
    - [ ] add/delete rows
    - [ ] edit name,type strings
    - [ ] verify names are variable name safe (js rules)
    - [ ] add a function to check valid type syntax `verifyTypescriptSyntax` in `packages/workbench-app/src/code-tools/swc-tools.ts`
    - [ ] use `verifyTypescriptSyntax` to check field types
    - [ ] use `verifyTypescriptSyntax` to check whole set is valid:
        
```ts
export type testFileds = {
    ${fields.map(f=>`${f.name}: ${f.type}`).join(`;\n`)}
}

```
