import { Link } from 'react-router-dom';
import { Container, Row, Col} from 'react-bootstrap';
import '../../styles/error.css';

export default function Forbidden() {
  return (
    <section className="err-wrap" aria-labelledby="fb-title">
      <Container>
        <Row className="justify-content-center">
          <Col md={10} lg={8} xl={6}>
            <div className="err-card shadow-sm">
              <div className="err-code err-403" aria-hidden>403</div>
              <h1 id="fb-title" className="err-title">Truy cập bị từ chối</h1>
              <p className="err-desc">
                Bạn không có quyền truy cập trang này. Vui lòng đăng nhập bằng tài khoản phù hợp
                hoặc quay lại trang chủ.
              </p>
              <div className="err-actions">
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
