import { Container, Row, Col, Card, Button, Accordion, Carousel, Modal } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import '../../styles/services-page.css';

const reasons = [
  {
    image: '/anh/doingubacsi.jpg',
    title: 'Đội ngũ bác sĩ uy tín',
    description: 'Bác sĩ được chọn lọc, có chứng chỉ hành nghề và nhiều năm kinh nghiệm.',
  },
  {
    image: '/anh/datlichnhanh.jpg',
    title: 'Đặt lịch nhanh, giảm thời gian chờ',
    description: 'Chủ động chọn giờ khám phù hợp, hạn chế xếp hàng.',
  },
  {
    image: '/anh/baomatthongtin.jpg',
    title: 'Bảo mật thông tin bệnh nhân',
    description: 'Thông tin được mã hóa và chỉ dùng cho mục đích khám chữa bệnh.',
  },
  {
    image: '/anh/hotrotantam.jpg',
    title: 'Hỗ trợ tận tâm',
    description: 'Lễ tân và đội ngũ hỗ trợ luôn sẵn sàng giải đáp trong giờ làm việc.',
  },
];

const faqs = [
  {
    question: 'Đặt lịch có mất phí không?',
    answer: 'Đặt lịch khám tại phòng khám hoàn toàn miễn phí. Bạn chỉ cần thanh toán phí khám khi đến khám theo lịch đã đặt.',
  },
  {
    question: 'Tôi có thể hủy hoặc đổi lịch như thế nào?',
    answer: 'Bạn có thể hủy hoặc đổi lịch khám thông qua tài khoản của mình trên hệ thống, hoặc liên hệ trực tiếp với lễ tân qua hotline. Vui lòng thông báo trước ít nhất 2 giờ để chúng tôi có thể sắp xếp lại.',
  },
  {
    question: 'Đặt lịch khám online có sử dụng bảo hiểm được không?',
    answer: 'Hiện tại, dịch vụ khám online chưa hỗ trợ thanh toán bằng bảo hiểm y tế. Bạn có thể sử dụng bảo hiểm khi khám trực tiếp tại phòng khám.',
  },
  {
    question: 'Làm sao để biết lịch đã được xác nhận?',
    answer: 'Sau khi đặt lịch thành công, bạn sẽ nhận được email và tin nhắn SMS xác nhận. Bạn cũng có thể kiểm tra trạng thái lịch hẹn trong tài khoản của mình trên hệ thống.',
  },
];

export default function Services() {
  const navigate = useNavigate();
  const [showPackageModal, setShowPackageModal] = useState(false);

  const services = [
    {
      id: 1,
      image: '/imgs/datlichkham.jpg',
      title: 'Đặt lịch khám trực tiếp',
      description: 'Đặt lịch khám tại phòng khám theo bác sĩ, chuyên khoa và khung giờ mong muốn. Giảm tối đa thời gian chờ.',
      note: 'Khám lần đầu, tái khám',
      buttonText: 'Đặt khám trực tiếp',
      buttonAction: () => navigate('/appointment'),
    },
    {
      id: 2,
      image: '/imgs/khamonline.jpg',
      title: 'Khám online (Video/Chat)',
      description: 'Tư vấn từ xa với bác sĩ qua video hoặc chat cho các vấn đề sức khỏe phổ biến, đọc kết quả xét nghiệm, điều chỉnh đơn thuốc…',
      buttonText: 'Đặt lịch khám online',
      buttonAction: () => navigate('/appointment'),
    },
    {
      id: 3,
      image: '/imgs/goikhamsuckhoa.jpg',
      title: 'Gói khám sức khỏe tổng quát',
      description: 'Các gói khám sức khỏe định kỳ cho cá nhân và gia đình, phù hợp từng độ tuổi và giới tính.',
      buttonText: 'Xem gói khám',
      buttonAction: () => setShowPackageModal(true),
    },
    {
      id: 4,
      image: '/imgs/khamtheochuyenkhoa.jpg',
      title: 'Khám theo chuyên khoa',
      description: 'Lựa chọn chuyên khoa phù hợp: Nội tổng quát, Cơ xương khớp, Răng Hàm Mặt, Mắt - Tai Mũi Họng, Xét nghiệm',
      buttonText: 'Chọn chuyên khoa',
      buttonAction: () => navigate('/doctors'),
    },
    {
      id: 5,
      image: '/imgs/xetnghiem&chandoan.jpg',
      title: 'Xét nghiệm & chẩn đoán',
      description: 'Đặt lịch xét nghiệm máu, nước tiểu, sinh hóa, chẩn đoán hình ảnh (X-quang, siêu âm…) tại cơ sở.',
      buttonText: 'Đặt lịch xét nghiệm',
      buttonAction: () => navigate('/appointment'),
    },
    {
      id: 6,
      image: '/imgs/tuvansuckhoe.jpg',
      title: 'Tư vấn sức khỏe & quản lý bệnh mãn tính',
      description: 'Đồng hành lâu dài cùng bệnh nhân tăng huyết áp, tiểu đường… thông qua các buổi tư vấn định kỳ.',
      buttonText: 'Đăng ký tư vấn',
      buttonAction: () => navigate('/appointment'),
    },
  ];

  const scrollToServices = () => {
    const servicesSection = document.getElementById('services-list');
    if (servicesSection) {
      servicesSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const scrollToProcess = () => {
    const processSection = document.getElementById('booking-process');
    if (processSection) {
      processSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="services-page">
      {/* Hero Section */}
      <section className="services-hero">
        <div className="services-hero__carousel">
          <Carousel fade indicators={false} controls={true} interval={3000}>
            <Carousel.Item>
              <img
                className="d-block w-100"
                src="/img/dichvu1.jpg"
                alt="Dịch vụ khám chữa bệnh 1"
              />
            </Carousel.Item>
            <Carousel.Item>
              <img
                className="d-block w-100"
                src="/img/dichvu2.jpg"
                alt="Dịch vụ khám chữa bệnh 2"
              />
            </Carousel.Item>
            <Carousel.Item>
              <img
                className="d-block w-100"
                src="/img/dichvu3.jpg"
                alt="Dịch vụ khám chữa bệnh 3"
              />
            </Carousel.Item>
          </Carousel>
        </div>
        <Container>
          <Row className="justify-content-center">
            <Col lg={10} className="services-hero__content text-center">
              <h1 className="services-hero__title">
                Dịch vụ khám & đặt lịch tại <span className="text-primary">Clinic Booking</span>
              </h1>
              <p className="services-hero__description">
                Đặt lịch khám dễ dàng, hạn chế xếp hàng chờ đợi.
                <br />
                Chọn bác sĩ, chuyên khoa, hình thức khám (trực tiếp hoặc online) chỉ trong vài bước.
              </p>
              <div className="services-hero__actions">
                <Button
                  variant="primary"
                  size="lg"
                  className="me-3"
                  onClick={scrollToServices}
                >
                  Đặt lịch ngay
                </Button>
                <Button
                  variant="outline-primary"
                  size="lg"
                  onClick={scrollToProcess}
                >
                  Xem hướng dẫn
                </Button>
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      {/* Services List */}
      <section id="services-list" className="services-list-section">
        <Container>
          <h2 className="section-title text-center mb-5">Danh sách dịch vụ</h2>
          <Row className="g-4">
            {services.map((service) => (
              <Col key={service.id} md={6} lg={4}>
                <Card className="service-card h-100">
                  <div className="service-card__image">
                    <img src={service.image} alt={service.title} />
                  </div>
                  <Card.Body className="p-4">
                    <h3 className="service-card__title">{service.title}</h3>
                    <p className="service-card__description">{service.description}</p>
                    {service.note && (
                      <p className="service-card__note">
                        <small className="text-muted">
                          <i className="bi bi-info-circle me-1"></i>
                          {service.note}
                        </small>
                      </p>
                    )}
                    <Button
                      variant="primary"
                      className="service-card__button w-100 mt-3"
                      onClick={service.buttonAction}
                    >
                      {service.buttonText}
                    </Button>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        </Container>
      </section>

      {/* Why Choose Us */}
      <section className="why-choose-section">
        <Container>
          <h2 className="section-title text-center mb-5">Lý do nên chọn chúng tôi</h2>
          <Row className="g-4">
            {reasons.map((reason, index) => (
              <Col key={index} md={6} lg={3}>
                <div className="reason-card text-center">
                  <div className="reason-card__icon">
                    <img src={reason.image} alt={reason.title} />
                  </div>
                  <h4 className="reason-card__title">{reason.title}</h4>
                  <p className="reason-card__description">{reason.description}</p>
                </div>
              </Col>
            ))}
          </Row>
        </Container>
      </section>

      {/* Booking Process */}
      <section id="booking-process" className="booking-process-section">
        <Container>
          <h2 className="section-title text-center mb-5">Quy trình đặt lịch</h2>
          <Row className="justify-content-center">
            <Col lg={8}>
              <div className="process-steps">
                <div className="process-step">
                  <div className="process-step__number">1</div>
                  <div className="process-step__content">
                    <h4>Chọn bác sĩ hoặc chuyên khoa</h4>
                    <p>Tìm kiếm và chọn bác sĩ phù hợp với nhu cầu của bạn</p>
                  </div>
                </div>
                <div className="process-step">
                  <div className="process-step__number">2</div>
                  <div className="process-step__content">
                    <h4>Chọn thời gian khám</h4>
                    <p>Xem lịch trống và chọn khung giờ thuận tiện nhất</p>
                  </div>
                </div>
                <div className="process-step">
                  <div className="process-step__number">3</div>
                  <div className="process-step__content">
                    <h4>Điền thông tin và xác nhận</h4>
                    <p>Nhập thông tin cá nhân và xác nhận đặt lịch</p>
                  </div>
                </div>
                <div className="process-step">
                  <div className="process-step__number">4</div>
                  <div className="process-step__content">
                    <h4>Nhận xác nhận</h4>
                    <p>Nhận email và SMS xác nhận lịch hẹn</p>
                  </div>
                </div>
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      {/* FAQ Section */}
      <section className="faq-section">
        <Container>
          <h2 className="section-title text-center mb-5">Câu hỏi thường gặp</h2>
          <Row className="justify-content-center">
            <Col lg={8}>
              <Accordion defaultActiveKey="0" className="faq-accordion">
                {faqs.map((faq, index) => (
                  <Accordion.Item key={index} eventKey={index.toString()}>
                    <Accordion.Header>{faq.question}</Accordion.Header>
                    <Accordion.Body>{faq.answer}</Accordion.Body>
                  </Accordion.Item>
                ))}
              </Accordion>
              <div className="text-center mt-5">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/appointment')}
                >
                  Đặt lịch ngay
                </Button>
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      {/* Package Modal */}
      <Modal
        show={showPackageModal}
        onHide={() => setShowPackageModal(false)}
        size="lg"
        centered
        className="package-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title>Gói khám sức khỏe tổng quát</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="package-modal__content">
            <p className="package-modal__description">
              Đánh giá tổng quát tình trạng sức khỏe, kiểm tra sức khỏe và sự phát triển của trẻ nhỏ và phát hiện sớm các bệnh lý thường gặp ở người trưởng thành.
            </p>

            <div className="package-modal__features">
              <h5 className="package-modal__features-title">Nội dung gói khám:</h5>
              <ul className="package-modal__features-list">
                <li>Khám nội tổng quát với bác sĩ chuyên khoa</li>
                <li>Xét nghiệm máu, nước tiểu cơ bản, xét nghiệm cận lâm sàng, chẩn đoán hình ảnh</li>
                <li>Đo điện tim, chụp X-quang ngực</li>
                <li>Tư vấn kết quả và hướng dẫn theo dõi sau khám nhằm đánh giá toàn diện tình trạng sức khỏe nội khoa, chức năng các cơ quan quan trọng như tim mạch, gan, thận, tuyến giáp, đồng thời tầm soát sớm nguy cơ các bệnh lý chuyển hóa phổ biến ở nữ giới.</li>
              </ul>
            </div>

            <div className="package-modal__target">
              <h5 className="package-modal__target-title">Đối tượng:</h5>
              <p className="package-modal__target-text">
                Phù hợp với mọi lứa tuổi. Khám sức khỏe định kỳ hằng năm.
              </p>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowPackageModal(false)}>
            Đóng
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

