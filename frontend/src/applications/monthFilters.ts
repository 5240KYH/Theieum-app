const COMPLETE_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function formatMonthInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 6);

  if (digits.length <= 4) {
    return digits;
  }

  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

export function isCompleteMonth(value: string) {
  return COMPLETE_MONTH_PATTERN.test(value);
}

export function matchesMonthRange(value: string | null | undefined, fromMonth: string, toMonth: string) {
  const normalizedFromMonth = isCompleteMonth(fromMonth) ? fromMonth : '';
  const normalizedToMonth = isCompleteMonth(toMonth) ? toMonth : '';

  if (!normalizedFromMonth && !normalizedToMonth) {
    return true;
  }

  if (!value) {
    return false;
  }

  const targetMonth = value.slice(0, 7);

  return (
    (!normalizedFromMonth || targetMonth >= normalizedFromMonth)
    && (!normalizedToMonth || targetMonth <= normalizedToMonth)
  );
}

export function matchesReceiptMonthRange(receiptDate: string, fromMonth: string, toMonth: string) {
  return matchesMonthRange(receiptDate, fromMonth, toMonth);
}
