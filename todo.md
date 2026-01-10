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
- [ ] faster direct engine
  - [ ] compute a list of all output runtime values => edge,input values (and target nodes)
  - [ ] check all output runtime values for changes (and compare to subscribing to changes)
    - [ ] filter all changed output runtime values
    - [ ] copy to target values
    - [ ] queue all target nodes that were changed
  - [ ] execute all queued nodes

- [ ] improve workflow storage
  - [ ] clone workflow server from lofr project
  - [ ] load workflow document from workflow server
