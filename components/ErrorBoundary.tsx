'use client'
import { Component, ReactNode } from 'react'
interface Props { children: ReactNode; fallback?: ReactNode }
interface State { hasError: boolean; error?: Error }
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <p style={{ color: '#ef4444' }}>Algo ha salido mal</p>
          <button onClick={() => this.setState({ hasError: false })}>
            Reintentar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
