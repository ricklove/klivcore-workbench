import { type Observable, observe } from '@legendapp/state';
import { useValue } from '@legendapp/state/react';
import { useCallback, useRef, useState } from 'react';
import { NodeStandardContainer } from '../../workflow/node-types-wrapper';
import {
  WorkflowBrandedTypes,
  type WorkflowComponentSimplePropsTyped,
  type WorkflowRuntimeNodeTypeDefinition,
} from '../../workflow/types';
import { storageStore$ } from './_storage-store';

export type TextFileData = {
  url: string;
  dataField: string;
};

type TextFileStatus =
  | { kind: 'error'; message: string }
  | { kind: 'new-file' }
  | { kind: 'unchanged' }
  | { kind: 'unsaved' }
  | { kind: 'changed-no-conflicts' }
  | { kind: 'changed-with-conflicts' };

type TextFileRuntimeState = {
  status: TextFileStatus;
  loadedFileContents: undefined | string;
  loadedFileTimestamp: undefined | number;
  lastKnownAttachedContents: undefined | string;
};

export const textFileNodeType: WorkflowRuntimeNodeTypeDefinition = {
  type: WorkflowBrandedTypes.typeName(`text-file`),
  getComponent: () => ({
    Component: NodeStandardContainer(TextFileComponent),
  }),
  inputs: [
    {
      name: WorkflowBrandedTypes.inputName(`attach`),
      type: WorkflowBrandedTypes.valueType(`string`),
    },
  ],
  outputs: [
    {
      name: WorkflowBrandedTypes.outputName(`file-contents`),
      type: WorkflowBrandedTypes.valueType(`string`),
    },
    {
      name: WorkflowBrandedTypes.outputName(`attached-contents`),
      type: WorkflowBrandedTypes.valueType(`string`),
    },
  ],
  load: async ({ node$, runtimeState, store$ }) => {
    const runtimeStateTyped = runtimeState as TextFileRuntimeState;
    runtimeStateTyped.status = { kind: 'new-file' };
    runtimeStateTyped.loadedFileContents = undefined;
    runtimeStateTyped.loadedFileTimestamp = undefined;
    runtimeStateTyped.lastKnownAttachedContents = undefined;

    const unsub = observe(() => {
      const data = node$.data.get();
      const dataValue$ = data.getObservableBox() as Observable<
        TextFileData | undefined
      >;
      const url = dataValue$?.url?.get();
      const dataField = dataValue$?.dataField?.get();

      // Get attached node
      const attachedEdge = node$.inputs[0]?.getEdge();
      const attachedNode = attachedEdge?.source.getNode();
      const attachedNodeId = attachedNode?.id;

      if (!url) {
        runtimeStateTyped.status = {
          kind: 'error',
          message: 'URL is required',
        };
        return;
      }

      // Parse URL and find provider
      const providerResult = storageStore$.getProviderWithPath(url);
      if (!providerResult?.provider) {
        runtimeStateTyped.status = {
          kind: 'error',
          message: `Provider not found for prefix in URL: ${url}`,
        };
        return;
      }

      // Get attached node's data field value
      let attachedContents: undefined | string;
      if (attachedNodeId && dataField) {
        const attachedNodeObs = store$.nodes[attachedNodeId];
        if (attachedNodeObs) {
          const attachedData = attachedNodeObs.data?.get()?.getDirectValue() as
            | Record<string, unknown>
            | undefined;
          const fieldValue = attachedData?.[dataField];
          if (typeof fieldValue === 'string') {
            attachedContents = fieldValue;
          }
        }
      }

      // Update outputs
      const node = node$.peek();
      const fileContentsOutput = node.outputs.find(
        (o) => o.name === WorkflowBrandedTypes.outputName('file-contents'),
      );
      const attachedContentsOutput = node.outputs.find(
        (o) => o.name === WorkflowBrandedTypes.outputName('attached-contents'),
      );

      if (fileContentsOutput) {
        fileContentsOutput.value.setValue(
          runtimeStateTyped.loadedFileContents ?? null,
        );
      }
      if (attachedContentsOutput) {
        attachedContentsOutput.value.setValue(attachedContents ?? null);
      }

      // Update status based on comparison
      updateStatus(runtimeStateTyped, attachedContents);
    });

    return {
      unsubscribe: () => {
        unsub();
      },
    };
  },
  execute: async ({ runtimeState }) => {
    const runtimeStateTyped = runtimeState as TextFileRuntimeState;
    return {
      outputs: {
        'file-contents': runtimeStateTyped.loadedFileContents ?? null,
        'attached-contents':
          runtimeStateTyped.lastKnownAttachedContents ?? null,
      },
    };
  },
};

const updateStatus = (
  runtimeState: TextFileRuntimeState,
  attachedContents: undefined | string,
) => {
  const { loadedFileContents, lastKnownAttachedContents } = runtimeState;

  // If we don't have loaded file contents, it's a new file
  if (loadedFileContents === undefined) {
    runtimeState.status = { kind: 'new-file' };
    return;
  }

  const attachedChanged =
    lastKnownAttachedContents !== undefined &&
    attachedContents !== lastKnownAttachedContents;
  const fileMatchesAttached = loadedFileContents === attachedContents;

  if (fileMatchesAttached) {
    runtimeState.status = { kind: 'unchanged' };
    return;
  }

  if (attachedChanged) {
    // Attached has changed, and file doesn't match attached
    // Check if file still matches what we loaded
    const fileMatchesLoaded =
      loadedFileContents === runtimeState.loadedFileContents;
    if (fileMatchesLoaded) {
      runtimeState.status = { kind: 'unsaved' };
    } else {
      runtimeState.status = { kind: 'changed-with-conflicts' };
    }
    return;
  }

  // Attached hasn't changed from what we know
  runtimeState.status = { kind: 'unsaved' };
};

const TextFileComponent = (
  props: WorkflowComponentSimplePropsTyped<
    TextFileData,
    { attach: string },
    { 'file-contents': string; 'attached-contents': string }
  >,
) => {
  const { node$, data, store$ } = props.data;
  const data$ = data.asObservable();

  const url = useValue(data$.url) ?? '';
  const dataField = useValue(data$.dataField) ?? '';

  const runtimeState = useValue(() => {
    const rs = node$.runtimeState.get().getDirectValue<TextFileRuntimeState>();
    return rs;
  });
  const status = runtimeState?.status ?? { kind: 'new-file' };

  const [urlValue, setUrlValue] = useState(url);
  const [dataFieldValue, setDataFieldValue] = useState(dataField);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<undefined | string>(undefined);

  const initialUrlRef = useRef(url);
  const initialDataFieldRef = useRef(dataField);

  if (initialUrlRef.current !== url) {
    initialUrlRef.current = url;
    if (url !== urlValue) {
      setUrlValue(url);
    }
  }
  if (initialDataFieldRef.current !== dataField) {
    initialDataFieldRef.current = dataField;
    if (dataField !== dataFieldValue) {
      setDataFieldValue(dataField);
    }
  }

  const updateData = (newUrl: string, newDataField: string) => {
    node$.data.get().setValue({
      url: newUrl,
      dataField: newDataField,
    });
  };

  const handleUrlChange = (newValue: string) => {
    setUrlValue(newValue);
    updateData(newValue, dataFieldValue);
  };

  const handleDataFieldChange = (newValue: string) => {
    setDataFieldValue(newValue);
    updateData(urlValue, newValue);
  };

  const getAttachedNodeDataField = useCallback((): undefined | string => {
    const attachedEdge = node$.peek().inputs[0]?.getEdge();
    const attachedNode = attachedEdge?.source.getNode();
    if (!attachedNode) {
      return undefined;
    }
    const attachedNodeObs = store$.nodes[attachedNode.id];
    if (!attachedNodeObs) {
      return undefined;
    }
    const attachedData = attachedNodeObs.data?.peek()?.getDirectValue() as
      | Record<string, unknown>
      | undefined;
    const field = data$.dataField.peek() ?? '';
    const fieldValue = attachedData?.[field];
    return typeof fieldValue === 'string' ? fieldValue : undefined;
  }, [node$, store$, data$]);

  const setAttachedNodeDataField = useCallback(
    (value: string) => {
      const attachedEdge = node$.peek().inputs[0]?.getEdge();
      const attachedNode = attachedEdge?.source.getNode();
      if (!attachedNode) {
        return;
      }
      const attachedNodeObs = store$.nodes[attachedNode.id];
      if (!attachedNodeObs) {
        return;
      }
      const currentData = attachedNodeObs.data?.peek()?.getDirectValue() as
        | Record<string, unknown>
        | undefined;
      const field = data$.dataField.peek() ?? '';
      attachedNodeObs.data?.peek()?.setValue({
        ...currentData,
        [field]: value,
      });
    },
    [node$, store$, data$],
  );

  const handleLoad = useCallback(async () => {
    const currentUrl = data$.url.peek() ?? '';
    if (!currentUrl) {
      setMessage('URL is required');
      return;
    }

    const providerResult = storageStore$.getProviderWithPath(currentUrl);
    if (!providerResult?.provider) {
      setMessage(`Provider not found for: ${currentUrl}`);
      return;
    }

    setIsLoading(true);
    setMessage(undefined);

    try {
      const contents = await providerResult.provider
        .peek()
        .load<string>(providerResult.path);
      const runtimeStateValue = node$.runtimeState.peek().getDirectValue() as
        | TextFileRuntimeState
        | undefined;
      if (runtimeStateValue) {
        runtimeStateValue.loadedFileContents = contents;
        runtimeStateValue.loadedFileTimestamp = Date.now();
        runtimeStateValue.lastKnownAttachedContents = contents;
      }

      // Set attached node's data field
      setAttachedNodeDataField(contents);

      // Update file-contents output
      const node = node$.peek();
      const fileContentsOutput = node.outputs.find(
        (o) => o.name === WorkflowBrandedTypes.outputName('file-contents'),
      );
      if (fileContentsOutput) {
        fileContentsOutput.value.setValue(contents);
      }

      setMessage('Loaded successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      if (errorMessage.includes('Not Found') || errorMessage.includes('404')) {
        setMessage('File not found (new file)');
        const runtimeStateValue = node$.runtimeState.peek().getDirectValue() as
          | TextFileRuntimeState
          | undefined;
        if (runtimeStateValue) {
          runtimeStateValue.loadedFileContents = undefined;
          runtimeStateValue.status = { kind: 'new-file' };
        }
      } else {
        setMessage(`Load error: ${errorMessage}`);
      }
    } finally {
      setIsLoading(false);
    }
  }, [data$, node$, setAttachedNodeDataField]);

  const handleSave = useCallback(
    async (force = false) => {
      const currentUrl = data$.url.peek() ?? '';
      if (!currentUrl) {
        setMessage('URL is required');
        return;
      }

      const providerResult = storageStore$.getProviderWithPath(currentUrl);
      if (!providerResult?.provider) {
        setMessage(`Provider not found for: ${currentUrl}`);
        return;
      }

      setIsSaving(true);
      setMessage(undefined);

      try {
        // First reload to check for conflicts (unless forcing)
        if (!force) {
          try {
            const currentFileContents = await providerResult.provider
              .peek()
              .load<string>(providerResult.path);
            const runtimeStateValue = node$.runtimeState
              .peek()
              .getDirectValue() as TextFileRuntimeState | undefined;
            if (
              runtimeStateValue?.loadedFileContents !== undefined &&
              currentFileContents !== runtimeStateValue.loadedFileContents
            ) {
              setMessage(
                'File has changed since load. Use "Save (Overwrite)" to force.',
              );
              if (runtimeStateValue) {
                const attachedContents = getAttachedNodeDataField();
                if (attachedContents !== undefined) {
                  runtimeStateValue.status =
                    attachedContents !==
                    runtimeStateValue.lastKnownAttachedContents
                      ? { kind: 'changed-with-conflicts' }
                      : { kind: 'changed-no-conflicts' };
                }
              }
              setIsSaving(false);
              return;
            }
          } catch {
            // File doesn't exist, ok to save
          }
        }

        const attachedContents = getAttachedNodeDataField();
        if (attachedContents === undefined) {
          setMessage('No attached content to save');
          setIsSaving(false);
          return;
        }

        await providerResult.provider
          .peek()
          .save(providerResult.path, attachedContents);

        const runtimeStateValue = node$.runtimeState.peek().getDirectValue() as
          | TextFileRuntimeState
          | undefined;
        if (runtimeStateValue) {
          runtimeStateValue.loadedFileContents = attachedContents;
          runtimeStateValue.loadedFileTimestamp = Date.now();
          runtimeStateValue.lastKnownAttachedContents = attachedContents;
          runtimeStateValue.status = { kind: 'unchanged' };
        }

        // Update file-contents output
        const node = node$.peek();
        const fileContentsOutput = node.outputs.find(
          (o) => o.name === WorkflowBrandedTypes.outputName('file-contents'),
        );
        if (fileContentsOutput) {
          fileContentsOutput.value.setValue(attachedContents);
        }

        setMessage('Saved successfully');
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error';
        setMessage(`Save error: ${errorMessage}`);
      } finally {
        setIsSaving(false);
      }
    },
    [data$, node$, getAttachedNodeDataField],
  );

  const statusDisplay = getStatusDisplay(status);
  const showOverwriteLoad =
    status.kind === 'unsaved' ||
    status.kind === 'changed-with-conflicts' ||
    status.kind === 'changed-no-conflicts';
  const showOverwriteSave =
    status.kind === 'changed-with-conflicts' ||
    status.kind === 'changed-no-conflicts';

  return (
    <div className="w-full h-full p-2 flex flex-col gap-2 text-white text-xs overflow-auto">
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${statusDisplay.color}`}
          title={statusDisplay.title}
        />
        <span className="text-gray-400">{statusDisplay.label}</span>
      </div>

      {message && (
        <div
          className={`text-xs p-1 rounded ${message.includes('error') || message.includes('Error') ? 'bg-red-900/50 text-red-300' : 'bg-blue-900/50 text-blue-300'}`}
        >
          {message}
        </div>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-gray-400">URL (prefix/path)</span>
        <input
          type="text"
          className="bg-black/25 border border-gray-700 rounded px-2 py-1 text-white outline-none focus:border-blue-500 nodrag nowheel nopan"
          value={urlValue}
          readOnly={!props.selected}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder="e.g., myserver/path/to/file.txt"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-gray-400">Data Field</span>
        <input
          type="text"
          className="bg-black/25 border border-gray-700 rounded px-2 py-1 text-white outline-none focus:border-blue-500 nodrag nowheel nopan"
          value={dataFieldValue}
          readOnly={!props.selected}
          onChange={(e) => handleDataFieldChange(e.target.value)}
          placeholder="e.g., value"
        />
      </label>

      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          className="px-2 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white nodrag nowheel nopan"
          onClick={() => handleLoad()}
          disabled={isLoading || isSaving}
        >
          {isLoading
            ? 'Loading...'
            : showOverwriteLoad
              ? 'Load (Overwrite)'
              : 'Load'}
        </button>

        <button
          type="button"
          className={`px-2 py-1 ${showOverwriteSave ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'} disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white nodrag nowheel nopan`}
          onClick={() => handleSave(showOverwriteSave)}
          disabled={isLoading || isSaving}
        >
          {isSaving
            ? 'Saving...'
            : showOverwriteSave
              ? 'Save (Overwrite)'
              : 'Save'}
        </button>
      </div>
    </div>
  );
};

const getStatusDisplay = (
  status: TextFileStatus,
): { label: string; color: string; title: string } => {
  switch (status.kind) {
    case 'error':
      return {
        label: 'Error',
        color: 'bg-red-500',
        title: status.message,
      };
    case 'new-file':
      return {
        label: 'New File',
        color: 'bg-yellow-500',
        title: 'File was not found',
      };
    case 'unchanged':
      return {
        label: 'Unchanged',
        color: 'bg-green-500',
        title: 'File matches attached content',
      };
    case 'unsaved':
      return {
        label: 'Unsaved',
        color: 'bg-orange-500',
        title: 'Attached content has changed since file was loaded',
      };
    case 'changed-no-conflicts':
      return {
        label: 'File Changed',
        color: 'bg-blue-500',
        title: 'File has changed but attached content has not',
      };
    case 'changed-with-conflicts':
      return {
        label: 'Conflicts',
        color: 'bg-red-500',
        title: 'File and attached content have both changed',
      };
  }
};
