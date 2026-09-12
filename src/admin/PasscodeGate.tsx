import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useConfig } from '../state/ConfigContext';
import {
  checkPasscode,
  hashPasscode,
  isUnlocked,
  isValidPasscode,
  rememberUnlock,
} from '../lib/passcode';

/**
 * Stands in front of the admin panel.
 *
 * If no passcode has been set yet — a brand new board — it asks for one to be
 * chosen before anything can be edited, rather than leaving the panel open and
 * hoping somebody remembers to lock it later.
 */
export function PasscodeGate({ onCancel, children }: { onCancel: () => void; children: ReactNode }) {
  const { config, update } = useConfig();
  const [unlocked, setUnlocked] = useState(() => isUnlocked());

  if (unlocked) return <>{children}</>;

  if (!config.admin.passcodeHash) {
    return (
      <ChoosePasscode
        onCancel={onCancel}
        onChosen={async (passcode, hint) => {
          const passcodeHash = await hashPasscode(passcode);
          update((prev) => ({ ...prev, admin: { passcodeHash, hint } }));
          rememberUnlock();
          setUnlocked(true);
        }}
      />
    );
  }

  return (
    <EnterPasscode
      hint={config.admin.hint}
      storedHash={config.admin.passcodeHash}
      onCancel={onCancel}
      onUnlocked={() => {
        rememberUnlock();
        setUnlocked(true);
      }}
    />
  );
}

function EnterPasscode({
  hint,
  storedHash,
  onCancel,
  onUnlocked,
}: {
  hint: string;
  storedHash: string;
  onCancel: () => void;
  onUnlocked: () => void;
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setChecking(true);
    const ok = await checkPasscode(value, storedHash);
    setChecking(false);
    if (ok) {
      onUnlocked();
      return;
    }
    setError('That passcode is not right.');
    setValue('');
    inputRef.current?.focus();
  };

  return (
    <LockScreen title="Board Settings" subtitle="Enter the passcode to continue.">
      <form onSubmit={submit}>
        <input
          ref={inputRef}
          type="password"
          className="lock-input"
          value={value}
          inputMode="text"
          autoComplete="current-password"
          placeholder="Passcode"
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
        />
        {hint ? <p className="lock-hint">Hint: {hint}</p> : null}
        {error ? <p className="lock-error">{error}</p> : null}
        <div className="lock-actions">
          <button className="btn btn-primary" type="submit" disabled={checking || !value}>
            {checking ? 'Checking…' : 'Unlock'}
          </button>
          <button className="btn" type="button" onClick={onCancel}>
            Back to the board
          </button>
        </div>
      </form>
    </LockScreen>
  );
}

function ChoosePasscode({
  onCancel,
  onChosen,
}: {
  onCancel: () => void;
  onChosen: (passcode: string, hint: string) => Promise<void>;
}) {
  const [value, setValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [hint, setHint] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValidPasscode(value)) {
      setError('Use at least four characters.');
      return;
    }
    if (value !== confirm) {
      setError('The two passcodes do not match.');
      return;
    }
    setSaving(true);
    await onChosen(value, hint.trim());
  };

  return (
    <LockScreen
      title="Set a Passcode"
      subtitle="Choose a passcode for the settings before you start. Anyone who knows it can change the board, so share it only with the committee."
    >
      <form onSubmit={submit}>
        <input
          type="password"
          className="lock-input"
          value={value}
          autoComplete="new-password"
          placeholder="New passcode"
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
        />
        <input
          type="password"
          className="lock-input"
          value={confirm}
          autoComplete="new-password"
          placeholder="Type it again"
          onChange={(event) => {
            setConfirm(event.target.value);
            setError(null);
          }}
        />
        <input
          type="text"
          className="lock-input"
          value={hint}
          placeholder="Reminder (optional) — never the passcode itself"
          onChange={(event) => setHint(event.target.value)}
        />
        {error ? <p className="lock-error">{error}</p> : null}
        <p className="lock-note">
          Write it down somewhere safe. There is no way to recover it — if it is lost, the board has
          to be reset and set up again.
        </p>
        <div className="lock-actions">
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Set passcode and continue'}
          </button>
          <button className="btn" type="button" onClick={onCancel}>
            Back to the board
          </button>
        </div>
      </form>
    </LockScreen>
  );
}

function LockScreen({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="lock-screen">
      <div className="lock-card">
        <div className="lock-glyph" aria-hidden="true">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
            <rect x="4" y="10" width="16" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="12" cy="15.5" r="1.4" fill="currentColor" />
          </svg>
        </div>
        <h1>{title}</h1>
        <p className="lock-subtitle">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}
