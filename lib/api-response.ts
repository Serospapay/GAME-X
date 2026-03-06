import { NextResponse } from "next/server";

export interface ApiErrorBody {
  error: string;
  code?: string;
}

export function ok<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status });
}

export function fail(
  error: string,
  status: number,
  code?: string
): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error, code }, { status });
}
