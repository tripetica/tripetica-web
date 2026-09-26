"use client";

import { useEffect, useRef, useState, useTransition } from "react";

export function useReservationAction<S extends { ok: boolean }>(
  action: (prev: S, formData: FormData) => Promise<S>,
  initialState: S,
  reservationId: string,
): [S, (formData: FormData) => void, boolean] {
  const [state, setState] = useState(initialState);
  const [pending, startTransition] = useTransition();
  const reservationIdRef = useRef(reservationId);
  const initialRef = useRef(initialState);
  reservationIdRef.current = reservationId;

  useEffect(() => {
    setState(initialRef.current);
  }, [reservationId]);

  function dispatch(formData: FormData) {
    const submittedId = String(formData.get("id") ?? "");
    startTransition(async () => {
      const result = await action(initialRef.current, formData);
      if (submittedId !== reservationIdRef.current) {
        return;
      }
      if (
        "reservationId" in result &&
        typeof result.reservationId === "string" &&
        result.reservationId &&
        result.reservationId !== reservationIdRef.current
      ) {
        return;
      }
      setState(result);
    });
  }

  return [state, dispatch, pending];
}
