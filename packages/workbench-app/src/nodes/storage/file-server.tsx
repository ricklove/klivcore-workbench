import { type Observable, observe } from '@legendapp/state';
import { useValue } from '@legendapp/state/react';
import { useRef, useState } from 'react';
import { NodeStandardContainer } from '../../workflow/node-types-wrapper';
import {
  WorkflowBrandedTypes,
  type WorkflowComponentSimplePropsTyped,
  type WorkflowRuntimeNodeTypeDefinition,
} from '../../workflow/types';
import { storageStore$ } from './_storage-store';

export type FileServerData = {
  prefix: string;
  url: string;
};

type FileServerRuntimeState = {
  connected: boolean;
  error: undefined | string;
};

type StorageProvider = {
  prefix: string;
  save: <T>(path: string, value: T) => Promise<void>;
  load: <T>(path: string) => Promise<T>;
  delete: (path: string) => Promise<void>;
  list: () => Promise<{ path: string }[]>;
};

export const fileServerNodeType: WorkflowRuntimeNodeTypeDefinition = {
  type: WorkflowBrandedTypes.typeName(`file-server`),
  getComponent: () => ({
    Component: NodeStandardContainer(FileServerComponent),
  }),
  inputs: [],
  outputs: [],
  load: async ({ node$, runtimeState }) => {
    const runtimeStateTyped = runtimeState as FileServerRuntimeState;
    runtimeStateTyped.connected = false;
    runtimeStateTyped.error = undefined;

    const unsub = observe(() => {
      const data = node$.data.get();
      const dataValue$ = data.getObservableBox() as Observable<
        FileServerData | undefined
      >;
      const prefix = dataValue$?.prefix?.get()?.toLowerCase();
      const url = dataValue$?.url?.get();

      if (!prefix || !url) {
        runtimeStateTyped.connected = false;
        runtimeStateTyped.error = !prefix
          ? 'Prefix is required'
          : 'URL is required';
        return;
      }

      const provider: StorageProvider = {
        prefix,
        save: async <T,>(filePath: string, value: T): Promise<void> => {
          const fullUrl = `${url}/save?path=${encodeURIComponent(filePath)}`;
          const response = await fetch(fullUrl, {
            method: 'POST',
            body: typeof value === 'string' ? value : JSON.stringify(value),
          });
          if (!response.ok) {
            const errorText = await response
              .text()
              .catch(() => 'Unknown error');
            throw new Error(`${response.status}: ${errorText}`);
          }
        },
        load: async <T,>(filePath: string): Promise<T> => {
          const fullUrl = `${url}/load?path=${encodeURIComponent(filePath)}`;
          const response = await fetch(fullUrl, { method: 'GET' });
          if (!response.ok) {
            const errorText = await response
              .text()
              .catch(() => 'Unknown error');
            throw new Error(`${response.status}: ${errorText}`);
          }
          const text = await response.text();
          // Try to parse as JSON, otherwise return as string
          try {
            return JSON.parse(text) as T;
          } catch {
            return text as T;
          }
        },
        delete: async (filePath: string): Promise<void> => {
          const fullUrl = `${url}/delete?path=${encodeURIComponent(filePath)}`;
          const response = await fetch(fullUrl, { method: 'DELETE' });
          if (!response.ok) {
            const errorText = await response
              .text()
              .catch(() => 'Unknown error');
            throw new Error(`${response.status}: ${errorText}`);
          }
        },
        list: async (): Promise<{ path: string }[]> => {
          const fullUrl = `${url}/list`;
          const response = await fetch(fullUrl, { method: 'GET' });
          if (!response.ok) {
            const errorText = await response
              .text()
              .catch(() => 'Unknown error');
            throw new Error(`${response.status}: ${errorText}`);
          }
          const files = (await response.json()) as string[];
          return files.map((f) => ({ path: f }));
        },
      };

      storageStore$.actions.registerProvider(provider);
      runtimeStateTyped.connected = true;
      runtimeStateTyped.error = undefined;
    });

    return {
      unsubscribe: () => {
        unsub();
      },
    };
  },
  execute: async () => {
    return undefined;
  },
};

const FileServerComponent = (
  props: WorkflowComponentSimplePropsTyped<
    FileServerData,
    Record<string, never>,
    Record<string, never>
  >,
) => {
  const { node$, data } = props.data;
  const data$ = data.asObservable();

  const prefix = useValue(data$.prefix) ?? '';
  const url = useValue(data$.url) ?? '';

  const runtimeState = useValue(() => {
    const rs = node$.runtimeState
      .get()
      .getDirectValue<FileServerRuntimeState>();
    return rs;
  });
  const connected = runtimeState?.connected ?? false;
  const error = runtimeState?.error;

  const [prefixValue, setPrefixValue] = useState(prefix);
  const [urlValue, setUrlValue] = useState(url);

  const initialPrefixRef = useRef(prefix);
  const initialUrlRef = useRef(url);

  if (initialPrefixRef.current !== prefix) {
    initialPrefixRef.current = prefix;
    if (prefix !== prefixValue) {
      setPrefixValue(prefix);
    }
  }
  if (initialUrlRef.current !== url) {
    initialUrlRef.current = url;
    if (url !== urlValue) {
      setUrlValue(url);
    }
  }

  const updateData = (newPrefix: string, newUrl: string) => {
    node$.data.get().setValue({
      prefix: newPrefix,
      url: newUrl,
    });
  };

  const handlePrefixChange = (newValue: string) => {
    setPrefixValue(newValue);
    updateData(newValue, urlValue);
  };

  const handleUrlChange = (newValue: string) => {
    setUrlValue(newValue);
    updateData(prefixValue, newValue);
  };

  return (
    <div className="w-full h-full p-2 flex flex-col gap-2 text-white text-xs">
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
          title={connected ? 'Connected' : (error ?? 'Disconnected')}
        />
        <span className="text-gray-400">
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {error && <div className="text-red-400 text-xs">{error}</div>}

      <label className="flex flex-col gap-1">
        <span className="text-gray-400">Prefix</span>
        <input
          type="text"
          className="bg-black/25 border border-gray-700 rounded px-2 py-1 text-white outline-none focus:border-blue-500 nodrag nowheel nopan"
          value={prefixValue}
          readOnly={!props.selected}
          onChange={(e) => handlePrefixChange(e.target.value)}
          placeholder="e.g., myserver"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-gray-400">URL</span>
        <input
          type="text"
          className="bg-black/25 border border-gray-700 rounded px-2 py-1 text-white outline-none focus:border-blue-500 nodrag nowheel nopan"
          value={urlValue}
          readOnly={!props.selected}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder="e.g., http://localhost:3000"
        />
      </label>
    </div>
  );
};
