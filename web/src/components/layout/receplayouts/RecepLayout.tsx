import { Outlet } from "react-router-dom";
import RecepSidebar from "./RecepSidebar";
import AdminTopbar from "../adminlayouts/AdminTopbar";
import { Container } from "react-bootstrap";
import "../../../styles/layouts.css";

export default function RecepLayout() {
  const userName = JSON.parse(localStorage.getItem("user") || "{}").fullName || "Receptionist";
  const onLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

  return (
    <div className="admin-wrap admin-theme">
      <RecepSidebar />
      <main className="admin-main">
        <AdminTopbar userName={userName} onLogout={onLogout} />
        <div className="admin-body">
          <Container fluid>
            <Outlet />
          </Container>
        </div>
      </main>
    </div>
  );
}



