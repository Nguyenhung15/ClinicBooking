import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Modal, Spinner } from "react-bootstrap";
import { statusLabel, type UiStatus } from "../../components/appointment/AppointmentStatus";
import { fetchMyHistoryAppointments, type Appointment } from "../../api/appointment";
import { getPrescriptionsByAppointment, type Prescription } from "../../api/prescription";

const historyStatusOrder: UiStatus[] = ["COMPLETED"];
type ChipTone = "blue" | "green" | "purple" | "red";

const HISTORY_STATUS_META: Partial<
  Record<
    UiStatus,
    {
      title: string;
      description?: string;
      tone: ChipTone;
      badge?: string;
      defaultReason?: string;
    }
  >
> = {
  COMPLETED: {
    title: "Đã hoàn thành",
    description: "Tổng hợp các lịch hẹn đã khám xong.",
    tone: "green",
    badge: "Completed",
    defaultReason: "Khám đã hoàn thành",
  },
};

export default function PatientHistory() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [detailAppointment, setDetailAppointment] = useState<Appointment | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchMyHistoryAppointments();
      if (res.ok && res.data) {
        setAppointments(res.data);
        setError(null);
      } else {
        setError(res.error || "Không thể tải lịch sử khám");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Không thể tải lịch sử khám";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const grouped = useMemo(() => {
    return appointments.reduce<Record<UiStatus, Appointment[]>>((acc, item) => {
      const key = item.status;
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {} as Record<UiStatus, Appointment[]>);
  }, [appointments]);

  const formatStatusInfo = (status: UiStatus) => {
    const meta = HISTORY_STATUS_META[status];
    if (meta) {
      return {
        title: meta.title,
        description: meta.description,
        tone: meta.tone,
        badge: meta.badge ?? statusLabel[status],
        defaultReason: meta.defaultReason,
      };
    }
    return {
      title: statusLabel[status],
      description: undefined,
      tone: "green" as ChipTone,
      badge: statusLabel[status],
      defaultReason: undefined,
    };
  };

  const formatDate = (value?: string) => {
    if (!value) return "—";
    try {
      return new Date(value).toLocaleDateString("vi-VN");
    } catch (err) {
      return value;
    }
  };

  const formatTime = (value?: string) => {
    if (!value) return "—";
    if (value.length > 5) return value.slice(0, 5);
    return value;
  };

  const getPatientsLabel = (appointment: Appointment) => {
    if (appointment.patients?.length) {
      return appointment.patients
        .map((p) => `${p.fullName || "—"}${p.relationship ? ` (${p.relationship})` : ""}`)
        .join(", ");
    }
    return appointment.patientName || "—";
  };

  const openDetail = useCallback(
    async (appointment: Appointment) => {
      setDetailAppointment(appointment);
      setShowDetail(true);
      setDetailLoading(true);
      setDetailError(null);
      setPrescriptions([]);
      try {
        const res = await getPrescriptionsByAppointment(appointment.id);
        if (res.ok && res.data) {
          setPrescriptions(res.data);
        } else {
          setDetailError(res.error || "Không thể tải đơn thuốc.");
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Không thể tải đơn thuốc.";
        setDetailError(message);
      } finally {
        setDetailLoading(false);
      }
    },
    []
  );

  const closeDetail = () => {
    setShowDetail(false);
    setDetailAppointment(null);
    setDetailError(null);
    setPrescriptions([]);
  };

  return (
    <>
      <div className="patient-page">
        <header className="patient-header">
          <h1>Lịch sử khám</h1>
          <p>Tra cứu các lịch hẹn đã hoàn thành hoặc đã hủy.</p>
          {error && !loading && (
            <Alert variant="danger" className="mt-3" onClose={() => setError(null)} dismissible>
              {error}
            </Alert>
          )}
        </header>

        <section className="patient-body">
          {loading ? (
            <div className="patient-card">
              <div className="patient-loading">
                <Spinner animation="border" size="sm" />
                Đang tải lịch sử khám...
              </div>
            </div>
          ) : appointments.length === 0 ? (
            <div className="patient-card">
              <div className="patient-placeholder">
                <strong>Chưa có lịch sử khám.</strong>
                Các lịch hẹn đã hoàn thành hoặc hủy sẽ hiển thị tại đây.
              </div>
            </div>
          ) : (
            historyStatusOrder.map((status) => {
              const list = grouped[status] ?? [];
              if (!list.length) return null;
              const info = formatStatusInfo(status);
              return (
                <div key={status} className="patient-card">
                  <div className="patient-card__header">
                    <div>
                      <h2 className="patient-card__title mb-0">{info.title}</h2>
                      {info.description && <p className="patient-card__subtitle">{info.description}</p>}
                    </div>
                    <div className={`patient-status-chip tone-${info.tone}`}>
                      <span className="patient-status-chip__dot" />
                      {info.badge}
                    </div>
                  </div>
                  <div className="patient-appointment-list">
                    {list.map((item) => (
                      <div key={item.id} className="patient-appointment-item">
                        <div className="patient-appointment-title">
                          {item.reason?.trim() || info.defaultReason || "Lịch hẹn"}
                        </div>
                        <div className="patient-appointment-grid">
                          <div className="patient-appointment-field">
                            <span className="patient-appointment-label">Ngày</span>
                            <span className="patient-appointment-value">{formatDate(item.appointmentDate)}</span>
                          </div>
                          <div className="patient-appointment-field">
                            <span className="patient-appointment-label">Giờ</span>
                            <span className="patient-appointment-value">{formatTime(item.appointmentTime)}</span>
                          </div>
                          <div className="patient-appointment-field">
                            <span className="patient-appointment-label">Bác sĩ</span>
                            <span className="patient-appointment-value">{item.doctorName || "—"}</span>
                          </div>
                          <div className="patient-appointment-field">
                            <span className="patient-appointment-label">Chuyên khoa</span>
                            <span className="patient-appointment-value">{item.specialtyName || "—"}</span>
                          </div>
                        </div>
                        {item.patients?.length ? (
                          <div className="patient-appointment-extra">
                            <strong>Hồ sơ khám:</strong> {getPatientsLabel(item)}
                          </div>
                        ) : null}
                        <div className="patient-appointment-actions">
                          <Button variant="outline-primary" size="sm" onClick={() => openDetail(item)}>
                            Xem chi tiết
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </section>
      </div>

      <Modal show={showDetail} onHide={closeDetail} centered size="lg">
        <Modal.Header closeButton={!detailLoading}>
          <Modal.Title>
            {detailAppointment ? `Chi tiết lịch hẹn #${detailAppointment.appointmentNo || detailAppointment.id}` : "Chi tiết lịch hẹn"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {detailAppointment ? (
            <>
              <div className="patient-detail-grid mb-3">
                <div>
                  <strong>Ngày:</strong> {formatDate(detailAppointment.appointmentDate)}
                </div>
                <div>
                  <strong>Giờ:</strong> {formatTime(detailAppointment.appointmentTime)}
                </div>
                <div>
                  <strong>Bác sĩ:</strong> {detailAppointment.doctorName || "—"}
                </div>
                <div>
                  <strong>Chuyên khoa:</strong> {detailAppointment.specialtyName || "—"}
                </div>
                <div>
                  <strong>Lý do khám:</strong>{" "}
                  {detailAppointment.reason?.trim() || "Không có"}
                </div>
                <div>
                  <strong>Trạng thái:</strong> {statusLabel[detailAppointment.status]}
                </div>
              </div>

              {detailAppointment.patients?.length ? (
                <div className="patient-appointment-extra mb-3">
                  <strong>Hồ sơ khám:</strong> {getPatientsLabel(detailAppointment)}
                </div>
              ) : null}

              <div>
                <h5>Đơn thuốc</h5>
                {detailLoading ? (
                  <div className="d-flex align-items-center gap-2">
                    <Spinner animation="border" size="sm" />
                    Đang tải đơn thuốc...
                  </div>
                ) : detailError ? (
                  <Alert variant="danger" className="mt-2">
                    {detailError}
                  </Alert>
                ) : prescriptions.length === 0 ? (
                  <div className="text-muted">Không có đơn thuốc.</div>
                ) : (
                  <div className="patient-prescription-list">
                    {prescriptions.map((prescription) => (
                      <div key={prescription.id} className="patient-prescription-item">
                        <div>
                          <strong>Thuốc:</strong> {prescription.medicineName || "—"}
                        </div>
                        <div>
                          <strong>Liều lượng:</strong> {prescription.dosage || "—"}
                        </div>
                        <div>
                          <strong>Thời gian:</strong> {prescription.duration || "—"}
                        </div>
                        {prescription.instructions && (
                          <div>
                            <strong>Hướng dẫn:</strong> {prescription.instructions}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="d-flex align-items-center gap-2">
              <Spinner animation="border" size="sm" />
              Đang tải chi tiết...
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={closeDetail} disabled={detailLoading}>
            Đóng
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

