import NotificationBell from './NotificationBell';
import ThemeToggle from './ThemeToggle';

export default function NavActionGroup({ token }) {
  return (
    <div className="tf-nav-group">
      <ThemeToggle />
      <NotificationBell token={token} />
    </div>
  );
}
