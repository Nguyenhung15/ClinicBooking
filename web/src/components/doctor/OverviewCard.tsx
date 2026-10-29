import { Card } from 'react-bootstrap';
import './OverviewCard.css';

interface OverviewCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color?: 'primary' | 'success' | 'info' | 'warning';
  onClick?: () => void;
}

export default function OverviewCard({
  title,
  value,
  icon,
  color = 'primary',
  onClick,
}: OverviewCardProps) {
  return (
    <Card
      className={`overview-card overview-card--${color} ${onClick ? 'overview-card--clickable' : ''}`}
      onClick={onClick}
    >
      <Card.Body>
        <div className="overview-card__content">
          <div className="overview-card__icon">{icon}</div>
          <div className="overview-card__info">
            <div className="overview-card__value">{value}</div>
            <div className="overview-card__title">{title}</div>
          </div>
        </div>
      </Card.Body>
    </Card>
  );
}

