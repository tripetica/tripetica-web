import {
  BUSINESS_MINIVAN_CODE,
  BUS_CODE,
  FIRST_CLASS_MINIVAN_CODE,
  FIRST_CLASS_SEDAN_CODE,
  MIDIBUS_CODE,
  MINIBUS_CODE,
  PREMIUM_ECONOMY_SEDAN_CODE,
  STANDARD_MINIVAN_CODE,
} from "@/lib/booking/pricing/vehicle-quote";
import { BUSINESS_MINIVAN_IMAGES } from "@/lib/booking/vehicles/business-minivan";
import { BUS_IMAGES } from "@/lib/booking/vehicles/bus";
import { type VehicleGalleryKey } from "@/lib/booking/vehicles/copy";
import { FIRST_CLASS_MINIVAN_IMAGES } from "@/lib/booking/vehicles/first-class-minivan";
import { FIRST_CLASS_SEDAN_IMAGES } from "@/lib/booking/vehicles/first-class-sedan";
import { MINIBUS_IMAGES } from "@/lib/booking/vehicles/minibus";
import { MIDIBUS_IMAGES } from "@/lib/booking/vehicles/midibus";
import { PREMIUM_ECONOMY_SEDAN_IMAGES } from "@/lib/booking/vehicles/premium-economy-sedan";
import { STANDARD_MINIVAN_IMAGES } from "@/lib/booking/vehicles/standard-minivan";

export type VehicleImageSet = Record<
  VehicleGalleryKey,
  { src: string; width: number; height: number }
>;

export function vehicleImagesFor(vehicleCode: string): VehicleImageSet {
  if (vehicleCode === BUS_CODE) {
    return BUS_IMAGES;
  }
  if (vehicleCode === MIDIBUS_CODE) {
    return MIDIBUS_IMAGES;
  }
  if (vehicleCode === MINIBUS_CODE) {
    return MINIBUS_IMAGES;
  }
  if (vehicleCode === FIRST_CLASS_SEDAN_CODE) {
    return FIRST_CLASS_SEDAN_IMAGES;
  }
  if (vehicleCode === FIRST_CLASS_MINIVAN_CODE) {
    return FIRST_CLASS_MINIVAN_IMAGES;
  }
  if (vehicleCode === BUSINESS_MINIVAN_CODE) {
    return BUSINESS_MINIVAN_IMAGES;
  }
  if (vehicleCode === STANDARD_MINIVAN_CODE) {
    return STANDARD_MINIVAN_IMAGES;
  }
  if (vehicleCode === PREMIUM_ECONOMY_SEDAN_CODE) {
    return PREMIUM_ECONOMY_SEDAN_IMAGES;
  }
  return PREMIUM_ECONOMY_SEDAN_IMAGES;
}
