import { useState } from "react";
import type { FormEvent } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Form,
  InputGroup,
  Row,
  Spinner,
  Table,
} from "react-bootstrap";
import {
  fetchUserVouchersForReception,
  searchUsersForReception,
  useVoucherForUserReception,
} from "../../api/receptionist";
import {
  type UserVoucher,
  type VoucherType,
} from "../../api/voucher";
import "../../styles/appointmentlist.css";

const VoucherTypeLabel: Record<VoucherType, string> = {
  SERVICE_TICKET: "Vé dịch vụ",
  DISCOUNT: "Giảm giá",
};

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN");
}

export default function RecepVouchers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<
    { id: number; fullName?: string | null; email?: string | null; phone?: string | null }[]
  >([]);
  const [selectedUser, setSelectedUser] = useState<
    { id: number; fullName?: string | null; email?: string | null; phone?: string | null } | null
  >(null);
  const [vouchers, setVouchers] = useState<UserVoucher[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [usingVoucherId, setUsingVoucherId] = useState<number | null>(null);

  const loadUserVouchers = async (user: { id: number; fullName?: string | null }) => {
    setSelectedUser(user);
    setLoading(true);
    setError("");
    setSuccessMessage("");
    try {
      const list = await fetchUserVouchersForReception(user.id);
      setVouchers(list);
      if (list.length === 0) {
        setSuccessMessage(`${user.fullName || `User #${user.id}`} chưa sở hữu voucher nào.`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Không thể tải voucher của người dùng.";
      setError(message);
      setVouchers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const keyword = searchTerm.trim();
    if (keyword.length === 0) {
      setError("Vui lòng nhập tên, email hoặc số điện thoại để tìm kiếm.");
      return;
    }
    setError("");
    setSuccessMessage("");
    setSearching(true);
    try {
      const users = await searchUsersForReception(keyword);
      setSearchResults(users);
      if (users.length === 1) {
        void loadUserVouchers(users[0]);
      } else {
        setSelectedUser(null);
        setVouchers([]);
      }
      if (users.length === 0) {
        setSuccessMessage("Không tìm thấy người dùng phù hợp.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Không thể tìm kiếm người dùng.";
      setError(message);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleUseVoucher = async (userVoucherId: number, owner: UserVoucher) => {
    setUsingVoucherId(owner.id);
    setError("");
    setSuccessMessage("");
    if (!owner.userId) {
      setError("Không xác định được người dùng của voucher.");
      setUsingVoucherId(null);
      return;
    }
    try {
      const updated = await useVoucherForUserReception(userVoucherId, owner.userId);
      setVouchers((prev) =>
        prev.map((item) =>
          item.id === owner.id ? { ...item, used: updated.used } : item
        )
      );
      setSuccessMessage(
        `Đã đánh dấu voucher ${updated.voucherCode} của ${updated.userFullName || "người dùng"} là đã sử dụng.`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Không thể áp dụng voucher.";
      setError(message);
    } finally {
      setUsingVoucherId(null);
    }
  };

  return (
    <div className="page-section">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h2 className="mb-1">Quản lý voucher</h2>
          <p className="text-muted mb-0">Tìm kiếm người dùng và xác nhận sử dụng voucher.</p>
        </div>
      </div>

      <Card body className="mb-3">
        <Form onSubmit={handleSearch}>
          <Row className="g-2 align-items-center">
            <Col xs={12} md={8} lg={9}>
              <InputGroup>
                <Form.Control
                  placeholder="Nhập tên, email hoặc số điện thoại người dùng"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </InputGroup>
            </Col>
            <Col xs={12} md={4} lg={3} className="d-flex justify-content-end">
              <Button type="submit" variant="primary" disabled={searching}>
                {searching ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Đang tìm...
                  </>
                ) : (
                  "Tìm kiếm"
                )}
              </Button>
            </Col>
          </Row>
        </Form>
      </Card>

      {error && (
        <Alert variant="danger" onClose={() => setError("")} dismissible>
          {error}
        </Alert>
      )}
      {successMessage && (
        <Alert variant="success" onClose={() => setSuccessMessage("")} dismissible>
          {successMessage}
        </Alert>
      )}

      {searchResults.length > 0 && (
        <Card body className="mb-3">
          <h5 className="mb-3">Kết quả tìm kiếm</h5>
          <Table responsive hover className="align-middle mb-0">
            <thead>
              <tr>
                <th>Họ và tên</th>
                <th>Email</th>
                <th>Số điện thoại</th>
                <th style={{ width: 140 }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {searchResults.map((user) => {
                const isSelected = selectedUser?.id === user.id;
                return (
                  <tr key={user.id} className={isSelected ? "table-primary" : undefined}>
                    <td>{user.fullName || `User #${user.id}`}</td>
                    <td>{user.email || "—"}</td>
                    <td>{user.phone || "—"}</td>
                    <td>
                      <Button
                        size="sm"
                        variant={isSelected ? "success" : "outline-primary"}
                        onClick={() => void loadUserVouchers(user)}
                        disabled={loading && isSelected}
                      >
                        {loading && isSelected ? (
                          <>
                            <Spinner animation="border" size="sm" className="me-1" />
                            Đang tải...
                          </>
                        ) : isSelected ? (
                          "Đang xem"
                        ) : (
                          "Xem voucher"
                        )}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}

      {selectedUser && (
        <Card className="shadow-sm border-0">
          <Card.Header className="d-flex justify-content-between align-items-center">
            <div>
              <h5 className="mb-1">Voucher của {selectedUser.fullName || `User #${selectedUser.id}`}</h5>
              <div className="text-muted small">
                Email: {selectedUser.email || "—"} &middot; SĐT: {selectedUser.phone || "—"}
              </div>
            </div>
            <Badge bg="info">Tổng: {vouchers.length}</Badge>
          </Card.Header>
          <Card.Body>
            {loading ? (
              <div className="d-flex align-items-center gap-2">
                <Spinner animation="border" size="sm" />
                Đang tải voucher...
              </div>
            ) : vouchers.length === 0 ? (
              <div className="text-muted">Không có voucher nào.</div>
            ) : (
              <Table responsive hover className="align-middle mb-0">
                <thead>
                  <tr>
                    <th>Mã</th>
                    <th>Tên voucher</th>
                    <th>Loại</th>
                    <th>Nhận lúc</th>
                    <th>Hạn sử dụng</th>
                    <th>Trạng thái</th>
                    <th style={{ width: 140 }}>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {vouchers.map((voucher) => (
                    <tr key={voucher.id}>
                      <td>
                        <strong>{voucher.voucherCode}</strong>
                      </td>
                      <td>{voucher.voucherName || "Voucher ưu đãi"}</td>
                      <td>{VoucherTypeLabel[voucher.type]}</td>
                      <td>{formatDateTime(voucher.issuedAt)}</td>
                      <td>{formatDateTime(voucher.expiryDate)}</td>
                      <td>
                        <Badge bg={voucher.used ? "secondary" : "success"}>
                          {voucher.used ? "Đã dùng" : "Chưa dùng"}
                        </Badge>
                      </td>
                      <td>
                        <Button
                          size="sm"
                          variant="outline-primary"
                          disabled={voucher.used || usingVoucherId === voucher.id}
                          onClick={() => handleUseVoucher(voucher.id, voucher)}
                        >
                          {usingVoucherId === voucher.id ? (
                            <>
                              <Spinner animation="border" size="sm" className="me-1" />
                              Đang xử lý...
                            </>
                          ) : (
                            "Đánh dấu dùng"
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card.Body>
        </Card>
      )}
    </div>
  );
}


