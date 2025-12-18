import { Payer, Quote, Transaction } from "./types";

export const payers: Payer[] = [
  {
    id: "P1",
    name: "Payer One",
    country: "PH",
    currency_pairs: [{ source_currency: "SGD", dest_currency: "PHP" }],
    required_fields: [
      "sender.first_name",
      "sender.last_name",
      "receiver.first_name",
      "receiver.last_name",
      "receiver.bank_account",
    ],
    min_amount: 10,
    max_amount: 1000,
  },
  {
    id: "P2",
    name: "Payer Two",
    country: "IN",
    currency_pairs: [{ source_currency: "USD", dest_currency: "INR" }],
    required_fields: [
      "sender.first_name",
      "sender.last_name",
      "receiver.full_name",
      "receiver.upi_id",
    ],
    min_amount: 5,
    max_amount: 5000,
  },
  {
    id: "P3",
    name: "Payer Three",
    country: "ID",
    currency_pairs: [{ source_currency: "SGD", dest_currency: "IDR" }],
    required_fields: [
      "sender.full_name",
      "receiver.full_name",
      "receiver.bank_code",
      "receiver.bank_account",
    ],
    min_amount: 20,
    max_amount: 2000,
  },
];

export const quotesById = new Map<string, Quote>();
export const transactionsById = new Map<string, Transaction>();
