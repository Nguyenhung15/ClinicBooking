import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Container, Spinner, Alert, Row, Col, Card, Badge, Button } from 'react-bootstrap';
import { fetchSpecialtyById, fetchSpecialties } from '../../api/specialty';
import { fetchDoctorsBySpecialty, type Doctor } from '../../api/doctor';
import type { Specialty } from '../../api/specialty';
import FAQAccordion, { getFAQsBySpecialtyId } from '../../components/specialty/FAQAccordion';
import DoctorsSection from '../../components/home/DoctorsSection';
import { useAuth } from '../../hooks/useAuth';
import { getDoctorImagePathWithFallback } from '../../utils/doctorImage';
import '../../styles/specialty-detail.css';

export default function SpecialtyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [specialty, setSpecialty] = useState<Specialty | null>(null);
  const [allSpecialties, setAllSpecialties] = useState<Specialty[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('Không tìm thấy chuyên khoa');
      setLoading(false);
      return;
    }

    const specialtyId = Number(id);
    if (isNaN(specialtyId)) {
      setError('ID chuyên khoa không hợp lệ');
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch specialty and all specialties (public)
        const [specialtyData, allSpecialtiesData] = await Promise.all([
          fetchSpecialtyById(specialtyId),
          fetchSpecialties(),
        ]);
        
        if (!specialtyData) {
          setError('Không tìm thấy chuyên khoa');
          setLoading(false);
          return;
        }

        setSpecialty(specialtyData);
        setAllSpecialties(allSpecialtiesData.filter(s => s.id !== specialtyId)); // Exclude current specialty

        // Try to fetch doctors (requires authentication)
        try {
          const doctorsData = await fetchDoctorsBySpecialty(specialtyId);
          setDoctors(doctorsData);
        } catch (doctorErr: unknown) {
          // If 401/403, user needs to login
          const axiosError = doctorErr as { response?: { status?: number }; status?: number };
          const status = axiosError?.response?.status || axiosError?.status;
          if (status === 401 || status === 403) {
            setDoctors([]);
            // Don't set error message for auth errors, we'll show a friendly message
          } else {
            // Only set error for other types of errors
            console.error('Error fetching doctors:', doctorErr);
            // Don't show error for guest users, just show empty state
            setDoctors([]);
          }
        }
      } catch (err: unknown) {
        const error = err as { message?: string };
        setError(error?.message || 'Đã có lỗi xảy ra khi tải dữ liệu');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  const faqs = useMemo(() => {
    if (!specialty) return [];
    return getFAQsBySpecialtyId(specialty.id);
  }, [specialty]);

  // Feature cards data based on specialty
  const featureCards = useMemo(() => {
    if (!specialty) return [];
    
    return [
      {
        icon: '👨‍⚕️',
        title: 'Bác sĩ giàu kinh nghiệm',
        description: `Đội ngũ bác sĩ chuyên khoa ${specialty.name} với nhiều năm kinh nghiệm, được đào tạo chuyên sâu và liên tục cập nhật kiến thức y học mới nhất.`,
      },
      {
        icon: '🏥',
        title: 'Trang thiết bị hiện đại',
        description: `Hệ thống máy móc và thiết bị y tế tiên tiến, đảm bảo chẩn đoán chính xác và điều trị hiệu quả cho các bệnh lý ${specialty.name}.`,
      },
      {
        icon: '💊',
        title: 'Điều trị toàn diện',
        description: `Phương pháp điều trị khoa học, kết hợp giữa y học hiện đại và chăm sóc tận tâm, mang lại kết quả tối ưu cho bệnh nhân.`,
      },
      {
        icon: '⭐',
        title: 'Dịch vụ chất lượng cao',
        description: `Cam kết mang đến dịch vụ y tế chất lượng cao với giá cả hợp lý, đảm bảo sự hài lòng và tin cậy của mọi bệnh nhân.`,
      },
    ];
  }, [specialty]);

  // Treatment cards (services offered in this specialty)
  const treatmentCards = useMemo(() => {
    if (!specialty) return [];
    
    // Generate treatment cards based on specialty name
    const treatments = [
      {
        icon: '🏥',
        title: 'Khám và chẩn đoán',
        description: `Khám tổng quát và chẩn đoán chính xác các bệnh lý liên quan đến ${specialty.name} bằng các phương pháp hiện đại.`,
      },
      {
        icon: '💉',
        title: 'Điều trị chuyên sâu',
        description: `Điều trị các bệnh lý ${specialty.name} với phác đồ điều trị cá nhân hóa, phù hợp với từng bệnh nhân.`,
      },
      {
        icon: '🔄',
        title: 'Theo dõi và tái khám',
        description: `Theo dõi tiến trình điều trị và tư vấn tái khám định kỳ để đảm bảo hiệu quả điều trị lâu dài.`,
      },
    ];
    
    return treatments;
  }, [specialty]);

  if (loading) {
    return (
      <Container className="py-5">
        <div className="text-center">
          <Spinner animation="border" role="status" />
          <p className="mt-3">Đang tải thông tin chuyên khoa...</p>
        </div>
      </Container>
    );
  }

  if (error || !specialty) {
    return (
      <Container className="py-5">
        <Alert variant="danger">
          {error || 'Không tìm thấy chuyên khoa'}
        </Alert>
      </Container>
    );
  }

  return (
    <div className="specialty-landing-page">
      {/* Hero Section with Booking Widget */}
      <section className="specialty-hero">
        <Container>
          <Row className="align-items-center">
            <Col lg={6}>
              <div className="specialty-hero__content">
                <Badge bg="light" text="primary" className="specialty-hero__badge mb-3">
                  Chuyên Khoa Y Tế
                </Badge>
                <h1 className="specialty-hero__title">
                  Chúng Tôi Quan Tâm Đến<br />
                  <span className="specialty-hero__title-highlight">Sức Khỏe {specialty.name}</span>
                </h1>
                <p className="specialty-hero__description">
                  {specialty.description || `Nếu bạn đang cần dịch vụ ${specialty.name} chất lượng cao, chuyên nghiệp và thân thiện, hãy đến với phòng khám của chúng tôi.`}
                </p>
              </div>
            </Col>
            <Col lg={6}>
              {/* Booking Widget */}
              <Card className="specialty-hero__booking-widget shadow-lg">
                <Card.Body className="p-4">
                  <h4 className="mb-4 text-primary fw-bold">Đặt Lịch Khám Ngay</h4>
                  <div className="mb-3">
                    <small className="text-muted d-block mb-1">Chuyên khoa</small>
                    <strong className="d-block">{specialty.name}</strong>
                  </div>
                  <div className="mb-3">
                    <small className="text-muted d-block mb-1">Số lượng bác sĩ</small>
                    <strong className="d-block">{doctors.length > 0 ? doctors.length : 'Nhiều'} bác sĩ chuyên khoa</strong>
                  </div>
                  <Button 
                    variant="primary" 
                    size="lg" 
                    className="w-100 mt-3"
                    onClick={() => {
                      if (isAuthenticated) {
                        navigate(`/appointment?specialtyId=${specialty.id}`);
                      } else {
                        navigate('/login');
                      }
                    }}
                  >
                    Đặt Lịch Khám
                  </Button>
                  {!isAuthenticated && (
                    <p className="text-muted small text-center mt-3 mb-0">
                      <Link to="/register" className="text-primary">Đăng ký</Link> hoặc <Link to="/login" className="text-primary">Đăng nhập</Link> để đặt lịch
                    </p>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>
      </section>

      {/* Why We Are Different Section */}
      <section className="specialty-why-different py-5">
        <Container>
          <div className="text-center mb-5">
            <h2 className="specialty-section-title">
              Tại Sao Chúng Tôi <span className="text-primary">Khác Biệt</span>
            </h2>
            <p className="lead text-muted mx-auto" style={{ maxWidth: '800px' }}>
              {specialty.description || `Chúng tôi là phòng khám tư nhân chuyên về ${specialty.name}, cam kết cung cấp dịch vụ y tế chất lượng cao với đội ngũ bác sĩ giàu kinh nghiệm.`}
            </p>
          </div>
          <Row className="g-4">
            {featureCards.map((feature, index) => (
              <Col key={index} md={6} lg={3}>
                <Card className="h-100 specialty-feature-card border-0 shadow-sm">
                  <Card.Body className="p-4 text-center">
                    <div className="specialty-feature-card__icon mb-3">
                      {feature.icon}
                    </div>
                    <h5 className="specialty-feature-card__title mb-3">{feature.title}</h5>
                    <p className="specialty-feature-card__description text-muted small">
                      {feature.description}
                    </p>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        </Container>
      </section>

      {/* Treatments/Services Section */}
      <section className="specialty-treatments py-5 bg-light">
        <Container>
          <div className="text-center mb-5">
            <h2 className="specialty-section-title">
              Các Dịch Vụ Điều Trị {specialty.name}
            </h2>
          </div>
          <Row className="g-4">
            {treatmentCards.map((treatment, index) => (
              <Col key={index} md={4}>
                <Card className="h-100 specialty-treatment-card border-0 shadow-sm">
                  <Card.Body className="p-4">
                    <div className="specialty-treatment-card__icon mb-3" style={{ fontSize: '3rem' }}>
                      {treatment.icon}
                    </div>
                    <h5 className="specialty-treatment-card__title mb-3">{treatment.title}</h5>
                    <p className="specialty-treatment-card__description text-muted">
                      {treatment.description}
                    </p>
                    <Button 
                      variant="outline-primary" 
                      size="sm" 
                      className="mt-3"
                      onClick={() => navigate(isAuthenticated ? `/appointment?specialtyId=${specialty.id}` : '/login')}
                    >
                      Tìm hiểu thêm
                    </Button>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        </Container>
      </section>

      {/* Expert Doctors Section */}
      {doctors.length > 0 && (
        <section className="specialty-experts py-5">
          <Container>
            <div className="text-center">
              <h2 className="specialty-section-title">
                Đội Ngũ <span className="text-primary">Chuyên Gia</span>
              </h2>
              <p className="lead text-muted mx-auto" style={{ maxWidth: '800px' }}>
                Đội ngũ bác sĩ chuyên khoa {specialty.name} giàu kinh nghiệm, tận tâm và chuyên nghiệp
              </p>
            </div>
            <DoctorsSection 
              title={`Bác Sĩ Chuyên Khoa ${specialty.name}`}
              doctors={doctors.map(d => ({
                id: d.id,
                fullName: d.fullName,
                degree: d.degree,
                specialtyName: d.specialtyName || specialty.name,
                avatarUrl: d.avatarUrl || d.imageUrl || d.photoUrl || getDoctorImagePathWithFallback(d.fullName) || undefined,
                email: d.email,
                phoneNumber: d.phoneNumber,
                description: d.description,
                experience: d.experience,
              }))}
            />
          </Container>
        </section>
      )}

      {/* Statistics Section */}
      <section className="specialty-statistics py-3 bg-primary text-white">
        <Container>
          <Row className="g-3 text-center justify-content-center">
            <Col xs={6} md={3}>
              <div className="specialty-stat-item">
                <div className="specialty-stat-item__number">{doctors.length > 0 ? doctors.length : '10+'}</div>
                <div className="specialty-stat-item__label">Bác Sĩ Chuyên Khoa</div>
              </div>
            </Col>
            <Col xs={6} md={3}>
              <div className="specialty-stat-item">
                <div className="specialty-stat-item__number">1000+</div>
                <div className="specialty-stat-item__label">Bệnh Nhân Đã Điều Trị</div>
              </div>
            </Col>
            <Col xs={6} md={3}>
              <div className="specialty-stat-item">
                <div className="specialty-stat-item__number">15+</div>
                <div className="specialty-stat-item__label">Năm Kinh Nghiệm</div>
              </div>
            </Col>
            <Col xs={6} md={3}>
              <div className="specialty-stat-item">
                <div className="specialty-stat-item__number">98%</div>
                <div className="specialty-stat-item__label">Hài Lòng</div>
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      {/* Other Specialties Section */}
      {allSpecialties.length > 0 && (
        <section className="specialty-partners py-5">
          <Container>
            <div className="text-center mb-5">
              <h2 className="specialty-section-title">
                Các Chuyên Khoa Khác
              </h2>
            </div>
            <Row className="g-4 justify-content-center">
              {allSpecialties.slice(0, 6).map((spec) => (
                <Col key={spec.id} xs={6} sm={4} md={3} lg={2}>
                  <Card 
                    className="h-100 specialty-partner-card border-0 shadow-sm text-center"
                    onClick={() => navigate(`/specialty/${spec.id}`)}
                    style={{ textDecoration: 'none', cursor: 'pointer' }}
                  >
                    <Card.Body className="p-3">
                      <div className="specialty-partner-card__icon mb-2" style={{ fontSize: '2rem' }}>
                        🏥
                      </div>
                      <Card.Title as="h6" className="text-primary small mb-0">
                        {spec.name}
                      </Card.Title>
                    </Card.Body>
                  </Card>
                </Col>
              ))}
            </Row>
          </Container>
        </section>
      )}

      {/* FAQ Section */}
      {faqs.length > 0 && (
        <section className="specialty-faq-section py-5 bg-light">
          <Container>
            <div className="text-center mb-5">
              <h2 className="specialty-section-title">
                Câu Hỏi Thường Gặp về <span className="text-primary">{specialty.name}</span>
              </h2>
            </div>
            <Row>
              <Col lg={8} className="mx-auto">
                <FAQAccordion faqs={faqs} />
              </Col>
            </Row>
          </Container>
        </section>
      )}

    </div>
  );
}
