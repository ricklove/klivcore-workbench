import type { Observable } from '@legendapp/state';
import { useValue } from '@legendapp/state/react';
import type React from 'react';

export const ComponentSwapper = (
  holder$: Observable<{ Component: React.ComponentType; instanceId: string }>,
) => {
  return (props: Record<string, unknown>) => {
    console.log('ComponentSwapper rendering with holder$', { holder: holder$.peek() });

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const holder = useValue(() => ({
      Component: holder$.get().Component,
      instanceId: holder$.instanceId.get(),
    }));
    return <holder.Component key={holder.instanceId} {...(props as Record<string, unknown>)} />;
  };
};
