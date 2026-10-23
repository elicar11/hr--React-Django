/** Error body returned by the Django API for every failure. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    status: number;
    details?: unknown;
  };
}

/** DRF page-number pagination. */
export interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}