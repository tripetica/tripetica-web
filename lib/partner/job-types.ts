import { type JobAssignmentView } from "@/lib/partner/job-assignment-view";

export type PartnerJobPassengerGender = "female" | "male";

export type PartnerJobPassenger = {
  sequenceNo: number;
  isPrimary: boolean;
  firstName: string | null;
  lastName: string | null;
  gender: PartnerJobPassengerGender | null;
  countryName: string | null;
  passportNumber: string | null;
  nationalId: string | null;
  phone: string | null;
  email: string | null;
};

export type PartnerJobRecord = {
  id: string;
  pickupAt: string;
  createdAt: string;
  serviceType: string | null;
  tourCode: string | null;
  serviceLabel: string;
  pickupName: string | null;
  dropoffName: string | null;
  passengerCount: number | null;
  luggageCount: number | null;
  babySeatCount: number | null;
  notes: string | null;
  durationHours: string | null;
  flightCode: string | null;
  meetAndGreet: boolean | null;
  isAirportPickup: boolean;
  paymentMethod: string | null;
  isCash: boolean;
  payoutAmount: number | null;
  payoutLabel: string;
  collectAmount: number | null;
  collectLabel: string | null;
  currency: string | null;
  reservationCode: string | null;
  accepted: boolean;
  acceptedAt: string | null;
  assignment?: JobAssignmentView;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  customerCountry: string | null;
  canSeePassengerContact: boolean;
  passengers: PartnerJobPassenger[] | null;
};
