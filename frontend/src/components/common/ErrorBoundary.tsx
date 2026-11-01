import React, { Component, type ErrorInfo } from 'react'
import { ErrorState } from './ErrorState'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary caught error]:', error, errorInfo)
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 max-w-xl mx-auto my-12">
          <ErrorState
            title="UI Runtime Exception"
            message="An unexpected error occurred while rendering this view. Please try reloading or navigating back."
            onRetry={this.handleReset}
          />
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
