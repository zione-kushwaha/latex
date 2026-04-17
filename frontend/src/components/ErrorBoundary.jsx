import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('App crashed:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="full-center">
          <div className="error-card" style={{ maxWidth: 560 }}>
            <h2>Something went wrong</h2>
            <p style={{ fontFamily: 'monospace', fontSize: 12, textAlign: 'left', background: 'var(--surface2)', padding: 12, borderRadius: 8, overflowX: 'auto' }}>
              {this.state.error.message}
            </p>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
