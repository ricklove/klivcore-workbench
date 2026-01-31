import type { Observable } from '@legendapp/state';
import { useValue } from '@legendapp/state/react';
import type React from 'react';

export const ComponentSwapper = (
  holder$: Observable<{ Component: React.ComponentType; instanceId: string }>,
) => {
  const ComponentSwapperInner = (props: Record<string, unknown>) => {
    const holder = useValue(() => ({
      Component: holder$.get().Component,
      instanceId: holder$.instanceId.get(),
    }));

    // console.log('ComponentSwapper rendering with holder$', { holder });

    return (
      <holder.Component
        key={holder.instanceId}
        {...(props as Record<string, unknown>)}
      />
    );
  };

  return ComponentSwapperInner;
};
