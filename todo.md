# todo

- [ ] implement store
  - [x] create initial WorkflowDocumentData
  - [x] load WorkflowDocumentData into WorkflowRuntimeStore
  - [ ] convert to valtio proxy
  - [ ] construct ReactFlowStore view of WorkflowRuntimeStore
  - [ ] serialize ReactFlowStore view to WorkflowDocumentData in localStorage
  - [ ] load WorkflowDocumentData from localStorage on refresh (if it exists)
- [ ] improve workflow storage
  - [ ] clone workflow server from lofr project
  - [ ] load workflow document from workflow server
