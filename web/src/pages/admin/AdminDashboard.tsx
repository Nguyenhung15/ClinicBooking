import { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Row, Spinner, Table } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { fetchAdminUsers, fetchAdminReceptionists, type AdminUser } from '../../api/admin';
import { fetchDoctorsAll, type Doctor } from '../../api/doctor';

type EnhancedUser = AdminUser & { role: string };

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [receptionists, setReceptionists] = useState<AdminUser[]>([]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');

    Promise.all([
      fetchAdminUsers(),
      fetchDoctorsAll(),
      fetchAdminReceptionists(),
    ])
      .then(([usersData, doctorsData, receptionistsData]) => {
        if (!alive) return;
        setUsers(usersData ?? []);
        setDoctors(doctorsData ?? []);
        setReceptionists(receptionistsData ?? []);
      })
      .catch((err) => {
        if (!alive) return;
        const message = err?.message || 'Không thể tải dữ liệu tổng quan';
        setError(message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const doctorIds = useMemo(() => new Set(doctors.map((d) => d.id)), [doctors]);
  const receptionistIds = useMemo(() => new Set(receptionists.map((r) => r.id)), [receptionists]);

  const enhancedUsers: EnhancedUser[] = useMemo(
    () =>
      users.map((user) => {
        let role = 'Patient / Other';
        if (doctorIds.has(user.id)) role = 'Doctor';
        else if (receptionistIds.has(user.id)) role = 'Receptionist';
        return { ...user, role };
      }),
    [users, doctorIds, receptionistIds]
  );

  const stats = [
    {
      label: 'Tổng người dùng',
      value: users.length,
      color: '#e6f0ff',
    },
    {
      label: 'Bác sĩ',
      value: doctors.length,
      color: '#fff4d6',
    },
    {
      label: 'Lễ tân',
      value: receptionists.length,
      color: '#dff7f0',
    },
  ];

  const topUsers = enhancedUsers.slice(0, 7);
  const topDoctors = doctors.slice(0, 7);
  const topReceptionists = receptionists.slice(0, 7);

  return (
    <div className="vstack gap-4">
      <h2 className="fw-bold">Tổng quan hệ thống</h2>

      {loading && (
        <div className="d-flex align-items-center gap-2">
          <Spinner animation="border" size="sm" /> <span>Đang tải dữ liệu…</span>
        </div>
      )}

      {!loading && (
        <>
          <Row className="g-3">
            {stats.map((stat) => (
              <Col key={stat.label} md={4} sm={12}>
                <Card className="shadow-sm h-100 border-0" style={{ backgroundColor: stat.color }}>
                  <Card.Body className="d-flex flex-column justify-content-between">
                    <div>
                      <div className="text-muted text-uppercase fw-semibold" style={{ fontSize: 12 }}>
                        {stat.label}
                      </div>
                      <div className="display-6 fw-bold mt-1">{stat.value}</div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>

          {error && (
            <Alert variant="danger" className="mb-0">
              {error}
            </Alert>
          )}

          <Row className="g-4">
            <Col xl={6} md={12}>
              <Card className="shadow-sm border-0 h-100">
                <Card.Header className="d-flex justify-content-between align-items-center">
                  <Card.Title as="h5" className="mb-0">
                    Người dùng gần đây
                  </Card.Title>
                  <Button
                    size="sm"
                    variant="link"
                    className="p-0"
                    onClick={() => navigate('/admin/create-user')}
                  >
                    Tạo mới
                  </Button>
                </Card.Header>
                <Card.Body className="p-0">
                  <Table responsive hover className="mb-0">
                    <thead>
                      <tr>
                        <th>Tên</th>
                        <th>Email</th>
                        <th>Số điện thoại</th>
                        <th>Loại</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topUsers.length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-center py-3 text-muted">
                            Chưa có dữ liệu người dùng
                          </td>
                        </tr>
                      )}
                      {topUsers.map((user) => (
                        <tr key={user.id}>
                          <td>{user.fullName}</td>
                          <td>{user.email ?? '—'}</td>
                          <td>{user.phoneNumber ?? '—'}</td>
                          <td>
                            <Badge bg={user.role === 'Doctor' ? 'primary' : user.role === 'Receptionist' ? 'info' : 'secondary'}>
                              {user.role}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </Col>

            <Col xl={6} md={12}>
              <Card className="shadow-sm border-0 h-100">
                <Card.Header className="d-flex justify-content-between align-items-center">
                  <Card.Title as="h5" className="mb-0">
                    Bác sĩ nổi bật
                  </Card.Title>
                  <Button
                    size="sm"
                    variant="link"
                    className="p-0"
                    onClick={() => navigate('/admin/doctors')}
                  >
                    Xem tất cả
                  </Button>
                </Card.Header>
                <Card.Body className="p-0">
                  <Table responsive hover className="mb-0">
                    <thead>
                      <tr>
                        <th>Tên</th>
                        <th>Chuyên khoa</th>
                        <th>Kinh nghiệm</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topDoctors.length === 0 && (
                        <tr>
                          <td colSpan={3} className="text-center py-3 text-muted">
                            Chưa có dữ liệu bác sĩ
                          </td>
                        </tr>
                      )}
                      {topDoctors.map((doctor) => (
                        <tr key={doctor.id}>
                          <td>{doctor.fullName}</td>
                          <td>{doctor.specialtyName ?? '—'}</td>
                          <td>{doctor.experience ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <Row className="g-4">
            <Col xl={6} md={12}>
              <Card className="shadow-sm border-0 h-100">
                <Card.Header className="d-flex justify-content-between align-items-center">
                  <Card.Title as="h5" className="mb-0">
                    Lễ tân
                  </Card.Title>
                  <Button
                    size="sm"
                    variant="link"
                    className="p-0"
                    onClick={() => navigate('/admin/receptionists')}
                  >
                    Quản lý lễ tân
                  </Button>
                </Card.Header>
                <Card.Body className="p-0">
                  <Table responsive hover className="mb-0">
                    <thead>
                      <tr>
                        <th>Tên</th>
                        <th>Email</th>
                        <th>Số điện thoại</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topReceptionists.length === 0 && (
                        <tr>
                          <td colSpan={3} className="text-center py-3 text-muted">
                            Chưa có dữ liệu lễ tân
                          </td>
                        </tr>
                      )}
                      {topReceptionists.map((rec) => (
                        <tr key={rec.id}>
                          <td>{rec.fullName}</td>
                          <td>{rec.email ?? '—'}</td>
                          <td>{rec.phoneNumber ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
}
