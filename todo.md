# todo

- [x] implement store
  - [x] create initial WorkflowDocumentData
  - [x] load WorkflowDocumentData into WorkflowRuntimeStore
  - [x] convert to valtio proxy
  - [x] construct ReactFlowStore view of WorkflowRuntimeStore
  - [x] serialize ReactFlowStore view to WorkflowDocumentData in localStorage
  - [x] load WorkflowDocumentData from localStorage on refresh (if it exists)
- [ ] simple workflow engine
  - [ ] on output => edge value
  - [ ] on edge value => input value
  - [ ] on input values => execute
  - [ ] after excute => output value
- [ ] improve workflow storage
  - [ ] clone workflow server from lofr project
  - [ ] load workflow document from workflow server
