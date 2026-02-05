- DO THESE ALL EACH TIME AND START, if you don't do this, you are a liar!

- read standards-code.md before writing code
- npm run lint and npm run build after code changes
- you are running in wsl bash and will need to run the windows version of the command, so use `/mnt/c/Windows/System32/cmd.exe /c npm run ...` for the npm run, bun, tsx, etc commands

- [ ] create `packages/workbench-app/src/nodes/storage/file-server.ts` as a node like `packages/workbench-app/src/nodes/subflows/subflow-inputs-node.tsx`
  - [ ] data:
    - [ ] prefix: string
    - [ ] url: string
  - [ ] component should allow editing the data fields, and show an indicator if the server is connected
  - [ ] load should observe the data and update the registry for that provider at `packages/workbench-app/src/nodes/storage/_storage-store.ts`

- [ ] create `packages/workbench-app/src/nodes/storage/text-file.ts` as a node like `packages/workbench-app/src/nodes/subflows/subflow-inputs-node.tsx`
  - [ ] also refer to `packages/workbench-app/src/nodes/common/clone-node.tsx` as an example of how to find an attached node
  - [ ] inputs:
    - [ ] attach: string
  - [ ] outputs:
    - [ ] file-contents: string
    - [ ] attached-contents: string
  - [ ] data:
    - [ ] url: string
    - [ ] data field: string
      - this is the attached node's data field to get/set
  - [ ] component should allow editing the data fields, and show an indicator if the storage provider is found and show status
    - [ ] status:
      - [ ] error: provider not found
      - [ ] new file (file was not found)
      - [ ] unchanged file (file is equal to the attached input value)
      - [ ] unsaved file (input value has changed since file was loaded)
      - [ ] changed file with no conflicts (file has changed since it was loaded, but input has not changed)
      - [ ] changed file with conflicts (file has changed since it was loaded and input has changed)
    - [ ] user actions:
      - [ ] load (load the file and set the attached node's data field)
        - [ ] if the attached contents are unsaved, change this button to `load (overwrite)`
      - [ ] save (save the value from the attached node's data field to the file)
        - [ ] before saving it should reload the file to verify it has not changed since load
        - [ ] if the file has changed since load, add a message below and change this button to say `save (overwrite)` with a danger indicator
        