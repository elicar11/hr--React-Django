from dataclasses import dataclass
from datetime import datetime

from django.utils import timezone


@dataclass(frozen=True)
class Metrics:
    worked_minutes: int
    late_minutes: int
    overtime_minutes: int


def _at(day, time_of_day):
    """Aware datetime of `time_of_day` on `day`, in the company time zone."""
    return timezone.make_aware(datetime.combine(day, time_of_day))


def _minutes(delta):
    """Whole minutes of a timedelta, never negative."""
    return max(0, int(delta.total_seconds() // 60))


def compute_late_minutes(*, schedule, day, check_in, is_working_day):
    """Late only on a working day, when the arrival exceeds the grace period.

    The lateness is counted from the official start time (not from the end of the grace).
    """
    if not is_working_day:
        return 0
    delay = _minutes(check_in - _at(day, schedule.start_time))
    return delay if delay > schedule.late_grace_minutes else 0


def compute_worked_minutes(*, schedule, day, check_in, check_out):
    """Presence span minus the overlap with the (unpaid) break window."""
    span = _minutes(check_out - check_in)
    overlap = 0
    if schedule.break_start and schedule.break_end:
        start = max(check_in, _at(day, schedule.break_start))
        end = min(check_out, _at(day, schedule.break_end))
        overlap = _minutes(end - start)
    return max(0, span - overlap)


def compute_overtime_minutes(*, schedule, day, worked_minutes, check_out, is_working_day):
    """Minutes after the official end time (if they reach the threshold).

    On a non-working day or a holiday, all the worked time is overtime.
    Arriving early never generates overtime.
    """
    if not is_working_day:
        return worked_minutes
    after_end = _minutes(check_out - _at(day, schedule.end_time))
    if after_end == 0 or after_end < schedule.overtime_threshold_minutes:
        return 0
    return min(after_end, worked_minutes)


def compute_metrics(*, schedule, day, check_in, check_out, is_working_day):
    late = compute_late_minutes(
        schedule=schedule, day=day, check_in=check_in, is_working_day=is_working_day
    )
    worked = overtime = 0
    if check_out is not None:
        worked = compute_worked_minutes(
            schedule=schedule, day=day, check_in=check_in, check_out=check_out
        )
        overtime = compute_overtime_minutes(
            schedule=schedule, day=day, worked_minutes=worked,
            check_out=check_out, is_working_day=is_working_day,
        )
    return Metrics(worked_minutes=worked, late_minutes=late, overtime_minutes=overtime)