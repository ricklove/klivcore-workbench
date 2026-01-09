import { Component } from 'react';

export class ErrorBoundary extends Component<
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
