import { useCallback, useEffect, useState } from 'react';
import { ConfigProvider } from './state/ConfigContext';
import { Board } from './components/Board';
import { AdminPanel } from './admin/AdminPanel';
import { PasscodeGate } from './admin/PasscodeGate';
import './styles/base.css';
import './styles/board.css';
import './styles/slides.css';
import './styles/admin.css';

/**
 * Two views, one app: the board on the wall, and the settings behind it.
 *
 * Nothing on the board advertises the settings — no button, no hint. They are
 * reached at #admin, or by pressing "A" on a keyboard paired with the screen,
 * and then only with the passcode.
 */
export default function App() {
  const [showAdmin, setShowAdmin] = useState(() => window.location.hash === '#admin');

  const close = useCallback(() => {
    // Replace rather than push, so "back" does not land in the panel again.
    history.replaceState(null, '', window.location.pathname + window.location.search);
    setShowAdmin(false);
  }, []);

  useEffect(() => {
    const onHashChange = () => setShowAdmin(window.location.hash === '#admin');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.key === 'a' || event.key === 'A') {
        event.preventDefault();
        setShowAdmin((prev) => {
          if (prev) {
            history.replaceState(null, '', window.location.pathname + window.location.search);
            return false;
          }
          window.location.hash = 'admin';
          return true;
        });
      }
      if (event.key === 'Escape' && showAdmin) close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close, showAdmin]);

  return (
    <ConfigProvider>
      {showAdmin ? (
        <PasscodeGate onCancel={close}>
          <AdminPanel onClose={close} />
        </PasscodeGate>
      ) : (
        <Board />
      )}
    </ConfigProvider>
  );
}
