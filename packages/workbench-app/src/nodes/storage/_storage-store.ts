import { ObservableHint, observable, type PlainObject } from '@legendapp/state';

/** Global registry of storage providers */
export const storageStore$ = observable({
  providers: [] as PlainObject<{
    prefix: string;
    getUrl?: (path: string) => string;
    save: <T>(path: string, value: T) => Promise<void>;
    load: <T>(path: string) => Promise<T>;
    delete: (path: string) => Promise<void>;
    list: () => Promise<{ path: string }[]>;
  }>[],
  getProviderWithPath: (fullPath: string) => {
    const [prefix, ...rest] = fullPath.split('/');
    if (!prefix) {
      return undefined;
    }
    const path = rest.join('/');
    const prefixLower = prefix.toLowerCase().replace(/^@/, '');
    const provider = storageStore$.providers.find(
      (p) => p.prefix.get() === prefixLower,
    );
    return { provider, path };
  },
  actions: ObservableHint.plain({
    registerProvider: (provider: {
      prefix: string;
      save: <T>(path: string, value: T) => Promise<void>;
      load: <T>(path: string) => Promise<T>;
      delete: (path: string) => Promise<void>;
      list: () => Promise<{ path: string }[]>;
    }) => {
      provider.prefix = provider.prefix.toLowerCase();
      const existingIndex = storageStore$.providers
        .peek()
        .findIndex((p) => p.prefix === provider.prefix);
      if (existingIndex !== -1) {
        // Replace existing provider
        storageStore$.providers[existingIndex]?.set(
          ObservableHint.plain(provider),
        );
      } else {
        // Add new provider
        storageStore$.providers.push(ObservableHint.plain(provider));
      }
    },
  }),
});

const shouldRegisterLocalStorage = true;
if (shouldRegisterLocalStorage) {
  storageStore$.actions.registerProvider({
    prefix: 'localStorage',
    save: async <T>(path: string, value: T) => {
      localStorage.setItem(path, JSON.stringify(value));
    },
    load: async <T>(path: string) => {
      const item = localStorage.getItem(path);
      if (!item) throw new Error('Not Found');
      return JSON.parse(item) as T;
    },
    delete: async (path: string) => {
      localStorage.removeItem(path);
    },
    list: async () => {
      const items: { path: string }[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          items.push({ path: key });
        }
      }
      return items;
    },
  });
}
