import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Carousel, Col, Container, Row, Spinner, Modal, Badge } from 'react-bootstrap';
import { fetchDoctorsAll, fetchDoctorById as fetchDoctorByIdApi, type Doctor as ApiDoctor } from '../../api/doctor';
import { getDoctorImagePathWithFallback } from '../../utils/doctorImage';
import '../../styles/doctors-section.css';

export type DoctorCard = {
  id: number | string;
  fullName: string;
  degree?: string;
  specialty?: string;
  specialtyName?: string;
  avatarUrl?: string;
  email?: string;
  phoneNumber?: string;
  description?: string;
  experience?: string;
};

type DoctorsSectionProps = {
  title?: string;
  doctors?: DoctorCard[];
  fetchDoctorById?: (id: number) => Promise<ApiDoctor>;
};

const VISIBLE_COUNT = 3;

function mapApiDoctorToCard(doctor: ApiDoctor): DoctorCard {
  const raw = doctor as unknown as Record<string, unknown>;
  const specialization = typeof raw.specialization === 'string' ? raw.specialization : undefined;
  
  // Use uploaded avatar / image or fallback to local mapped images
  const avatarUrl = doctor.avatarUrl || doctor.imageUrl || doctor.photoUrl || getDoctorImagePathWithFallback(doctor.fullName);

  return {
    id: doctor.id,
    fullName: doctor.fullName,
    degree: doctor.degree,
    specialtyName: doctor.specialtyName ?? specialization,
    avatarUrl: avatarUrl || undefined,
    email: doctor.email,
    phoneNumber: doctor.phoneNumber,
    description: doctor.description,
    experience: doctor.experience,
  };
}

export default function DoctorsSection({ title = 'Đội ngũ CHUYÊN GIA - BÁC SĨ', doctors, fetchDoctorById }: DoctorsSectionProps) {
  const navigate = useNavigate();

  const [fetchedDoctors, setFetchedDoctors] = useState<DoctorCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [bookingDoctorId, setBookingDoctorId] = useState<number | string | null>(null);
  const [selectedDoctorModal, setSelectedDoctorModal] = useState<DoctorCard | null>(null);

  // Use provided doctors or fetch from API
  const items = useMemo<DoctorCard[]>(() => {
    if (doctors && doctors.length > 0) return doctors;
    return fetchedDoctors;
  }, [doctors, fetchedDoctors]);

  const slides = useMemo<DoctorCard[][]>(() => {
    if (items.length === 0) return [];
    if (items.length <= VISIBLE_COUNT) return [items];

    const groups: DoctorCard[][] = [];
    for (let idx = 0; idx <= items.length - VISIBLE_COUNT; idx += 1) {
      groups.push(items.slice(idx, idx + VISIBLE_COUNT));
    }
    return groups;
  }, [items]);

  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (doctors && doctors.length > 0) {
      setFetchedDoctors([]);
      setLoading(false);
      return;
    }

    let ignore = false;
    setLoading(true);

    fetchDoctorsAll()
      .then((list) => {
        if (ignore) return;
        setFetchedDoctors(list.map(mapApiDoctorToCard));
      })
      .catch((err: unknown) => {
        if (ignore) return;
        console.error(err);
        setFetchedDoctors([]);
      })
      .finally(() => {
        if (ignore) return;
        setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [doctors]);

  useEffect(() => {
    setActiveIndex(0);
  }, [slides.length]);

  const handleSelect = (selectedIndex: number) => {
    setActiveIndex(selectedIndex);
  };

  const canPrev = !loading && activeIndex > 0;
  const canNext = !loading && activeIndex < Math.max(slides.length - 1, 0);
  const showControls = slides.length > 1;

  const handlePrev = () => {
    if (!canPrev) return;
    setActiveIndex((idx) => Math.max(0, idx - 1));
  };

  const handleNext = () => {
    if (!canNext) return;
    setActiveIndex((idx) => Math.min(Math.max(slides.length - 1, 0), idx + 1));
  };

  const handleBook = async (doctor: DoctorCard) => {
    const targetId = doctor.id;
    const numericId = typeof targetId === 'string' ? Number(targetId) : targetId;
    const fetcher = fetchDoctorById ?? fetchDoctorByIdApi;
    let detail: ApiDoctor | DoctorCard = doctor;

    if (Number.isFinite(numericId)) {
      setBookingDoctorId(targetId);
      try {
        detail = await fetcher(Number(numericId));
      } catch (err) {
        console.error(err);
        window.alert('Không thể lấy thông tin bác sĩ đã chọn');
      } finally {
        setBookingDoctorId(null);
      }
    }

    const specialtyId = (detail as ApiDoctor).specialtyId ?? undefined;

    const params = new URLSearchParams();
    params.set('doctorId', String(targetId));
    if (specialtyId) {
      params.set('specialtyId', String(specialtyId));
    }

    if (selectedDoctorModal) {
      setSelectedDoctorModal(null);
    }

    navigate(`/appointment?${params.toString()}`, {
      state: {
        doctor: detail,
      },
    });
  };

  if (!loading && items.length === 0) {
    return null;
  }

  return (
    <section className="doctors-section">
      <Container>
        {title && (
          <div className="doctors-section__top">
            <h2 className="doctors-section__title">{title}</h2>
            {showControls && (
              <div className="doctors-section__controls">
                <Button
                  variant="outline-secondary"
                  onClick={handlePrev}
                  disabled={!canPrev}
                  className="doctors-section__nav-btn"
                  aria-label="Previous"
                >
                  ‹
                </Button>
                <Button
                  variant="outline-secondary"
                  onClick={handleNext}
                  disabled={!canNext}
                  className="doctors-section__nav-btn"
                  aria-label="Next"
                >
                  ›
                </Button>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="doctors-section__loading">
            <Spinner animation="border" role="status" />
            <span>Đang tải danh sách bác sĩ...</span>
          </div>
        ) : (
          <Carousel
            activeIndex={activeIndex}
            onSelect={handleSelect}
            controls={false}
            indicators={showControls}
            interval={null}
            wrap={false}
            className="doctors-section__carousel"
            variant="dark"
          >
            {slides.map((group, slideIndex) => (
              <Carousel.Item key={slideIndex}>
                <Row className="g-4 justify-content-center">
                  {group.map((d) => (
                    <Col key={d.id} xs={12} md={6} lg={4} className="d-flex">
                      <Card className="doctors-section__card h-100 shadow-sm border-0">
                        {/* Doctor Avatar */}
                        <div className="doctors-section__image-wrapper">
                          {d.avatarUrl ? (
                            <img
                              src={d.avatarUrl}
                              alt={d.fullName}
                              className="doctors-section__image"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const placeholder = target.parentElement?.querySelector('.doctors-section__image-placeholder');
                                if (placeholder) {
                                  (placeholder as HTMLElement).style.display = 'flex';
                                }
                              }}
                            />
                          ) : null}

                          <div 
                            className="doctors-section__image-placeholder"
                            style={{ display: d.avatarUrl ? 'none' : 'flex' }}
                          >
                            <svg
                              className="doctors-section__avatar-svg"
                              width="52"
                              height="52"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                              <circle cx="12" cy="7" r="4" />
                            </svg>
                            <span className="doctors-section__avatar-badge">
                              {d.fullName ? d.fullName.trim().split(' ').slice(-1)[0][0] : 'BS'}
                            </span>
                          </div>
                        </div>

                        {/* Doctor Card Body */}
                        <Card.Body className="doctors-section__card-body">
                          {/* 1. Doctor Name (Prominent on top) */}
                          <Card.Title as="h3" className="doctors-section__name">
                            {d.fullName}
                          </Card.Title>

                          {/* 2. Degree / Title (Directly under name) */}
                          <div className="doctors-section__degree">
                            {d.degree || 'Bác sĩ chuyên khoa'}
                          </div>

                          {/* 3. Specialty Badge Chip */}
                          <div className="doctors-section__specialty-wrap">
                            <span className="doctors-section__specialty-badge">
                              {d.specialtyName || d.specialty || 'Chuyên khoa'}
                            </span>
                          </div>

                          {/* 4. Experience if available */}
                          {d.experience && (
                            <div className="doctors-section__experience">
                              <small>Kinh nghiệm: {d.experience}</small>
                            </div>
                          )}

                          {/* 5. Action Buttons (Pushed to bottom) */}
                          <div className="doctors-section__actions">
                            <button
                              type="button"
                              onClick={() => setSelectedDoctorModal(d)}
                              className="doctors-section__view-btn"
                              title="Xem chi tiết hồ sơ bác sĩ"
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="12" y1="16" x2="12" y2="12"/>
                                <line x1="12" y1="8" x2="12.01" y2="8"/>
                              </svg>
                              <span>Xem thông tin</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleBook(d)}
                              className="doctors-section__book-btn"
                              disabled={bookingDoctorId === d.id}
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                <line x1="16" y1="2" x2="16" y2="6"/>
                                <line x1="8" y1="2" x2="8" y2="6"/>
                                <line x1="3" y1="10" x2="21" y2="10"/>
                              </svg>
                              <span>{bookingDoctorId === d.id ? 'Đang xử lý…' : 'Đặt lịch'}</span>
                            </button>
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </Carousel.Item>
            ))}
          </Carousel>
        )}
      </Container>

      {/* Doctor Profile Modal */}
      <Modal
        show={!!selectedDoctorModal}
        onHide={() => setSelectedDoctorModal(null)}
        centered
        size="lg"
        className="doctor-detail-modal"
      >
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title className="fw-bold fs-5 text-primary">Thông tin Bác sĩ</Modal.Title>
        </Modal.Header>
        <Modal.Body className="pt-2 pb-4">
          {selectedDoctorModal && (
            <Row className="g-4 align-items-center">
              <Col md={4} className="text-center">
                <div className="doctor-modal__avatar-wrap mx-auto">
                  {selectedDoctorModal.avatarUrl ? (
                    <img
                      src={selectedDoctorModal.avatarUrl}
                      alt={selectedDoctorModal.fullName}
                      className="doctor-modal__avatar"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/img/doctor-placeholder.jpg';
                      }}
                    />
                  ) : (
                    <div className="doctor-modal__placeholder">
                      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>
                  )}
                </div>
              </Col>
              <Col md={8}>
                <h3 className="fw-bold mb-1 text-dark">{selectedDoctorModal.fullName}</h3>
                {selectedDoctorModal.degree && (
                  <div className="text-muted fw-semibold mb-2">{selectedDoctorModal.degree}</div>
                )}
                <div className="mb-3">
                  <Badge bg="primary" className="px-3 py-2 rounded-pill font-monospace">
                    {selectedDoctorModal.specialtyName || selectedDoctorModal.specialty || 'Chuyên khoa'}
                  </Badge>
                </div>

                {selectedDoctorModal.experience && (
                  <p className="mb-2 text-secondary">
                    <strong>Kinh nghiệm:</strong> {selectedDoctorModal.experience}
                  </p>
                )}

                {selectedDoctorModal.description && (
                  <p className="mb-3 text-secondary" style={{ lineHeight: '1.6' }}>
                    <strong>Giới thiệu:</strong> {selectedDoctorModal.description}
                  </p>
                )}

                {(selectedDoctorModal.email || selectedDoctorModal.phoneNumber) && (
                  <div className="p-3 bg-light rounded-3 mb-2 small text-muted">
                    {selectedDoctorModal.email && <div>✉ {selectedDoctorModal.email}</div>}
                    {selectedDoctorModal.phoneNumber && <div>☎ {selectedDoctorModal.phoneNumber}</div>}
                  </div>
                )}
              </Col>
            </Row>
          )}
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0">
          <Button variant="secondary" onClick={() => setSelectedDoctorModal(null)} className="rounded-pill px-4">
            Đóng
          </Button>
          {selectedDoctorModal && (
            <Button
              variant="primary"
              onClick={() => handleBook(selectedDoctorModal)}
              className="rounded-pill px-4"
              disabled={bookingDoctorId === selectedDoctorModal.id}
            >
              {bookingDoctorId === selectedDoctorModal.id ? 'Đang tải...' : 'Đặt lịch khám ngay'}
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </section>
  );
}
