// import { TempComponent } from "./temp-01";

import { Component, useEffect, useState } from "react";

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
        <div className="w-full h-full p-2 whitespace-pre-wrap bg-red-200 rounded">
          {this.props.message}
        </div>
      );
    }

    return this.props.children;
  }
}

export const TempWrapper = (props: {
  data: { inputs: { importPath: { lastValue: string } } };
}) => {
  const [ComponentObj, setComponentObj] = useState(
    undefined as
      | undefined
      | { Component: React.ComponentType }
      | { error: { message: string } }
  );
  useEffect(() => {
    (async () => {
      try {
        const module = await import(props.data.inputs.importPath.lastValue);
        setComponentObj({
          Component: () => <module.Component {...module.defaultProps} />,
        });
      } catch (error) {
        console.error("Error loading component:", error);
        setComponentObj({ error: { message: (error as Error).message } });
      }
    })();
  }, []);

  return (
    <>
      <div>Temp Component</div>
      <div>
        {ComponentObj && "Component" in ComponentObj && (
          <ErrorBoundary message={`Error rendering Component`}>
            <ComponentObj.Component />
          </ErrorBoundary>
        )}
        {ComponentObj && "error" in ComponentObj && (
          <div>Error loading component: {ComponentObj.error.message}</div>
        )}
        {!ComponentObj && <div>Loading component...</div>}
      </div>
    </>
  );
};
