import { Link, useNavigate } from 'react-router-dom';
import { Container, Row, Col, Button} from 'react-bootstrap';
import '../../styles/error.css';

export default function NotFound() {
  const navigate = useNavigate();
  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/", { replace: true });
  };
  return (
    <section className="err-wrap" aria-labelledby="nf-title">
      <Container>
        <Row className="justify-content-center">
          <Col md={10} lg={8} xl={6}>
            <div className="err-card shadow-sm">
              <div className="err-code err-404" aria-hidden>404</div>
              <h1 id="nf-title" className="err-title">Trang không tồn tại</h1>
              <p className="err-desc">
                Đường dẫn bạn truy cập có thể đã bị thay đổi hoặc không còn tồn tại.
              </p>
              <div className="err-actions">
                <Button variant="primary" size="lg" className="me-2" onClick={goBack}>
                  Quay lại trang trước
                </Button>
                <Link to="/" className="btn btn-danger btn-lg err-btn">
                Quay lại Trang chủ
                </Link>
              </div>
            </div>
          </Col>
        </Row>
      </Container>
    </section>
  );
}
