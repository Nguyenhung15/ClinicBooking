import { Form, Row, Col, Button } from 'react-bootstrap';

export interface DoctorFilter {
  name: string;
  gender: string;
  experience: string;
  insurance: string;
  shift: string;
}

interface DoctorFilterBarProps {
  filters: DoctorFilter;
  onFilterChange: (filters: DoctorFilter) => void;
  onReset: () => void;
}

export default function DoctorFilterBar({ filters, onFilterChange, onReset }: DoctorFilterBarProps) {
  const handleChange = (field: keyof DoctorFilter, value: string) => {
    onFilterChange({
      ...filters,
      [field]: value,
    });
  };

  return (
    <div className="doctor-filter-bar mb-4">
      <Form>
        <Row className="g-3">
          <Col md={3}>
            <Form.Group>
              <Form.Label>Tên bác sĩ</Form.Label>
              <Form.Control
                type="text"
                placeholder="Tìm kiếm..."
                value={filters.name}
                onChange={(e) => handleChange('name', e.target.value)}
              />
            </Form.Group>
          </Col>
          <Col md={2}>
            <Form.Group>
              <Form.Label>Giới tính</Form.Label>
              <Form.Select
                value={filters.gender}
                onChange={(e) => handleChange('gender', e.target.value)}
              >
                <option value="">Tất cả</option>
                <option value="Male">Nam</option>
                <option value="Female">Nữ</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={2}>
            <Form.Group>
              <Form.Label>Kinh nghiệm</Form.Label>
              <Form.Select
                value={filters.experience}
                onChange={(e) => handleChange('experience', e.target.value)}
              >
                <option value="">Tất cả</option>
                <option value="0-5">0-5 năm</option>
                <option value="5-10">5-10 năm</option>
                <option value="10-15">10-15 năm</option>
                <option value="15+">15+ năm</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={2}>
            <Form.Group>
              <Form.Label>Ca làm việc</Form.Label>
              <Form.Select
                value={filters.shift}
                onChange={(e) => handleChange('shift', e.target.value)}
              >
                <option value="">Tất cả</option>
                <option value="MORNING">Sáng</option>
                <option value="AFTERNOON">Chiều</option>
                <option value="EVENING">Tối</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={3} className="d-flex align-items-end">
            <Button variant="outline-secondary" onClick={onReset} className="w-100">
              Đặt lại
            </Button>
          </Col>
        </Row>
      </Form>
    </div>
  );
}

