import { useEffect, useMemo, useState } from "react";
import { Button, Card, Form, Spinner } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { fetchMyShifts, type DoctorShift } from "../../api/shift";
import { http } from "../../api/http";
import "../../styles/shift.css";

/** ====== Constants ====== */
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const slotOrder = ["MORNING", "AFTERNOON", "EVENING"] as const;
const slotLabel: Record<typeof slotOrder[number], string> = {
  MORNING: "Morning (08:00 - 12:00)",
  AFTERNOON: "Afternoon (13:00 - 17:00)",
  EVENING: "Evening (18:00 - 21:00)",
};

/** ====== Date helpers (tuần bắt đầu từ Thứ 2) ====== */
function getISOWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay(); // 0..Sun, 1..Mon
  const diff = (day === 0 ? -6 : 1) - day; // về thứ 2
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
function formatDM(date: Date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}
function toISO(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** ====== Types (nội bộ) ====== */
type AppointmentItem = { id: number; time?: string; patient?: string; status?: string };
type SlotKey = typeof slotOrder[number];
type ShiftGrid = Record<SlotKey, Record<string, DoctorShift | undefined>>;
type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

/** ====== Component ====== */
export default function DoctorShifts() {
  const navigate = useNavigate();

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [allItems, setAllItems] = useState<DoctorShift[]>([]);
  const [shiftIdToApps, setShiftIdToApps] = useState<Record<string, AppointmentItem[]>>({});

  // Filter theo tuần: dùng 1 ngày mốc thuộc tuần đó
  const [dateStr, setDateStr] = useState<string>(toISO(new Date()));

  // Load tất cả shift của bác sĩ (để linh hoạt filter tuần ở client)
  useEffect(() => {
    setLoading(true);
    setError("");
    fetchMyShifts(undefined)
      .then(setAllItems)
      .catch((e) => setError(String(e?.message || e)))
      .finally(() => setLoading(false));
  }, []);

  // Tính header 7 ngày (Thứ 2 → CN)
  const baseDate = useMemo(() => new Date(dateStr), [dateStr]);
  const monday = useMemo(() => getISOWeekStart(baseDate), [baseDate]);

  const headers = useMemo(() => {
    const list: { iso: string; label: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      list.push({ iso: toISO(d), label: `${days[i]} ${formatDM(d)}` });
    }
    return list;
  }, [monday]);

  const weekRangeLabel = useMemo(() => {
    const start = new Date(monday);
    const end = new Date(monday);
    end.setDate(monday.getDate() + 6);
    return `${formatDM(start)} - ${formatDM(end)}`;
  }, [monday]);

  // Lập lưới shifts theo tuần (slot x day)
  const grid = useMemo(() => {
    const map: ShiftGrid = {
      MORNING: {},
      AFTERNOON: {},
      EVENING: {},
    };

    const startISO = headers[0]?.iso;
    const endISO = headers[6]?.iso;

    for (const it of allItems) {
      const date = it.date; // yyyy-mm-dd
      if (!startISO || !endISO) continue;
      if (date < startISO || date > endISO) continue;

      const slot = it.shift as (typeof slotOrder)[number]; // MORNING/AFTERNOON/EVENING
      if (!map[slot]) map[slot] = {};
      map[slot][date] = it;
    }
    return map;
  }, [allItems, headers]);

  // Helper function to determine slot based on appointment time
  const getSlotFromTime = (timeStr: string | undefined): typeof slotOrder[number] | null => {
    if (!timeStr) return null;
    const time = timeStr.slice(0, 5); // HH:mm
    const [hours, minutes] = time.split(":").map(Number);
    const totalMinutes = hours * 60 + minutes;
    
    // Morning: 08:00 - 12:00 (480 - 720 minutes)
    if (totalMinutes >= 480 && totalMinutes < 720) return "MORNING";
    // Afternoon: 13:00 - 17:00 (780 - 1020 minutes)
    if (totalMinutes >= 780 && totalMinutes < 1020) return "AFTERNOON";
    // Evening: 18:00 - 21:00 (1080 - 1260 minutes)
    if (totalMinutes >= 1080 && totalMinutes < 1260) return "EVENING";
    
    return null;
  };

  // Tải appointments cho các shift đang hiển thị trong tuần
  // Nhưng phân loại lại theo appointmentTime thực tế, không phải shift type
  useEffect(() => {
    const visible: DoctorShift[] = [];
    for (const slot of slotOrder) {
      for (const h of headers) {
        const it = grid[slot][h.iso];
        if (it) visible.push(it);
      }
    }
    if (!visible.length) {
      setShiftIdToApps({});
      return;
    }

    let cancelled = false;
    (async () => {
      const pairs = await Promise.all(
        visible.map(async (s) => {
          try {
            const res = await http.get(`/appointments/by-shift/${s.id}`);
            const raw = Array.isArray(res.data?.data)
              ? res.data.data
              : Array.isArray(res.data)
              ? res.data
              : [];
            const arr = Array.isArray(raw) ? (raw as unknown[]) : [];
            // map & sort theo time
            const items: AppointmentItem[] = [];
            for (const entry of arr) {
              if (!isRecord(entry)) continue;
              const patientSource = entry.patient;
              const patientName =
                typeof entry.patientName === "string"
                  ? entry.patientName
                  : typeof patientSource === "string"
                  ? patientSource
                  : (isRecord(patientSource) && typeof patientSource.fullName === "string"
                      ? patientSource.fullName
                      : undefined);
              const timeValue =
                typeof entry.appointmentTime === "string"
                  ? entry.appointmentTime
                  : typeof entry.time === "string"
                  ? entry.time
                  : "";
              items.push({
                id: Number(entry.id ?? 0),
                time: timeValue.slice(0, 5),
                patient: patientName,
                status: typeof entry.status === "string" ? entry.status : undefined,
              });
            }
            items.sort((a, b) => (a.time || "").localeCompare(b.time || ""));
            return [String(s.id), items] as [string, AppointmentItem[]];
          } catch {
            return [String(s.id), []] as [string, AppointmentItem[]];
          }
        })
      );
      if (!cancelled) {
        // Reorganize appointments by actual appointmentTime and date
        // Key format: "slot-date" (e.g., "MORNING-2025-11-04")
        const reorganized: Record<string, AppointmentItem[]> = {};
        
        for (const [shiftId, items] of pairs) {
          // Find the shift to get its date
          const shift = visible.find(s => String(s.id) === shiftId);
          if (!shift) continue;
          
          for (const item of items) {
            const slot = getSlotFromTime(item.time);
            if (!slot) continue; // Skip if time doesn't match any slot
            
            const key = `${slot}-${shift.date}`;
            if (!reorganized[key]) {
              reorganized[key] = [];
            }
            reorganized[key].push(item);
          }
        }
        
        // Also keep the original mapping for backward compatibility if needed
        const originalMap: Record<string, AppointmentItem[]> = {};
        for (const [k, v] of pairs) originalMap[k] = v;
        
        // Use reorganized mapping
        setShiftIdToApps(reorganized);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [headers, grid]);

  /** ====== Render ====== */
  return (
    <div className="shift-wrap">
      {/* Filter Bar */}
      <div className="shift-filterbar">
        <div className="left">
          <h5 className="title">My Shift</h5>
          <span className="week-range">Week: {weekRangeLabel}</span>
        </div>

        <div className="right">
          <div className="week-picker">
            <Form.Control
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="date-input"
            />
          </div>

          <Button onClick={() => navigate("/doctor/shift/create")} className="btn-register">
            Đăng ký lịch
          </Button>
        </div>
      </div>

      {/* Error / Loading */}
      {error && (
        <Card body className="border-danger-subtle text-danger mb-3">
          {error}
        </Card>
      )}
      {loading ? (
        <div className="loading-inline">
          <Spinner animation="border" size="sm" />
          <span>Đang tải…</span>
        </div>
      ) : (
        <div className="shift-table-responsive">
          <table className="shift-table table table-bordered align-middle">
            <thead>
              <tr>
                <th className="col-shift">Shift</th>
                {headers.map((h) => (
                  <th key={h.iso} className="col-day">
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slotOrder.map((slot) => (
                <tr key={slot}>
                  <td className="fw-semibold col-shift sticky">
                    {slotLabel[slot]}
                  </td>
                  {headers.map((h) => {
                    const it = grid[slot][h.iso];
                    // Get appointments by slot and date (based on appointmentTime)
                    const appsKey = `${slot}-${h.iso}`;
                    const apps = shiftIdToApps[appsKey] || [];
                    return (
                      <td key={h.iso} className="cell">
                        {it ? (
                          <div className="cell-inner">
                            <ShiftChip shift={it} appointments={apps} />
                          </div>
                        ) : (
                          <span className="cell-empty">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** ====== Small atom ====== */
function ShiftChip({ shift, appointments }: { shift: DoctorShift; appointments: AppointmentItem[] }) {
  return (
    <div className="shift-chip">
      <div className="shift-chip-header">
        <span className="shift-chip-badge">Đã đăng ký</span>
        <div className="shift-chip-meta">
        </div>
        {shift.note && <span className="shift-chip-note">{shift.note}</span>}
      </div>
      <div className="shift-chip-body">
        {appointments.length > 0 ? (
          appointments.map((a) => (
            <AppointmentChip
              key={a.id}
              time={a.time}
              patient={a.patient}
              status={a.status}
            />
          ))
        ) : (
          <span className="cell-placeholder">Chưa có lịch hẹn</span>
        )}
      </div>
    </div>
  );
}

function AppointmentChip({
  time,
  patient,
  status,
}: {
  time?: string;
  patient?: string;
  status?: string;
}) {
  const s = String(status || "").toLowerCase().replace(/_/g, "-");
  const cls = s ? `appt appt-${s}` : "appt appt-default";
  return (
    <div className={cls} title={status || ""}>
      <span className="appt-left">
        <span className="time">{(time || "--:--").slice(0, 5)}</span>
        <span className="patient">{patient || "Patient"}</span>
      </span>
      <span className="status">{status || "-"}</span>
    </div>
  );
}