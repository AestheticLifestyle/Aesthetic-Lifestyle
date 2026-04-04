import { useClientStore } from '../../stores/clientStore';
import { Icon } from '../../utils/icons';
import { formatShortDate, getTodayKey } from '../../utils/constants';

/**
 * Day navigator — prev/next arrows with date display.
 * Shows "Today" badge only when viewing today.
 * Shows "← Back to Today" button when viewing past dates.
 */
export default function DateNavigator() {
  const { selectedDate, isToday, goToPrevDay, goToNextDay, goToToday } = useClientStore();

  // Format: "Thu 27 Mar" or "Today — Thu 27 Mar"
  const dateLabel = formatShortDate(selectedDate);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 14, margin: '14px 0 18px', userSelect: 'none',
    }}>
      <button
        className="icon-btn"
        onClick={goToPrevDay}
        aria-label="Previous day"
        style={{ width: 30, height: 30 }}
      >
        <Icon name="chevron-left" size={13} />
      </button>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '4px 10px', borderRadius: 7, minWidth: 160, justifyContent: 'center',
      }}>
        <span style={{
          fontSize: 14, fontWeight: 600, color: 'var(--t1)',
          fontFamily: 'var(--fd)', letterSpacing: 1,
        }}>
          {isToday ? 'TODAY' : dateLabel.toUpperCase()}
        </span>
        {isToday && (
          <span style={{
            fontSize: 10, color: 'var(--t3)', fontWeight: 400,
          }}>
            {dateLabel}
          </span>
        )}
      </div>

      <button
        className="icon-btn"
        onClick={goToNextDay}
        disabled={isToday}
        aria-label="Next day"
        style={{
          width: 30, height: 30,
          opacity: isToday ? 0.3 : 1,
          cursor: isToday ? 'not-allowed' : 'pointer',
        }}
      >
        <Icon name="chevron" size={13} />
      </button>

      {/* Jump to today button when viewing past dates */}
      {!isToday && (
        <button
          onClick={goToToday}
          style={{
            background: 'var(--gold-d)', border: 'none', cursor: 'pointer',
            padding: '4px 10px', borderRadius: 5,
            fontSize: 10, fontWeight: 600, letterSpacing: 1,
            color: 'var(--gold)', textTransform: 'uppercase',
          }}
        >
          ← Today
        </button>
      )}
    </div>
  );
}
