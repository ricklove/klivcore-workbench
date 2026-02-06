import type { Observable } from '@legendapp/state';

import { useObservable, useObserve, useValue } from '@legendapp/state/react';
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
  syncEnabled: boolean;
};

type TextFileStatus =
  | { kind: 'error'; message: string }
  | { kind: 'new-file' }
  | { kind: 'unchanged' }
  | { kind: 'unsaved' }
  | { kind: 'changed-no-conflicts' }
  | { kind: 'changed-with-conflicts' };

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
  execute: async () => {
    return { outputs: {} };
  },
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

  const url = useValue(() => data$.url.get()) ?? '';
  const dataField = useValue(() => data$.dataField.get()) ?? '';
  const syncEnabled = useValue(() => data$.syncEnabled.get()) ?? false;

  // Local observable state for file tracking
  const localState$ = useObservable({
    loadedFileContents: undefined as string | undefined,
    lastKnownAttachedContents: undefined as string | undefined,
    syncPaused: false, // Paused when overwrite detected
  });

  // Reactively get the attached node's data field value
  const attachedValue = useValue(() => {
    const currentDataField = data$.dataField.get();
    if (!currentDataField) return undefined;

    const attachedEdge = node$.inputs[0]?.getEdge();
    const attachedNode = attachedEdge?.source.getNode();
    if (!attachedNode) return undefined;

    const attachedNodeObs = store$.nodes[attachedNode.id];
    if (!attachedNodeObs) return undefined;

    const attachedData$ = attachedNodeObs.data?.get()?.getObservableBox() as
      | Observable<Record<string, unknown>>
      | undefined;
    const fieldValue = attachedData$?.[currentDataField]?.get();
    return typeof fieldValue === 'string' ? fieldValue : undefined;
  });

  // Compute status reactively
  const loadedFileContents = useValue(localState$.loadedFileContents);
  const syncPaused = useValue(localState$.syncPaused);
  const status: TextFileStatus = (() => {
    if (!url) return { kind: 'error', message: 'URL is required' };
    if (!dataField) return { kind: 'error', message: 'Data Field is required' };

    const providerResult = storageStore$.getProviderWithPath(url);
    if (!providerResult?.provider) {
      return { kind: 'error', message: `Provider not found for: ${url}` };
    }

    if (loadedFileContents === undefined) return { kind: 'new-file' };
    if (loadedFileContents === attachedValue) return { kind: 'unchanged' };
    return { kind: 'unsaved' };
  })();

  const [urlValue, setUrlValue] = useState(url);
  const [dataFieldValue, setDataFieldValue] = useState(dataField);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | undefined>(undefined);

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

  const setAttachedNodeDataField = useCallback(
    (value: string) => {
      const field = data$.dataField.peek();
      if (!field) return;

      const attachedEdge = node$.peek().inputs[0]?.getEdge();
      const attachedNode = attachedEdge?.source.getNode();
      if (!attachedNode) return;

      const attachedNodeObs = store$.nodes[attachedNode.id];
      if (!attachedNodeObs) return;

      const runtimeValue = attachedNodeObs.data?.peek();
      if (!runtimeValue) return;

      const attachedNodeData$ = runtimeValue.getObservableBox() as Observable<
        Record<string, unknown>
      >;
      const fieldObs = attachedNodeData$[field];
      if (fieldObs) {
        fieldObs.set(value);
      }
    },
    [node$, store$, data$],
  );

  const handleLoad = useCallback(
    async (force = false) => {
      const currentUrl = data$.url.peek();
      if (!currentUrl) {
        setMessage('URL is required');
        return;
      }

      const currentDataField = data$.dataField.peek();
      if (!currentDataField) {
        setMessage('Data Field is required');
        return;
      }

      const providerResult = storageStore$.getProviderWithPath(currentUrl);
      if (!providerResult?.provider) {
        setMessage(`Provider not found for: ${currentUrl}`);
        return;
      }

      // Check if attached contents have unsaved changes (unless forcing)
      if (!force) {
        const currentLoaded = localState$.loadedFileContents.peek();
        if (currentLoaded !== undefined && attachedValue !== currentLoaded) {
          setMessage(
            'Attached content has unsaved changes. Use "Load (Overwrite)" to discard.',
          );
          localState$.syncPaused.set(true);
          return;
        }
      }

      // Resume sync if it was paused
      localState$.syncPaused.set(false);

      setIsLoading(true);
      setMessage(undefined);

      try {
        const contents = await providerResult.provider
          .peek()
          .load<string>(providerResult.path);

        localState$.loadedFileContents.set(contents);
        localState$.lastKnownAttachedContents.set(contents);

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
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error';
        if (
          errorMessage.includes('Not Found') ||
          errorMessage.includes('404')
        ) {
          setMessage('File not found (new file)');
          localState$.loadedFileContents.set(undefined);
        } else {
          setMessage(`Load error: ${errorMessage}`);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [data$, node$, localState$, attachedValue, setAttachedNodeDataField],
  );

  const handleSave = useCallback(
    async (force = false) => {
      const currentUrl = data$.url.peek();
      if (!currentUrl) {
        setMessage('URL is required');
        return;
      }

      const currentDataField = data$.dataField.peek();
      if (!currentDataField) {
        setMessage('Data Field is required');
        return;
      }

      const providerResult = storageStore$.getProviderWithPath(currentUrl);
      if (!providerResult?.provider) {
        setMessage(`Provider not found for: ${currentUrl}`);
        return;
      }

      if (attachedValue === undefined) {
        setMessage('No attached content to save');
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
            const currentLoaded = localState$.loadedFileContents.peek();
            if (
              currentLoaded !== undefined &&
              currentFileContents !== currentLoaded
            ) {
              setMessage(
                'File has changed since load. Use "Save (Overwrite)" to force.',
              );
              localState$.syncPaused.set(true);
              setIsSaving(false);
              return;
            }
          } catch {
            // File doesn't exist, ok to save
          }
        }

        await providerResult.provider
          .peek()
          .save(providerResult.path, attachedValue);

        localState$.loadedFileContents.set(attachedValue);
        localState$.lastKnownAttachedContents.set(attachedValue);
        localState$.syncPaused.set(false);

        // Update file-contents output
        const node = node$.peek();
        const fileContentsOutput = node.outputs.find(
          (o) => o.name === WorkflowBrandedTypes.outputName('file-contents'),
        );
        if (fileContentsOutput) {
          fileContentsOutput.value.setValue(attachedValue);
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
    [data$, node$, localState$, attachedValue],
  );

  // Debounced save for sync
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper to get attached value reactively
  const getAttachedValueReactive = () => {
    const currentDataField = data$.dataField.get();
    if (!currentDataField) return undefined;

    const attachedEdge = node$.inputs[0]?.getEdge();
    const attachedNode = attachedEdge?.source.getNode();
    if (!attachedNode) return undefined;

    const attachedNodeObs = store$.nodes[attachedNode.id];
    if (!attachedNodeObs) return undefined;

    const attachedData$ = attachedNodeObs.data?.get()?.getObservableBox() as
      | Observable<Record<string, unknown>>
      | undefined;
    const fieldValue = attachedData$?.[currentDataField]?.get();
    return typeof fieldValue === 'string' ? fieldValue : undefined;
  };

  // Initial sync check - load file and compare with attached value
  const handleInitialSync = useCallback(async () => {
    const currentUrl = data$.url.peek();
    if (!currentUrl) return;

    const currentDataField = data$.dataField.peek();
    if (!currentDataField) return;

    const providerResult = storageStore$.getProviderWithPath(currentUrl);
    if (!providerResult?.provider) return;

    // Get current attached value
    const attachedEdge = node$.peek().inputs[0]?.getEdge();
    const attachedNode = attachedEdge?.source.getNode();
    let currentAttached: string | undefined;
    if (attachedNode) {
      const attachedNodeObs = store$.nodes[attachedNode.id];
      if (attachedNodeObs) {
        const attachedData = attachedNodeObs.data?.peek()?.getDirectValue() as
          | Record<string, unknown>
          | undefined;
        const fieldValue = attachedData?.[currentDataField];
        if (typeof fieldValue === 'string') {
          currentAttached = fieldValue;
        }
      }
    }

    try {
      const fileContents = await providerResult.provider
        .peek()
        .load<string>(providerResult.path);

      // Store what's on disk
      localState$.loadedFileContents.set(fileContents);
      localState$.lastKnownAttachedContents.set(currentAttached);

      // If they match, we're good - sync can proceed
      if (fileContents === currentAttached) {
        setMessage('Sync enabled - file matches');
        return;
      }

      // They differ - pause sync and let user choose direction
      localState$.syncPaused.set(true);
      setMessage('File and attached content differ. Choose which to keep.');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      if (errorMessage.includes('Not Found') || errorMessage.includes('404')) {
        // File doesn't exist - that's fine, we'll create it on first save
        localState$.loadedFileContents.set(undefined);
        setMessage('Sync enabled - new file will be created');
      } else {
        localState$.syncPaused.set(true);
        setMessage(`Sync error: ${errorMessage}`);
      }
    }
  }, [data$, node$, store$, localState$]);

  // Auto-sync: initial check on enable, save on change (debounced)
  useObserve(() => {
    const isSyncEnabled = data$.syncEnabled.get();
    const isPaused = localState$.syncPaused.get();
    const currentAttachedValue = getAttachedValueReactive();
    const currentLoadedContents = localState$.loadedFileContents.get();

    if (!isSyncEnabled || isPaused) {
      // Clear any pending save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      return;
    }

    // If we haven't loaded yet, do initial sync check
    if (currentLoadedContents === undefined) {
      handleInitialSync();
      return;
    }

    // If attached value changed, save with debounce
    if (
      currentAttachedValue !== undefined &&
      currentAttachedValue !== currentLoadedContents
    ) {
      // Clear previous timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // Debounce save by 500ms
      saveTimeoutRef.current = setTimeout(() => {
        saveTimeoutRef.current = null;
        handleSave(false);
      }, 500);
    }
  });

  const handleToggleSync = useCallback(() => {
    const current = data$.syncEnabled.peek() ?? false;
    node$.data.get().setValue({
      url: data$.url.peek() ?? '',
      dataField: data$.dataField.peek() ?? '',
      syncEnabled: !current,
    });
    // Reset pause state when toggling
    if (!current) {
      localState$.syncPaused.set(false);
    }
  }, [node$, data$, localState$]);

  const statusDisplay = getStatusDisplay(status);
  const showOverwriteLoad =
    status.kind === 'unsaved' || (syncEnabled && syncPaused);
  const showOverwriteSave =
    syncEnabled && syncPaused && loadedFileContents !== undefined;

  return (
    <div className="w-full h-full p-2 flex flex-col gap-2 text-white text-xs overflow-auto">
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${statusDisplay.color}`}
          title={statusDisplay.title}
        />
        <span className="text-gray-400">{statusDisplay.label}</span>
      </div>

      {!dataFieldValue && (
        <div className="text-xs p-1 rounded bg-yellow-900/50 text-yellow-300">
          Data Field is required
        </div>
      )}

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

      <label className="flex items-center gap-2 cursor-pointer nodrag nowheel nopan">
        <input
          type="checkbox"
          checked={syncEnabled}
          onChange={handleToggleSync}
          className="w-4 h-4"
        />
        <span className="text-gray-400">
          Sync {syncEnabled && syncPaused && '(paused)'}
        </span>
      </label>

      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          className={`px-2 py-1 ${showOverwriteLoad ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'} disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white nodrag nowheel nopan`}
          onClick={() => handleLoad(showOverwriteLoad)}
          disabled={isLoading || isSaving}
        >
          {isLoading
            ? 'Loading...'
            : showOverwriteLoad
              ? '⚠ Load (Overwrite)'
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
              ? '⚠ Save (Overwrite)'
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
