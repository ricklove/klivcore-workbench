# todo

- [x] implement store
  - [x] create initial WorkflowDocumentData
  - [x] load WorkflowDocumentData into WorkflowRuntimeStore
  - [x] convert to valtio proxy
  - [x] construct ReactFlowStore view of WorkflowRuntimeStore
  - [x] serialize ReactFlowStore view to WorkflowDocumentData in localStorage
  - [x] load WorkflowDocumentData from localStorage on refresh (if it exists)
- [x] simple workflow engine
  - [x] on output => edges => inputs
  - [x] on input values => execute
  - [x] after excute => output value
- [x] faster direct engine
  - [x] compute a list of all output runtime values => edge,input values (and target nodes)
  - [x] check all output runtime values for changes (and compare to subscribing to changes)
    - [x] filter all changed output runtime values
    - [x] copy to target values
    - [x] queue all target nodes that were changed
  - [x] execute all queued nodes
- [ ] fix structural change bugs
  - [x] fix delete edge
  - [x] fix delete node
  - [ ] fix add edge bug
  - [ ] fix add node
  - [ ] fix rename id bug

- [ ] improve workflow storage
  - [ ] clone workflow server from lofr project
  - [ ] load workflow document from workflow server
