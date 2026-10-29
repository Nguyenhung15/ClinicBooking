import { Accordion } from 'react-bootstrap';

export interface FAQ {
  id: number;
  question: string;
  answer: string;
}

interface FAQAccordionProps {
  faqs: FAQ[];
}

// FAQ data by specialty ID
const FAQ_DATA: Record<number, FAQ[]> = {
  1: [
    {
      id: 1,
      question: 'Khoa Nội Tổng Quát khám những bệnh gì?',
      answer: 'Khoa Nội Tổng Quát khám và điều trị các bệnh lý nội khoa như tim mạch, hô hấp, tiêu hóa, nội tiết, thận - tiết niệu, và các bệnh lý khác không cần phẫu thuật.',
    },
    {
      id: 2,
      question: 'Tôi cần chuẩn bị gì trước khi khám?',
      answer: 'Bạn nên nhịn ăn sáng nếu có xét nghiệm máu, mang theo các kết quả xét nghiệm cũ (nếu có), và danh sách thuốc đang sử dụng.',
    },
    {
      id: 3,
      question: 'Thời gian khám là bao lâu?',
      answer: 'Thời gian khám thông thường từ 15-30 phút tùy vào tình trạng bệnh. Bác sĩ sẽ khám kỹ lưỡng và tư vấn chi tiết.',
    },
  ],
  2: [
    {
      id: 1,
      question: 'Chuyên khoa Cơ Xương Khớp điều trị những bệnh gì?',
      answer: 'Chúng tôi điều trị các bệnh về cơ xương khớp như đau lưng, thoái hóa khớp, viêm khớp, loãng xương, thoát vị đĩa đệm, và các chấn thương cơ xương khớp.',
    },
    {
      id: 2,
      question: 'Có cần chụp X-quang không?',
      answer: 'Tùy vào tình trạng bệnh, bác sĩ sẽ chỉ định chụp X-quang, MRI hoặc các xét nghiệm cần thiết để chẩn đoán chính xác.',
    },
    {
      id: 3,
      question: 'Điều trị có đau không?',
      answer: 'Chúng tôi sử dụng các phương pháp điều trị ít xâm lấn, giảm đau hiệu quả. Một số thủ thuật có thể gây khó chịu nhẹ nhưng sẽ được bác sĩ giải thích trước.',
    },
  ],
  3: [
    {
      id: 1,
      question: 'Chuyên khoa Răng Hàm Mặt có những dịch vụ gì?',
      answer: 'Chúng tôi cung cấp đầy đủ các dịch vụ nha khoa: nhổ răng, trám răng, điều trị tủy, tẩy trắng răng, niềng răng, cấy ghép Implant và phục hình răng sứ.',
    },
    {
      id: 2,
      question: 'Niềng răng mất bao lâu?',
      answer: 'Thời gian niềng răng thường từ 18-24 tháng tùy vào tình trạng răng và độ phức tạp. Bác sĩ sẽ tư vấn cụ thể sau khi khám.',
    },
    {
      id: 3,
      question: 'Cấy ghép Implant có đau không?',
      answer: 'Thủ thuật được thực hiện dưới gây tê tại chỗ nên không đau. Sau thủ thuật có thể hơi khó chịu nhưng sẽ giảm dần và được bác sĩ kê thuốc giảm đau.',
    },
  ],
};

export function getFAQsBySpecialtyId(specialtyId: number): FAQ[] {
  return FAQ_DATA[specialtyId] || [];
}

export default function FAQAccordion({ faqs }: FAQAccordionProps) {
  if (faqs.length === 0) {
    return null;
  }

  return (
    <Accordion defaultActiveKey="0">
      {faqs.map((faq, index) => (
        <Accordion.Item key={faq.id} eventKey={index.toString()}>
          <Accordion.Header>{faq.question}</Accordion.Header>
          <Accordion.Body>{faq.answer}</Accordion.Body>
        </Accordion.Item>
      ))}
    </Accordion>
  );
}

