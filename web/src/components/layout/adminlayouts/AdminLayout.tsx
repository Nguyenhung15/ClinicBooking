// src/layouts/admin/AdminLayout.tsx
import { Container } from "react-bootstrap";
import { Outlet } from "react-router-dom";
import AdminSidebar from "./AdminSidebar";
import AdminTopbar from "./AdminTopbar";
import "../../../styles/layouts.css";

export default function AdminLayout() {
  const userName =
    JSON.parse(localStorage.getItem("user") || "{}")?.fullName || "Administrator";

  const onLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

  return (
    <div className="admin-wrap admin-theme">
      <AdminSidebar />
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