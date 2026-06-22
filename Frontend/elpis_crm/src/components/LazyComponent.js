import React, { Suspense } from 'react';

// Loading skeleton component
const LoadingSkeleton = ({ height = 'h-96' }) => (
  <div className={`${height} bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse rounded-lg`} />
);

// Error fallback component
const ErrorFallback = ({ error }) => (
  <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
    <h3 className="text-red-800 font-semibold mb-2">Failed to load component</h3>
    <p className="text-red-600 text-sm">{error?.message || 'An error occurred'}</p>
  </div>
);

// Lazy component wrapper with Suspense
export const LazyComponent = ({ component: Component, fallback = <LoadingSkeleton />, errorBoundary = true }) => {
  return (
    <Suspense fallback={fallback}>
      {errorBoundary ? <ErrorBoundaryWrapper component={Component} /> : <Component />}
    </Suspense>
  );
};

// Error boundary wrapper
class ErrorBoundaryWrapper extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Component error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    return <this.props.component />;
  }
}

export default LazyComponent;
