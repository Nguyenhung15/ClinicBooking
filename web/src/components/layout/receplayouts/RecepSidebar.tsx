import { Nav } from "react-bootstrap";
import { NavLink } from "react-router-dom";
import "../../../styles/layouts.css";
import logo from '../../../assets/logo.png';

const Icon = {
  overview: (<svg width="18" height="18" viewBox="0 0 24 24"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" fill="currentColor"/></svg>),
  calendar: (<svg width="18" height="18" viewBox="0 0 24 24"><path d="M7 10h5v5H7z" fill="currentColor"/><path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 00-2 2v12a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zm0 14H5V9h14v9z" fill="currentColor"/></svg>),
  ticket: (<svg width="18" height="18" viewBox="0 0 24 24"><path d="M21 5h-8l-1-1h-2l-1 1H3v6h1a2 2 0 010 4H3v6h16l1 1h2l1-1h2v-6h-1a2 2 0 010-4h1V5z" fill="currentColor"/></svg>),
  event: (<svg width="18" height="18" viewBox="0 0 24 24"><path d="M7 10h5v5H7z" fill="currentColor"/><path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 00-2 2v12a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zm0 14H5V9h14v9z" fill="currentColor"/></svg>),
};

export default function RecepSidebar() {
  return (
    <aside className="admin-sidebar">
      <div className="brand">
        <img src={logo} alt="Clinic Booking" />
        <span>Clinic Booking</span>
      </div>
      <div>
        <Nav className="menu">
          <Nav.Link as={NavLink} to="/receptionist/dashboard" end className="item">
            <span className="icon">{Icon.overview}</span>
            Overview
          </Nav.Link>
          <Nav.Link as={NavLink} to="/receptionist/shift" className="item">
            <span className="icon">{Icon.calendar}</span>
            Shift
          </Nav.Link>
          <Nav.Link as={NavLink} to="/receptionist/appointment" className="item">
            <span className="icon">{Icon.overview}</span>
            Appointment
          </Nav.Link>
          <Nav.Link as={NavLink} to="/receptionist/events" className="item">
            <span className="icon">{Icon.event}</span>
            Events
          </Nav.Link>
          <Nav.Link as={NavLink} to="/receptionist/vouchers" className="item">
            <span className="icon">{Icon.ticket}</span>
            Vouchers
          </Nav.Link>
        </Nav>
      </div>
    </aside>
  );
}