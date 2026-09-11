import { useCallback, useEffect, useState } from 'react';
import { ConfigProvider } from './state/ConfigContext';
import { Board } from './components/Board';
import { AdminPanel } from './admin/AdminPanel';
import './styles/base.css';
import './styles/board.css';
import './styles/slides.css';
import './styles/admin.css';

/**
 * Two views, one app: the board on the wall, and the admin panel behind it.
 *
 * The panel is reached at #admin, or by pressing "A" — a wall-mounted screen
 * with a keyboard paired to it should not need a mouse to be managed.
 */
export default function App() {
  const [showAdmin, setShowAdmin] = useState(() => window.location.hash === '#admin');

  const open = useCallback(() => {
    window.location.hash = 'admin';
    setShowAdmin(true);
  }, []);

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
      {showAdmin ? <AdminPanel onClose={close} /> : <Board />}
      {!showAdmin ? <AdminHint onOpen={open} /> : null}
    </ConfigProvider>
  );
}

/**
 * A corner affordance that fades away. Without it, nobody would guess the
 * settings are one keypress behind the board.
 */
function AdminHint({ onOpen }: { onOpen: () => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 8000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 90,
        padding: '10px 18px',
        borderRadius: 999,
        border: '1px solid rgba(255,255,255,0.2)',
        background: 'rgba(0,0,0,0.6)',
        color: '#cfe3dd',
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer',
        backdropFilter: 'blur(6px)',
      }}
    >
      Press A to manage this board
    </button>
  );
}
