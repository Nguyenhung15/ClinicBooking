import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Collapse,
  Spinner,
  Table,
} from "react-bootstrap";
import {
  confirmEventAttendance,
  fetchReceptionEvents,
  type ReceptionEventItem,
  type ReceptionEventParticipant,
} from "../../api/receptionist";
import "../../styles/appointmentlist.css";

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN");
}

export default function RecepEvents() {
  const [events, setEvents] = useState<ReceptionEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [checkingIn, setCheckingIn] = useState<number | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const list = await fetchReceptionEvents();
      setEvents(list);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Không thể tải danh sách sự kiện.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const handleExpand = (eventId: number) => {
    setExpandedId((prev) => (prev === eventId ? null : eventId));
  };

  const updateParticipant = (eventId: number, participant: ReceptionEventParticipant) => {
    setEvents((prev) =>
      prev.map((event) => {
        if (event.id !== eventId) return event;
        return {
          ...event,
          registrations: event.registrations.map((item) =>
            item.id === participant.id ? { ...item, status: participant.status } : item
          ),
        };
      })
    );
  };

  const handleCheckIn = async (eventId: number, participant: ReceptionEventParticipant) => {
    setCheckingIn(participant.id);
    setError("");
    setSuccessMessage("");
    try {
      const updated = await confirmEventAttendance(eventId, participant.userId);
      updateParticipant(eventId, updated);
      setSuccessMessage(
        `Đã xác nhận tham gia cho ${updated.userFullName || "người dùng"}${updated.status === "CONFIRMED" ? " và cấp voucher (nếu có)." : "."}`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Không thể xác nhận tham gia.";
      setError(message);
    } finally {
      setCheckingIn(null);
    }
  };

  return (
    <div className="page-section">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h2 className="mb-1">Quản lý sự kiện</h2>
          <p className="text-muted mb-0">Xác nhận người tham dự và cấp voucher cho khách hàng.</p>
        </div>
        <Button variant="outline-primary" onClick={() => void loadEvents()} disabled={loading}>
          Làm mới
        </Button>
      </div>

      {error && (
        <Alert variant="danger" onClose={() => setError("")} dismissible>
          {error}
        </Alert>
      )}
      {successMessage && (
        <Alert variant="success" onClose={() => setSuccessMessage("")} dismissible>
          {successMessage}
        </Alert>
      )}

      {loading ? (
        <Card body className="d-flex align-items-center gap-2">
          <Spinner animation="border" size="sm" />
          Đang tải sự kiện...
        </Card>
      ) : events.length === 0 ? (
        <Card body className="text-center text-muted">Chưa có sự kiện nào.</Card>
      ) : (
        events.map((event) => {
          const isExpanded = expandedId === event.id;
          return (
            <Card key={event.id} className="mb-3 shadow-sm border-0">
              <Card.Header
                className="d-flex justify-content-between align-items-center"
                onClick={() => handleExpand(event.id)}
                role="button"
              >
                <div>
                  <h5 className="mb-1">{event.title}</h5>
                  <div className="small text-muted">
                    {formatDateTime(event.startDate)} &mdash; {formatDateTime(event.endDate)}
                  </div>
                  {event.location && (
                    <div className="small text-muted">Địa điểm: {event.location}</div>
                  )}
                </div>
                <div className="d-flex flex-column align-items-end gap-1">
                  <Badge bg={event.enabled ? "success" : "secondary"}>
                    {event.enabled ? "Đang hiển thị" : "Đã ẩn"}
                  </Badge>
                  {event.voucherCode && (
                    <Badge bg="info">
                      Voucher: {event.voucherCode}
                    </Badge>
                  )}
                </div>
              </Card.Header>
              <Collapse in={isExpanded}>
                <div>
                  <Card.Body>
                    {event.registrations.length === 0 ? (
                      <div className="text-muted">Chưa có người dùng đăng ký.</div>
                    ) : (
                      <Table responsive hover className="align-middle">
                        <thead>
                          <tr>
                            <th>Người dùng</th>
                            <th>Email</th>
                            <th>Số điện thoại</th>
                            <th>Đăng ký lúc</th>
                            <th>Trạng thái</th>
                            <th style={{ width: 130 }}>Hành động</th>
                          </tr>
                        </thead>
                        <tbody>
                          {event.registrations.map((participant) => (
                            <tr key={participant.id}>
                              <td>{participant.userFullName || `#${participant.userId}`}</td>
                              <td>{participant.userEmail || "—"}</td>
                              <td>{participant.userPhone || "—"}</td>
                              <td>{formatDateTime(participant.registeredAt)}</td>
                              <td>
                                <Badge
                                  bg={participant.status === "CONFIRMED" ? "success" : "secondary"}
                                >
                                  {participant.status === "CONFIRMED"
                                    ? "Đã check-in"
                                    : "Chờ check-in"}
                                </Badge>
                              </td>
                              <td>
                                <Button
                                  size="sm"
                                  variant="outline-primary"
                                  disabled={participant.status === "CONFIRMED" || checkingIn === participant.id}
                                  onClick={() => handleCheckIn(event.id, participant)}
                                >
                                  {checkingIn === participant.id ? (
                                    <>
                                      <Spinner animation="border" size="sm" className="me-1" />
                                      Đang xác nhận...
                                    </>
                                  ) : (
                                    "Check-in"
                                  )}
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    )}
                  </Card.Body>
                </div>
              </Collapse>
            </Card>
          );
        })
      )}
    </div>
  );
}


