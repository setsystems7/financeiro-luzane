// Card brand fees for debit and credit installments
// Based on provided machine rates

export interface CardBrandFees {
  debit: number;
  credit: Record<number, number>; // installment -> fee percentage
}

export const CARD_FEES: Record<string, CardBrandFees> = {
  visa: {
    debit: 1.37,
    credit: {
      1: 3.15,
      2: 5.39,
      3: 6.12,
      4: 6.85,
      5: 7.57,
      6: 8.28,
      7: 8.99,
      8: 9.69,
      9: 10.38,
      10: 11.06,
      11: 11.74,
      12: 12.40,
    },
  },
  mastercard: {
    debit: 1.37,
    credit: {
      1: 3.15,
      2: 5.39,
      3: 6.12,
      4: 6.85,
      5: 7.57,
      6: 8.28,
      7: 8.99,
      8: 9.69,
      9: 10.38,
      10: 11.06,
      11: 11.74,
      12: 12.40,
    },
  },
  elo: {
    debit: 2.58,
    credit: {
      1: 4.91,
      2: 6.47,
      3: 7.20,
      4: 7.92,
      5: 8.63,
      6: 9.33,
      7: 10.03,
      8: 10.72,
      9: 11.41,
      10: 12.08,
      11: 12.75,
      12: 13.41,
    },
  },
  amex: {
    debit: 2.58,
    credit: {
      1: 4.91,
      2: 6.47,
      3: 7.20,
      4: 7.92,
      5: 8.63,
      6: 9.33,
      7: 10.03,
      8: 10.72,
      9: 11.41,
      10: 12.08,
      11: 12.75,
      12: 13.41,
    },
  },
};

export const CARD_BRANDS = [
  { id: 'visa', name: 'Visa' },
  { id: 'mastercard', name: 'Mastercard' },
  { id: 'elo', name: 'Elo' },
  { id: 'amex', name: 'Amex' },
];

export function getCardFee(
  paymentMethod: string,
  brand: string,
  installments: number
): number {
  if (!brand || !CARD_FEES[brand]) return 0;

  if (paymentMethod === 'cartao_debito') {
    return CARD_FEES[brand].debit;
  }

  if (paymentMethod === 'cartao_credito') {
    return CARD_FEES[brand].credit[installments] || 0;
  }

  return 0;
}
