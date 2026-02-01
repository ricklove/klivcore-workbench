- DO THESE ALL EACH TIME AND START, if you don't do this, you are a liar!

- read standards-code.md before writing code
- npm run lint and npm run build after code changes
- you are running in wsl bash and will need to run the windows version of the command, so use `/mnt/c/Windows/System32/cmd.exe /c npm run ...` for the npm run, bun, tsx, etc commands

- [ ] move StringNodeComponent and WorkflowBrandedTypes.typeName(`string`) to `packages/workbench-app/src/nodes/common/_common-nodes.tsx` like `numberInputNodeType`
- [ ] move JsonNodeComponent and WorkflowBrandedTypes.typeName(`json`) to `packages/workbench-app/src/nodes/common/_common-nodes.tsx` like `numberInputNodeType`
- [ ] move RerouteComponent and WorkflowBrandedTypes.typeName(`reroute`) to `packages/workbench-app/src/nodes/common/_common-nodes.tsx` like `numberInputNodeType`