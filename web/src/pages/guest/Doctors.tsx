import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Card, Col, Container, Form, Row, Spinner, Modal, Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { fetchDoctorsAll, type Doctor } from '../../api/doctor';
import { fetchSpecialties, type Specialty } from '../../api/specialty';
import { getDoctorImagePathWithFallback } from '../../utils/doctorImage';
import '../../styles/guest-doctors.css';

export default function Doctors() {
  const navigate = useNavigate();
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);

  const [selectedSpecialty, setSelectedSpecialty] = useState<number | 'all'>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');

    Promise.allSettled([fetchDoctorsAll(), fetchSpecialties()])
      .then((results) => {
        if (!alive) return;

        const [doctorRes, specialtyRes] = results;

        if (doctorRes.status === 'fulfilled') {
          const doctorsList = doctorRes.value ?? [];
          setDoctors(doctorsList);
        } else {
          const message =
            (doctorRes.reason && doctorRes.reason.message) || 'Không thể tải danh sách bác sĩ';
          setError(message);
        }

        if (specialtyRes.status === 'fulfilled') {
          setSpecialties(specialtyRes.value ?? []);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const normalizedQuery = useMemo(() => query.trim().toLowerCase(), [query]);

  const selectedSpecialtyInfo = useMemo(() => {
    if (selectedSpecialty === 'all') return null;
    return specialties.find((s) => s.id === selectedSpecialty) ?? null;
  }, [selectedSpecialty, specialties]);

  const filteredDoctors = useMemo(() => {
    return doctors.filter((doctor) => {
      const matchesSpecialty =
        selectedSpecialty === 'all' ||
        doctor.specialtyId === Number(selectedSpecialty) ||
        (doctor.specialtyName &&
          selectedSpecialtyInfo?.name &&
          doctor.specialtyName.toLowerCase() === selectedSpecialtyInfo.name.toLowerCase());
      const matchesQuery =
        normalizedQuery.length === 0 ||
        doctor.fullName?.toLowerCase().includes(normalizedQuery) ||
        doctor.specialtyName?.toLowerCase().includes(normalizedQuery);
      return matchesSpecialty && matchesQuery;
    });
  }, [doctors, normalizedQuery, selectedSpecialty, selectedSpecialtyInfo]);

  const selectedSpecialtyName = useMemo(() => {
    return selectedSpecialty === 'all'
      ? 'Tất cả chuyên khoa'
      : specialties.find((s) => s.id === selectedSpecialty)?.name ?? 'Chuyên khoa';
  }, [selectedSpecialty, specialties]);

  const handleViewDoctor = useCallback((doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setShowModal(true);
  }, []);

  const handleBookAppointment = useCallback((doctor: Doctor) => {
    const params = new URLSearchParams();
    params.set('doctorId', String(doctor.id));
    if (doctor.specialtyId) {
      params.set('specialtyId', String(doctor.specialtyId));
    }
    navigate(`/appointment?${params.toString()}`);
  }, [navigate]);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
  }, []);

  const handleBookFromModal = useCallback(() => {
    if (selectedDoctor) {
      setShowModal(false);
      const params = new URLSearchParams();
      params.set('doctorId', String(selectedDoctor.id));
      if (selectedDoctor.specialtyId) {
        params.set('specialtyId', String(selectedDoctor.specialtyId));
      }
      navigate(`/appointment?${params.toString()}`);
    }
  }, [selectedDoctor, navigate]);

  return (
    <div className="guest-doctors-page py-5">
      <Container>
        {/* Header */}
        <div className="mb-4">
          <h2 className="fw-bold mb-2">Danh sách bác sĩ</h2>
          <div className="text-muted small mb-4">
            {filteredDoctors.length} bác sĩ · {selectedSpecialtyName}
          </div>
        </div>

        {/* Filter Section - Nằm ngang */}
        <Card className="shadow-sm border-0 mb-4">
          <Card.Body>
            <Row className="g-3 align-items-end">
              <Col md={6} sm={12}>
                <Form.Group>
                  <Form.Label className="fw-semibold mb-2">Tìm kiếm bác sĩ</Form.Label>
                  <Form.Control
                    type="search"
                    placeholder="Nhập tên bác sĩ..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col md={6} sm={12}>
                <Form.Group>
                  <Form.Label className="fw-semibold mb-2">Chuyên khoa</Form.Label>
                  <Form.Select
                    value={selectedSpecialty === 'all' ? 'all' : selectedSpecialty}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSelectedSpecialty(value === 'all' ? 'all' : Number(value));
                    }}
                  >
                    <option value="all">Tất cả chuyên khoa</option>
                    {specialties.map((sp) => (
                      <option key={sp.id} value={sp.id}>
                        {sp.name}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {/* Loading, Error, Empty States */}
        {loading && (
          <div className="d-flex align-items-center gap-2 mb-4">
            <Spinner animation="border" size="sm" />
            <span>Đang tải danh sách bác sĩ...</span>
          </div>
        )}

        {!loading && error && (
          <Alert variant="danger" className="mb-4">
            {error}
            <div className="mt-1 small">
              Vui lòng đăng nhập với quyền phù hợp hoặc thử lại sau.
            </div>
          </Alert>
        )}

        {!loading && !error && filteredDoctors.length === 0 && (
          <Alert variant="info" className="mb-4">Không tìm thấy bác sĩ phù hợp với tiêu chí.</Alert>
        )}

        {/* Doctor List */}
        {!loading && !error && (
          <div className="vstack gap-3">
            {filteredDoctors.map((doctor) => (
              <div key={doctor.id} className="doctor-card">
                <div className="doctor-card__main">
                  {/* Bên trái: Khung ảnh bác sĩ */}
                  <div className="doctor-card__image">
                    {getDoctorImagePathWithFallback(doctor.fullName) ? (
                      <img
                        src={getDoctorImagePathWithFallback(doctor.fullName)!}
                        alt={doctor.fullName || 'Bác sĩ'}
                        className="doctor-card__image-img"
                        loading="lazy"
                        decoding="async"
                        width="150"
                        height="180"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const placeholder = target.parentElement?.querySelector('.doctor-image-placeholder');
                          if (placeholder) {
                            (placeholder as HTMLElement).style.display = 'flex';
                          }
                        }}
                      />
                    ) : null}
                    <div 
                      className="doctor-image-placeholder" 
                      style={{ 
                        display: getDoctorImagePathWithFallback(doctor.fullName) ? 'none' : 'flex',
                        width: '150px',
                        height: '180px',
                        backgroundColor: '#e9ecef',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#6c757d',
                        fontSize: '48px',
                        fontWeight: 'bold',
                        borderRadius: '8px'
                      }}
                    >
                      {doctor.fullName?.charAt(0)?.toUpperCase() || 'BS'}
                    </div>
                  </div>

                  {/* Bên phải: Phần thông tin */}
                  <div className="doctor-card__content">
                    {/* Vùng 1: Dòng chuyên khoa */}
                    {doctor.specialtyName && (
                      <div className="doctor-card__specialty-row">
                        <span className="doctor-card__specialty">{doctor.specialtyName}</span>
                      </div>
                    )}

                    {/* Vùng 2: Thông tin bác sĩ + Kinh nghiệm */}
                    <div className="doctor-card__info-section">
                      <div className="doctor-card__name-section">
                        <div className="doctor-card__title">{doctor.fullName}</div>
                        {doctor.degree && (
                          <div className="doctor-card__degree">{doctor.degree}</div>
                        )}
                      </div>
                      {doctor.experience && (
                        <div className="doctor-card__experience">
                          <span className="doctor-card__experience-label">Kinh nghiệm:</span>
                          <span className="doctor-card__experience-value">{doctor.experience}</span>
                        </div>
                      )}
                    </div>

                    {/* Vùng 3: Nút hành động */}
                    <div className="doctor-card__actions">
                      <Button
                        variant="outline-primary"
                        className="doctor-card__btn doctor-card__btn-view"
                        onClick={() => handleViewDoctor(doctor)}
                      >
                        Xem thông tin
                      </Button>
                      <Button
                        variant="primary"
                        className="doctor-card__btn doctor-card__btn-book"
                        onClick={() => handleBookAppointment(doctor)}
                      >
                        Đặt lịch
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Container>

      {/* Modal hiển thị thông tin chi tiết */}
      <Modal show={showModal} onHide={handleCloseModal} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Thông tin bác sĩ</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedDoctor && (
            <div className="doctor-detail-modal">
              <div className="doctor-detail-modal__header">
                <div className="doctor-detail-modal__image">
                  {getDoctorImagePathWithFallback(selectedDoctor.fullName) ? (
                    <img
                      src={getDoctorImagePathWithFallback(selectedDoctor.fullName)!}
                      alt={selectedDoctor.fullName}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const placeholder = target.parentElement?.querySelector('.doctor-image-placeholder');
                        if (placeholder) {
                          (placeholder as HTMLElement).style.display = 'flex';
                        }
                      }}
                    />
                  ) : null}
                  <div 
                    className="doctor-image-placeholder" 
                    style={{ 
                      display: getDoctorImagePathWithFallback(selectedDoctor.fullName) ? 'none' : 'flex',
                      width: '100%',
                      height: '200px',
                      backgroundColor: '#e9ecef',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#6c757d',
                      fontSize: '72px',
                      fontWeight: 'bold',
                      borderRadius: '8px'
                    }}
                  >
                    {selectedDoctor.fullName?.charAt(0)?.toUpperCase() || 'BS'}
                  </div>
                </div>
                <div className="doctor-detail-modal__info">
                  <h4 className="doctor-detail-modal__name">{selectedDoctor.fullName}</h4>
                  {selectedDoctor.degree && (
                    <p className="doctor-detail-modal__degree">{selectedDoctor.degree}</p>
                  )}
                  {selectedDoctor.specialtyName && (
                    <Badge bg="primary" className="doctor-detail-modal__specialty">
                      {selectedDoctor.specialtyName}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="doctor-detail-modal__content">
                {selectedDoctor.experience && (
                  <div className="doctor-detail-modal__item">
                    <strong>Kinh nghiệm:</strong>
                    <span>{selectedDoctor.experience}</span>
                  </div>
                )}
                {selectedDoctor.description && (
                  <div className="doctor-detail-modal__item">
                    <strong>Mô tả:</strong>
                    <p>{selectedDoctor.description}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseModal}>
            Đóng
          </Button>
          <Button variant="primary" onClick={handleBookFromModal}>
            Đặt lịch ngay
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

