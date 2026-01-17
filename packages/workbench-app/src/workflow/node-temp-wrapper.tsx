import { useEffect, useState } from 'react';
import { WorkflowNodeWrapperSimple } from './node-wrapper';
import type { WorkflowComponentProps_Obs } from './types';
import { useValue } from '@legendapp/state/react';
import { ErrorBoundary } from './error-boundary';

export const TempWrapper = (props: WorkflowComponentProps_Obs) => {
  const importPath = useValue(() =>
    props.data.node$.inputs
      .find((x) => x.name.get() === 'importPath')
      ?.value?.get()
      .getUiValue<string>(),
  );

  const [ComponentObj, setComponentObj] = useState(
    undefined as undefined | { Component: React.ComponentType } | { error: { message: string } },
  );
  useEffect(() => {
    if (!importPath) {
      setComponentObj({ error: { message: `No importPath provided` } });
      return;
    }
    (async () => {
      try {
        const module = await import(importPath);
        setComponentObj({
          Component: () => <module.Component {...module.defaultProps} />,
        });
      } catch (error) {
        console.error('Error loading component:', error);
        setComponentObj({ error: { message: (error as Error).message } });
      }
    })();
  }, [importPath]);

  return (
    <>
      <WorkflowNodeWrapperSimple {...props}>
        <div>
          {ComponentObj && 'Component' in ComponentObj && (
            <ErrorBoundary message={`Error rendering Component`}>
              <ComponentObj.Component />
            </ErrorBoundary>
          )}
          {ComponentObj && 'error' in ComponentObj && (
            <div>Error loading component: {ComponentObj.error.message}</div>
          )}
          {!ComponentObj && <div>Loading component...</div>}
        </div>
      </WorkflowNodeWrapperSimple>
    </>
  );
};
