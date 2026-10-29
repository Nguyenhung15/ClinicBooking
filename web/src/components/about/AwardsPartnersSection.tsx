import { Container, Row, Col, Card } from 'react-bootstrap';
import '../../styles/awards-partners-section.css';

export default function AwardsPartnersSection() {
  return (
    <section className="awards-partners-section py-5">
      <Container>
        <Row className="mb-5">
          <Col md={12} className="text-center">
            <h2 className="display-5 fw-bold text-primary mb-4">Chứng nhận & Giải thưởng và Đối tác của chúng tôi</h2>
          </Col>
        </Row>

        <Row className="g-4 mb-5">
          <Col md={6}>
            <Card className="h-100 shadow-sm border-0">
              <Card.Body className="p-4">
                <h3 className="mb-4 text-primary fw-bold">Chứng nhận & Giải thưởng</h3>
                <p className="text-muted mb-4">
                  Chúng tôi tự hào với những chứng nhận và giải thưởng uy tín trong ngành y tế, 
                  minh chứng cho chất lượng dịch vụ và sự tận tâm của đội ngũ.
                </p>
                <div className="awards-partners-section__content">
                  <div className="awards-partners-section__item">
                    <div className="awards-partners-section__image-wrapper">
                      <img 
                        src="/picture/about/chung-nhan-iso.jpg" 
                        alt="Chứng nhận ISO 9001:2015"
                        className="awards-partners-section__image"
                      />
                    </div>
                    <div>
                      <h5 className="fw-bold">Chứng nhận ISO 9001:2015</h5>
                      <p className="text-muted mb-0">Hệ thống quản lý chất lượng quốc tế</p>
                    </div>
                  </div>
                  <div className="awards-partners-section__item">
                    <div className="awards-partners-section__image-wrapper">
                      <img 
                        src="/picture/about/giaithuong.jpg" 
                        alt="Giải thưởng Phòng khám xuất sắc"
                        className="awards-partners-section__image"
                      />
                    </div>
                    <div>
                      <h5 className="fw-bold">Giải thưởng Phòng khám xuất sắc</h5>
                      <p className="text-muted mb-0">Năm 2024</p>
                    </div>
                  </div>
                  <div className="awards-partners-section__item">
                    <div className="awards-partners-section__image-wrapper">
                      <img 
                        src="/picture/about/JCI.jpg" 
                        alt="Chứng nhận JCI"
                        className="awards-partners-section__image"
                      />
                    </div>
                    <div>
                      <h5 className="fw-bold">Chứng nhận JCI</h5>
                      <p className="text-muted mb-0">Tiêu chuẩn chất lượng quốc tế</p>
                    </div>
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Col>
          <Col md={6}>
            <Card className="h-100 shadow-sm border-0">
              <Card.Body className="p-4">
                <h3 className="mb-4 text-primary fw-bold">Đối tác của chúng tôi</h3>
                <p className="text-muted mb-4">
                  Chúng tôi hợp tác với các tổ chức y tế hàng đầu và các đối tác chiến lược 
                  để mang đến dịch vụ tốt nhất cho bệnh nhân.
                </p>
                <div className="awards-partners-section__content">
                  <div className="awards-partners-section__item">
                    <div className="awards-partners-section__image-wrapper">
                      <img 
                        src="/picture/about/benhviendaihocy.webp" 
                        alt="Bệnh viện Đại học Y"
                        className="awards-partners-section__image"
                      />
                    </div>
                    <div>
                      <h5 className="fw-bold">Bệnh viện Đại học Y Hà Nội</h5>
                      <p className="text-muted mb-0">Đối tác chuyển giao công nghệ</p>
                    </div>
                  </div>
                  <div className="awards-partners-section__item">
                    <div className="awards-partners-section__image-wrapper">
                      <img 
                        src="/picture/about/tapdoanyte.jpg" 
                        alt="Tập đoàn Y tế quốc tế"
                        className="awards-partners-section__image"
                      />
                    </div>
                    <div>
                      <h5 className="fw-bold">Tập đoàn Y tế quốc tế</h5>
                      <p className="text-muted mb-0">Hợp tác đào tạo và nghiên cứu</p>
                    </div>
                  </div>
                  <div className="awards-partners-section__item">
                    <div className="awards-partners-section__image-wrapper">
                      <img 
                        src="/picture/about/hiephoiykhoa.webp" 
                        alt="Hiệp hội Y khoa"
                        className="awards-partners-section__image"
                      />
                    </div>
                    <div>
                      <h5 className="fw-bold">Hiệp hội Y khoa</h5>
                      <p className="text-muted mb-0">Thành viên chính thức</p>
                    </div>
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </section>
  );
}

