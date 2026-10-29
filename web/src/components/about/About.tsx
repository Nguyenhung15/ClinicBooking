import { Container, Row, Col, Card } from 'react-bootstrap';
import '../../styles/about-section.css';

export default function About() {
  return (
    <section className="about-section">
      <Container className="py-5">
      <Row className="mb-5">
        <Col md={12} className="text-center">
          <h1 className="display-4 mb-3">Giới Thiệu Về Phòng Khám</h1>
          <p className="lead text-muted">
            Chăm sóc sức khỏe của bạn với đội ngũ y bác sĩ chuyên nghiệp và tận tâm
          </p>
        </Col>
      </Row>

      <Row className="mb-5">
        <Col md={6}>
          <Card className="h-100 shadow-sm">
            <Card.Body>
              <h3 className="mb-3">Sứ Mệnh</h3>
              <p>
                Phòng khám của chúng tôi cam kết cung cấp dịch vụ y tế chất lượng cao, 
                đảm bảo sự hài lòng và tin cậy của bệnh nhân. Chúng tôi luôn đặt sức khỏe 
                và sự an toàn của bệnh nhân lên hàng đầu.
              </p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="h-100 shadow-sm">
            <Card.Body>
              <h3 className="mb-3">Tầm Nhìn</h3>
              <p>
                Trở thành phòng khám hàng đầu trong khu vực, được công nhận về chất lượng 
                dịch vụ, đội ngũ y bác sĩ chuyên nghiệp và công nghệ y tế hiện đại. 
                Chúng tôi không ngừng cải thiện và nâng cao chất lượng phục vụ.
              </p>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="mb-5">
        <Col md={12}>
          <Card className="shadow-sm">
            <Card.Body>
              <h3 className="mb-4">Giá Trị Cốt Lõi</h3>
              <Row>
                <Col md={4} className="mb-3">
                  <h5 className="text-primary">Chuyên Nghiệp</h5>
                  <p>
                    Đội ngũ y bác sĩ có trình độ cao, giàu kinh nghiệm và luôn cập nhật 
                    kiến thức y tế mới nhất.
                  </p>
                </Col>
                <Col md={4} className="mb-3">
                  <h5 className="text-primary">Tận Tâm</h5>
                  <p>
                    Chúng tôi luôn lắng nghe và thấu hiểu nhu cầu của bệnh nhân, 
                    cung cấp dịch vụ chăm sóc tận tình và chu đáo.
                  </p>
                </Col>
                <Col md={4} className="mb-3">
                  <h5 className="text-primary">Đáng Tin Cậy</h5>
                  <p>
                    Uy tín và chất lượng là nền tảng của mọi hoạt động. 
                    Chúng tôi cam kết đảm bảo an toàn và hiệu quả trong điều trị.
                  </p>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row>
        <Col md={12}>
          <Card className="shadow-sm">
            <Card.Body>
              <h3 className="mb-4">Dịch Vụ</h3>
              <Row>
                <Col md={6} className="mb-3">
                  <h5>Khám Bệnh Tổng Quát</h5>
                  <p className="text-muted">
                    Khám sức khỏe định kỳ và điều trị các bệnh thông thường
                  </p>
                </Col>
                <Col md={6} className="mb-3">
                  <h5>Chuyên Khoa</h5>
                  <p className="text-muted">
                    Đa dạng các chuyên khoa với đội ngũ bác sĩ chuyên sâu
                  </p>
                </Col>
                <Col md={6} className="mb-3">
                  <h5>Đặt Lịch Trực Tuyến</h5>
                  <p className="text-muted">
                    Đặt lịch hẹn khám dễ dàng, nhanh chóng qua hệ thống online
                  </p>
                </Col>
                <Col md={6} className="mb-3">
                  <h5>Tư Vấn Sức Khỏe</h5>
                  <p className="text-muted">
                    Tư vấn và hướng dẫn chăm sóc sức khỏe tại nhà
                  </p>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      </Container>
    </section>
  );
}

