import React from 'react';
import { Link } from 'react-router-dom';
import './ErrorBoundary.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    // You can also log the error to an error reporting service
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-content">
            <h1>Oops! Something went wrong</h1>
            <p>We're sorry, but there was an error loading this page.</p>
            {this.state.error && (
              <div className="error-details">
                <p>{this.state.error.toString()}</p>
              </div>
            )}
            <div className="error-actions">
              <button onClick={() => window.location.reload()}>
                Refresh Page
              </button>
              <Link to="/" className="home-link">
                Go to Homepage
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}