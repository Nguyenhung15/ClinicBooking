import { Outlet } from "react-router-dom";
import PatientSidebar from "./PatientSidebar";
import "../../../styles/patient.css";

export default function PatientLayout() {
  return (
    <div className="patient-layout">
      <PatientSidebar />
      <div className="patient-content">
        <Outlet />
      </div>
    </div>
  );
}

