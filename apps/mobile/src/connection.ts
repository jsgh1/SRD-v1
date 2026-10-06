import {NativeModules} from 'react-native';

type SavedConnection = {origin: string; code: string};
type ConnectionModule = {
  load(): Promise<SavedConnection>;
  save(origin: string, code: string): Promise<void>;
  clear(): Promise<void>;
};

const nativeConnection = (): ConnectionModule | undefined => NativeModules.SrdConnection as ConnectionModule | undefined;

export const connectionStore = {
  load: (): Promise<SavedConnection> => nativeConnection()?.load() ?? Promise.resolve({origin: '', code: ''}),
  save: (origin: string, code: string): Promise<void> => nativeConnection()?.save(origin, code) ?? Promise.resolve(),
  clear: (): Promise<void> => nativeConnection()?.clear() ?? Promise.resolve(),
};
