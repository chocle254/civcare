import { Component } from 'react';
import Icon from './Icons';

// Catches render errors anywhere below it so one broken screen never blanks
// the whole app. Resets automatically when the route changes (resetKey).
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Screen crashed:', error, info?.componentStack);
  }

  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    const isDoctor = window.location.pathname.startsWith('/doctor');
    const home = isDoctor ? '/doctor/dashboard' : '/dashboard';
    return (
      <div className="cc-crash" role="alert">
        <div className="cc-crash__card">
          <span className="cc-crash__icon"><Icon.Alert size={26} /></span>
          <h1>Something went wrong on this screen</h1>
          <p>Your data is safe. Go back to your dashboard, or reload the page to try again.</p>
          <div className="cc-crash__actions">
            <a className="btn btn--primary" href={home}>Back to dashboard</a>
            <button type="button" className="btn btn--outline" onClick={() => window.location.reload()}>Reload</button>
          </div>
        </div>
      </div>
    );
  }
}
