// import { TempComponent } from "./temp-01";

import { Component, useEffect, useState } from 'react';
import { WorkflowNodeWrapperSimple } from './node-wrapper';
import type { WorkflowComponentProps } from './types';

class ErrorBoundary extends Component<
  { children: React.ReactNode; message: string },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; message: string }) {
    super(props);
    this.state = { hasError: false };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static getDerivedStateFromError(error: unknown) {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, errorInfo: unknown) {
    console.error(`[ErrorBoundary] Uncaught error:`, { error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full p-1 whitespace-pre-wrap bg-red-400 text-white rounded">
          {this.props.message}
        </div>
      );
    }

    return this.props.children;
  }
}

export const TempWrapper = (props: WorkflowComponentProps) => {
  const importPath = props.data.node.inputs.find((x) => x.name === 'importPath')?.value?.data as
    | undefined
    | string;

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
