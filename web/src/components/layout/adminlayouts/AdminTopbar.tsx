import { Navbar, Form, Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import "../../../styles/layouts.css";

type Props = {
  userName?: string;
  onLogout?: () => void;
};

export default function AdminTopbar({ userName = "Administrator", onLogout }: Props) {
  const navigate = useNavigate();
  return (
      <Navbar bg="white" className="admin-topbar" expand="md">
        <div className="search">
          <Form.Control className="searchbox" placeholder="Search patients, appointments…" />
        </div>

        <div className="actions">
          <Button variant="light" className="icon-btn" aria-label="Notifications">
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M12 22a2 2 0 002-2H10a2 2 0 002 2zm6-6V11a6 6 0 10-12 0v5L4 18v1h16v-1l-2-2z" fill="currentColor"/></svg>
          </Button>

          <Button
            variant="light"
            className="icon-btn"
            aria-label="Settings"
            onClick={() => navigate("/admin/settings")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M19.14 12.94a7.07 7.07 0 000-1.88l2.03-1.58-2-3.46-2.39.96a7.03 7.03 0 00-1.63-.95L14.5 2h-5l-.62 2.03c-.58.23-1.12.54-1.63.95l-2.39-.96-2 3.46 2.03 1.58a7.07 7.07 0 000 1.88L2.86 14.5l2 3.46 2.39-.96c.51.41 1.05.72 1.63.95L9.5 22h5l.62-2.03c.58-.23 1.12-.54 1.63-.95l2.39.96 2-3.46-2.03-1.58zM12 15.5a3.5 3.5 0 110-7 3.5 3.5 0 010 7z" fill="currentColor"/></svg>
          </Button>

          <div className="profile">
            <span className="avatar">{userName?.[0]?.toUpperCase()}</span>
            <span className="name">{userName}</span>
            <Button variant="light" className="logout" onClick={onLogout}>
              Logout
            </Button>
          </div>
        </div>
      </Navbar> 
  );
}

