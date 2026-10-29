import { useEffect, useMemo, useState } from "react";
import { Alert, Badge, Card, Spinner } from "react-bootstrap";
import { fetchMyEvents, type MyEventItem } from "../../api/patientEvents";
import "../../styles/appointmentlist.css";

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN");
}

export default function PatientEvents() {
  const [events, setEvents] = useState<MyEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const list = await fetchMyEvents();
        if (mounted) setEvents(list);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Không thể tải danh sách sự kiện.";
        if (mounted) setError(message);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const sortedEvents = useMemo(
    () =>
      [...events].sort((a, b) => {
        const aTime = a.startDate ? new Date(a.startDate).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.startDate ? new Date(b.startDate).getTime() : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      }),
    [events]
  );

  return (
    <div className="patient-page">
      <header className="patient-header">
        <h1>Sự kiện của tôi</h1>
        <p>Theo dõi các sự kiện bạn đã đăng ký và trạng thái tham gia.</p>
        {error && (
          <Alert variant="danger" className="mt-3" onClose={() => setError("")} dismissible>
            {error}
          </Alert>
        )}
      </header>

      <section className="patient-body">
        {loading ? (
          <Card body className="d-flex align-items-center gap-2">
            <Spinner animation="border" size="sm" />
            Đang tải sự kiện...
          </Card>
        ) : sortedEvents.length === 0 ? (
          <Card body className="text-center text-muted">
            Bạn chưa đăng ký sự kiện nào. Hãy khám phá trang chủ để tham gia các chương trình mới nhất.
          </Card>
        ) : (
          <div className="patient-card">
            <div className="patient-appointment-list">
              {sortedEvents.map((event) => (
                <div key={event.userEventId} className="patient-appointment-item">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div>
                      <div className="patient-appointment-title">{event.title}</div>
                      {event.location && (
                        <div className="small text-muted">Địa điểm: {event.location}</div>
                      )}
                    </div>
                    <Badge bg={event.status === "CONFIRMED" ? "success" : "secondary"}>
                      {event.status === "CONFIRMED" ? "Đã check-in" : "Chờ check-in"}
                    </Badge>
                  </div>
                  {event.description && (
                    <div className="text-muted mb-2">{event.description}</div>
                  )}
                  <div className="small text-muted mb-1">
                    Thời gian: {formatDateTime(event.startDate)} &mdash; {formatDateTime(event.endDate)}
                  </div>
                  <div className="small text-muted">
                    Đăng ký lúc: {formatDateTime(event.registeredAt)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

