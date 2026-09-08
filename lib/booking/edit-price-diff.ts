export type EditPriceDifference = {
  originalTotal: number | null;
  originalCurrency: string | null;
  newTotal: number | null;
  newCurrency: string | null;
  difference: number | null;
  sameCurrency: boolean;
};

export function computeEditPriceDifference(input: {
  originalTotal: number | null;
  originalCurrency: string | null;
  newTotal: number | null;
  newCurrency: string | null;
}): EditPriceDifference {
  const originalCurrency = input.originalCurrency?.trim().toUpperCase() || null;
  const newCurrency = input.newCurrency?.trim().toUpperCase() || null;
  const sameCurrency = Boolean(
    originalCurrency &&
      newCurrency &&
      originalCurrency === newCurrency &&
      input.originalTotal != null &&
      input.newTotal != null,
  );
  return {
    originalTotal: input.originalTotal,
    originalCurrency,
    newTotal: input.newTotal,
    newCurrency,
    difference: sameCurrency
      ? Number((input.newTotal! - input.originalTotal!).toFixed(2))
      : null,
    sameCurrency,
  };
}
