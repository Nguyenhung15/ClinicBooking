import { Outlet } from "react-router-dom";
import DoctorSidebar from "./DoctorSidebar";
import AdminTopbar from "../adminlayouts/AdminTopbar";
import { Container } from "react-bootstrap";
import "../../../styles/layouts.css";

export default function DoctorLayout() {
  const userName = JSON.parse(localStorage.getItem("user") || "{}").fullName || "Doctor";
  const onLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

  return (
    <div className="admin-wrap admin-theme">
      <DoctorSidebar />
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


