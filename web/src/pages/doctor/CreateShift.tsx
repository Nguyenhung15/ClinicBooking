import { useEffect, useMemo, useState } from "react";
import { Button, Card, Col, Form, Row } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { createShift, fetchMyShifts, type CreateShiftPayload, type DoctorShift, type ShiftType } from "../../api/shift";

const slotOrder: ShiftType[] = ["MORNING", "AFTERNOON", "EVENING"];
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getISOWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // Monday as start
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
function toISO(date: Date) { return date.toISOString().slice(0, 10); }
function formatDM(date: Date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

export default function CreateShift() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Week picker
  const [dateStr, setDateStr] = useState<string>(toISO(new Date()));
  const monday = useMemo(() => getISOWeekStart(new Date(dateStr)), [dateStr]);
  const headers = useMemo(() => {
    const list: { iso: string; label: string; isPast: boolean }[] = [];
    const todayISO = toISO(new Date());
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = toISO(d);
      list.push({ iso, label: `${days[i]} ${formatDM(d)}`, isPast: iso < todayISO });
    }
    return list;
  }, [monday]);

  // existing shifts to prevent duplicate registration
  const [existing, setExisting] = useState<Record<string, DoctorShift>>({});
  useEffect(() => {
    let alive = true;
    fetchMyShifts(undefined)
      .then((arr) => {
        if (!alive) return;
        const map: Record<string, DoctorShift> = {};
        for (const it of arr) map[`${it.date}|${it.shift}`] = it;
        setExisting(map);
      })
      .catch(() => {})
  ;
    return () => { alive = false; };
  }, []);

  // selection state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleCell = (iso: string, shift: ShiftType, disabled: boolean) => {
    if (disabled) return;
    setSelected((prev) => {
      const key = `${iso}|${shift}`;
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // common fields applied to all selected slots
  const [maxPatients, setMaxPatients] = useState<number>(10);
  const [note, setNote] = useState<string>("");
  const [repeatWeekly, setRepeatWeekly] = useState<boolean>(false);
  const [repeatCount, setRepeatCount] = useState<number>(0); // 0..3

  const weekRangeLabel = useMemo(() => {
    const start = new Date(monday);
    const end = new Date(monday);
    end.setDate(monday.getDate() + 6);
    return `${formatDM(start)} - ${formatDM(end)}`;
  }, [monday]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (selected.size === 0) {
      setError("Vui lòng chọn ít nhất 1 ca làm việc trong tuần này");
      return;
    }
    setSaving(true);
    try {
      for (const key of selected) {
        const [iso, s] = key.split("|");
        const payload: CreateShiftPayload = {
          date: iso,
          shift: s as ShiftType,
          maxPatients,
          note: note || undefined,
          repeatWeekly,
          repeatCount: repeatWeekly ? Math.max(0, Math.min(3, repeatCount)) : 0,
        };
        await createShift(payload);
      }
      navigate("/doctor/shifts", { replace: true });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <h5 className="mb-3">Đăng ký lịch làm việc</h5>
      <Row className="align-items-center mb-3">
        <Col className="d-flex align-items-center gap-2">
          <Form.Control type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} style={{ maxWidth: 170 }} />
          <span className="text-muted small">({weekRangeLabel})</span>
        </Col>
        <Col className="text-end text-muted small">
          Không thể đăng ký cho ngày đã qua; ca đã có sẽ bị khóa.
        </Col>
      </Row>
      {error && <Card body className="border-danger-subtle text-danger mb-3">{error}</Card>}

      <Form onSubmit={onSubmit}>
        <div className="table-responsive mb-3">
          <table className="table table-bordered align-middle">
            <thead>
              <tr>
                <th style={{width: 120}}>Shift</th>
                {headers.map((h) => (
                  <th key={h.iso}>{h.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slotOrder.map((slot) => (
                <tr key={slot}>
                  <td className="fw-semibold">{slot}</td>
                  {headers.map((h) => {
                    const key = `${h.iso}|${slot}`;
                    const isExisting = Boolean(existing[key]);
                    const isDisabled = h.isPast || isExisting;
                    const isSelected = selected.has(key);
                    return (
                      <td key={h.iso} style={{height: 72}}>
                        {isExisting ? (
                          <span className="badge text-bg-secondary">Đã có</span>
                        ) : (
                          <Form.Check
                            type="checkbox"
                            id={key}
                            disabled={isDisabled}
                            checked={isSelected}
                            onChange={() => toggleCell(h.iso, slot, isDisabled)}
                            label={isDisabled ? "" : "Chọn"}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Row className="g-3">
          <Col md={4}>
            <Form.Group controlId="sMax">
              <Form.Label>Số bệnh nhân tối đa</Form.Label>
              <Form.Control type="number" min={1} max={100} value={maxPatients} onChange={(e) => setMaxPatients(Number(e.target.value))} />
            </Form.Group>
          </Col>
          <Col md={8}>
            <Form.Group controlId="sNote">
              <Form.Label>Ghi chú</Form.Label>
              <Form.Control as="textarea" rows={1} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú áp dụng cho các ca đã chọn (tuỳ chọn)" />
            </Form.Group>
          </Col>
          <Col md={12}>
            <Form.Check
              type="checkbox"
              id="sRepeat"
              label="Áp dụng các ca đã chọn cho các tuần tiếp theo"
              checked={repeatWeekly}
              onChange={(e) => setRepeatWeekly(e.target.checked)}
            />
          </Col>
          {repeatWeekly && (
            <Col md={4}>
              <Form.Group controlId="sRepeatCount">
                <Form.Label>Số tuần áp dụng tiếp theo</Form.Label>
                <Form.Select value={repeatCount} onChange={(e) => setRepeatCount(Number(e.target.value))}>
                  <option value={0}>0 tuần</option>
                  <option value={1}>1 tuần</option>
                  <option value={2}>2 tuần</option>
                  <option value={3}>3 tuần</option>
                </Form.Select>
              </Form.Group>
            </Col>
          )}
        </Row>

        <div className="d-flex justify-content-end gap-2 mt-4">
          <Button variant="outline-secondary" onClick={() => navigate(-1)} disabled={saving}>Hủy</Button>
          <Button type="submit" disabled={saving || selected.size === 0}>{saving ? "Đang lưu..." : "Đăng ký"}</Button>
        </div>
      </Form>
    </>
  );
}