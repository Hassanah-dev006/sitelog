import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../api/client';
import { useAuth } from '../auth/AuthContext';

const MIN = 8;

export default function ChangePasswordPage() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const forced = user?.mustChangePassword;

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    if (next.length < MIN) {
      setError(`The new password must be at least ${MIN} characters.`);
      return;
    }
    if (next !== confirm) {
      setError('The two new passwords do not match.');
      return;
    }
    if (next === current) {
      setError('The new password must be different from the current one.');
      return;
    }

    setBusy(true);
    try {
      const result = await api.changePassword(current, next);

      // The change invalidated the old token, so store the replacement.
      setToken(result.token);
      await refresh();

      setDone(true);
      setCurrent('');
      setNext('');
      setConfirm('');

      if (forced) setTimeout(() => navigate('/report/new', { replace: true }), 900);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h1>{forced ? 'Set your password' : 'Change password'}</h1>

      {forced && (
        <p className="alert alert-offline" role="status">
          Your password was set by an administrator, so someone else knows it. Choose your own
          before using the application.
        </p>
      )}

      {done && (
        <p className="alert alert-success" role="status">
          Password changed. Any other device signed in with the old password has been signed out.
        </p>
      )}

      {error && <p className="alert alert-error" role="alert">{error}</p>}

      <label htmlFor="current">Current password</label>
      <input
        id="current"
        type="password"
        autoComplete="current-password"
        required
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
      />

      <label htmlFor="next">New password</label>
      <input
        id="next"
        type="password"
        autoComplete="new-password"
        minLength={MIN}
        required
        aria-describedby="pw-hint"
        value={next}
        onChange={(e) => setNext(e.target.value)}
      />
      <p id="pw-hint" className="muted small">
        At least {MIN} characters. A short phrase you will remember beats a short tangle you
        will not.
      </p>

      <label htmlFor="confirm">New password again</label>
      <input
        id="confirm"
        type="password"
        autoComplete="new-password"
        required
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />

      <button type="submit" className="primary" disabled={busy}>
        {busy ? 'Saving…' : 'Change password'}
      </button>
    </form>
  );
}
