import { PREMIUM_ECONOMY_SEDAN_CODE } from "@/lib/booking/pricing/vehicle-quote";
import { type VehicleGalleryKey } from "@/lib/booking/vehicles/copy";

export const PREMIUM_ECONOMY_SEDAN_IMAGES: Record<
  VehicleGalleryKey,
  { src: string; width: number; height: number }
> = {
  exterior: {
    src: "/vehicles/premium-economy-sedan/exterior.png",
    width: 1448,
    height: 1086,
  },
  interior: {
    src: "/vehicles/premium-economy-sedan/interior.png",
    width: 1536,
    height: 1024,
  },
  luggage: {
    src: "/vehicles/premium-economy-sedan/luggage.png",
    width: 1448,
    height: 1086,
  },
};

export const PREMIUM_ECONOMY_SEDAN_VEHICLE = {
  code: PREMIUM_ECONOMY_SEDAN_CODE,
  images: PREMIUM_ECONOMY_SEDAN_IMAGES,
};
