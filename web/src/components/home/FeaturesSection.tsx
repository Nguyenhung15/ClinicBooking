import { Container, Row, Col, Card, Button } from 'react-bootstrap';
import { NavLink } from 'react-router-dom';
import '../../styles/features-section.css';

export default function FeaturesSection() {
  return (
    <section className="features-section py-5">
      <Container>
        <div className="text-center mb-5 features-header">
          <span className="features-badge">TẠI SAO CHỌN PHÒNG KHÁM CỦA CHÚNG TÔI</span>
          <h2 className="features-main-title mt-2">Trải Nghiệm Khám Chữa Bệnh Chuẩn Mực &amp; Toàn Diện</h2>
          <p className="features-subtitle text-muted mx-auto">
            Hệ thống y tế hiện đại với dịch vụ chu đáo, tiện lợi và luôn đặt quyền lợi của bệnh nhân làm trọng tâm.
          </p>
        </div>

        <Row className="g-4">
          <Col md={4}>
            <Card className="feature-card h-100 border-0">
              <Card.Body className="p-4 d-flex flex-column justify-content-between">
                <div>
                  <div className="feature-icon-wrapper tone-blue mb-4">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>
                    </svg>
                  </div>
                  <h3 className="mb-3 feature-card__title">Chủ động chăm sóc sức khỏe</h3>
                  <p className="feature-card__desc text-muted">
                    Không cần chờ đợi hay xếp hàng dài - bạn có thể chủ động đặt lịch khám bệnh trực tuyến mọi lúc, mọi nơi. 
                    Hệ thống thông minh giúp bạn lựa chọn đúng chuyên khoa, đúng bác sĩ và thời gian thuận tiện.
                  </p>
                </div>
                <NavLink to="/appointment" className="mt-4 text-decoration-none">
                  <Button variant="primary" className="feature-btn w-100">
                    <span>ĐĂNG KÝ NGAY</span>
                    <span className="btn-arrow">→</span>
                  </Button>
                </NavLink>
              </Card.Body>
            </Card>
          </Col>

          <Col md={4}>
            <Card className="feature-card h-100 border-0">
              <Card.Body className="p-4 d-flex flex-column justify-content-between">
                <div>
                  <div className="feature-icon-wrapper tone-teal mb-4">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                  </div>
                  <h3 className="mb-3 feature-card__title">Đội ngũ Y, Bác sĩ uy tín</h3>
                  <p className="feature-card__desc text-muted">
                    Chúng tôi tự hào sở hữu đội ngũ bác sĩ giàu kinh nghiệm, có chuyên môn sâu trong từng lĩnh vực và 
                    luôn đặt sự an toàn của bệnh nhân lên hàng đầu. Sẵn sàng lắng nghe và đồng hành cùng bạn trong hành trình chăm sóc sức khỏe.
                  </p>
                </div>
                <NavLink to="/doctors" className="mt-4 text-decoration-none">
                  <Button variant="primary" className="feature-btn w-100">
                    <span>CHUYÊN GIA - BÁC SĨ</span>
                    <span className="btn-arrow">→</span>
                  </Button>
                </NavLink>
              </Card.Body>
            </Card>
          </Col>

          <Col md={4}>
            <Card className="feature-card h-100 border-0">
              <Card.Body className="p-4 d-flex flex-column justify-content-between">
                <div>
                  <div className="feature-icon-wrapper tone-purple mb-4">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                    </svg>
                  </div>
                  <h3 className="mb-3 feature-card__title">Khám đúng chuyên khoa</h3>
                  <p className="feature-card__desc text-muted">
                    Hệ thống phòng khám cung cấp đầy đủ các chuyên khoa như Cơ Xương Khớp, Răng Hàm Mặt, Mắt giúp bạn 
                    dễ dàng lựa chọn dịch vụ phù hợp với nhu cầu bản thân, đảm bảo hiệu quả và sự an tâm tuyệt đối.
                  </p>
                </div>
                <NavLink to="/appointment" className="mt-4 text-decoration-none">
                  <Button variant="primary" className="feature-btn w-100">
                    <span>CHUYÊN KHOA</span>
                    <span className="btn-arrow">→</span>
                  </Button>
                </NavLink>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </section>
  );
}

