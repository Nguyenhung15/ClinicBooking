// src/pages/admin/AdminSpecialty.tsx
import { useEffect, useMemo, useState } from "react";
import { Button, Card, Col, Dropdown, DropdownButton, Form, Modal, Row, Spinner } from "react-bootstrap";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  fetchSpecialties,
  createSpecialty,
  updateSpecialty,
  type Specialty,
} from "../../api/specialty";

// ====== Paths (khớp routing đang dùng) =====================================
const LIST_PATH = "/admin/specialties";
const CREATE_PATH = "/admin/specialties/create";
const UPDATE_RE = /\/admin\/specialties\/update\/(\d+)$/; // .../specialties/update/:id
// ===========================================================================

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

// Helper chuẩn hoá message lỗi (không dùng any trong catch)
function getErrMsg(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data;
    const message =
      typeof data === "string"
        ? data
        : isRecord(data) && typeof data.message === "string"
        ? (data.message as string)
        : undefined;
    return message ?? err.message ?? "Request failed";
  }
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error";
  }
}

type SortKey = "all" | "id" | "name";

export default function AdminSpecialty() {
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");

  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("all");

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Specialty | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });

  // Load list
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    fetchSpecialties()
      .then((data) => {
        if (!alive) return;
        setSpecialties(data ?? []);
      })
      .catch((err) => {
        if (!alive) return;
        setError(getErrMsg(err));
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  // Mở modal khi URL là /create hoặc /update/:id
  useEffect(() => {
    const isCreate = location.pathname.endsWith("/create");
    const upMatch = location.pathname.match(UPDATE_RE); // [/update/123, "123"]
    const isUpdate = !!upMatch;

    if (isCreate) {
      setEditing(null);
      setForm({ name: "", description: "" });
      setShowModal(true);
      return;
    }

    if (isUpdate) {
      const id = Number(upMatch![1]);
      const sp = specialties.find((x) => x.id === id);
      if (sp) {
        setEditing(sp);
        setForm({ name: sp.name, description: sp.description });
      } else {
        // (tuỳ chọn) nếu có endpoint GET /specialties/{id} thì có thể fetch ở đây
      }
      setShowModal(true);
      return;
    }

    // Các URL khác -> đảm bảo đóng modal
    setShowModal(false);
    setEditing(null);
  }, [location.pathname, specialties]);

  // Sort client-side
  const visible = useMemo(() => {
    if (sortKey === "all") return specialties;
    const copy = [...specialties];
    if (sortKey === "id") copy.sort((a, b) => a.id - b.id);
    if (sortKey === "name") copy.sort((a, b) => a.name.localeCompare(b.name));
    return copy;
  }, [specialties, sortKey]);

  // Open create modal (deep-link)
  const openCreate = () => navigate(`${CREATE_PATH}`);

  // Open update modal (deep-link)
  const startUpdate = (sp: Specialty) => {
    setEditing(sp); // cảm giác mở nhanh
    setForm({ name: sp.name, description: sp.description });
    navigate(`/admin/specialties/update/${sp.id}`); // <<< href theo yêu cầu
  };

  // Close modal
  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    if (location.pathname.endsWith("/create") || UPDATE_RE.test(location.pathname)) {
      navigate(LIST_PATH, { replace: true });
    }
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // Create / Update
  const save = async () => {
    const name = form.name.trim();
    const description = form.description.trim();
    if (!name) return;

    setSaving(true);
    setError("");
    try {
      if (editing) {
        const updated = await updateSpecialty(editing.id, { name, description });
        setSpecialties((prev) => prev.map((s) => (s.id === editing.id ? updated : s)));
      } else {
        const created = await createSpecialty({ name, description });
        setSpecialties((prev) => [...prev, created]);
      }
      closeModal();
    } catch (err) {
      setError(getErrMsg(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Toolbar */}
      <Row className="align-items-center mb-3">
        <Col xs="12" md="6" className="d-flex gap-2">
          <DropdownButton
            id="sort-specialties"
            title={`Sort: ${sortKey === "all" ? "All" : sortKey === "id" ? "By ID" : "By Name"}`}
            variant="light"
          >
            <Dropdown.Item active={sortKey === "all"} onClick={() => setSortKey("all")}>
              All (default)
            </Dropdown.Item>
            <Dropdown.Item active={sortKey === "id"} onClick={() => setSortKey("id")}>
              By ID
            </Dropdown.Item>
            <Dropdown.Item active={sortKey === "name"} onClick={() => setSortKey("name")}>
              By Name
            </Dropdown.Item>
          </DropdownButton>
        </Col>

        <Col xs="12" md="6" className="d-flex justify-content-md-end mt-2 mt-md-0">
          <Button
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              openCreate();
            }}
          >
            + New Specialty
          </Button>
        </Col>
      </Row>

      {/* Error / Loading */}
      {error && (
        <Row className="mb-3">
          <Col>
            <Card body className="border-danger-subtle text-danger">{error}</Card>
          </Col>
        </Row>
      )}

      {loading ? (
        <div className="d-flex align-items-center gap-2">
          <Spinner animation="border" size="sm" />
          <span>Loading specialties…</span>
        </div>
      ) : (
        <Row className="g-3">
          {visible.map((s) => (
            <Col key={s.id} xs={12}>
              <Card className="shadow-sm h-100">
                <Card.Body className="d-flex flex-column">
                  <div className="d-flex align-items-start justify-content-between mb-2">
                    <Card.Title className="mb-0">{s.name}</Card.Title>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={(e: React.MouseEvent) => {
                        e.preventDefault();
                        startUpdate(s);
                      }}
                    >
                      Update
                    </Button>
                  </div>
                  <Card.Text className="text-muted flex-grow-1">
                    {s.description || "—"}
                  </Card.Text>
                  <div className="text-muted" style={{ fontSize: 12 }}>
                    ID: {s.id}
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ))}
          {visible.length === 0 && (
            <Col xs={12}>
              <Card className="shadow-sm">
                <Card.Body className="text-center text-muted">No specialties found.</Card.Body>
              </Card>
            </Col>
          )}
        </Row>
      )}

      {/* Modal Create / Update */}
      <Modal show={showModal} onHide={closeModal} centered>
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Modal.Header closeButton>
            <Modal.Title>{editing ? "Update Specialty" : "Create Specialty"}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3" controlId="spName">
              <Form.Label>Name</Form.Label>
              <Form.Control
                name="name"
                value={form.name}
                onChange={onChange}
                placeholder="e.g., Cardiology"
                autoFocus
                required
              />
            </Form.Group>

            <Form.Group className="mb-0" controlId="spDesc">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                name="description"
                value={form.description}
                onChange={onChange}
                rows={4}
                placeholder="Short description for this specialty..."
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer className="justify-content-between">
            <div className="text-muted small ms-1">
              {editing ? `Updating ID: ${editing.id}` : "Create a new specialty"}
            </div>
            <div className="d-flex gap-2">
              <Button variant="outline-secondary" onClick={closeModal} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={!form.name.trim() || saving}>
                {saving ? "Saving..." : editing ? "Update" : "Create"}
              </Button>
            </div>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
}
