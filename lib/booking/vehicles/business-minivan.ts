import { BUSINESS_MINIVAN_CODE } from "@/lib/booking/pricing/vehicle-quote";
import { type VehicleGalleryKey } from "@/lib/booking/vehicles/copy";

export const BUSINESS_MINIVAN_IMAGES: Record<
  VehicleGalleryKey,
  { src: string; width: number; height: number }
> = {
  exterior: {
    src: "/vehicles/business-minivan/exterior.png",
    width: 1448,
    height: 1086,
  },
  interior: {
    src: "/vehicles/business-minivan/interior.png",
    width: 1448,
    height: 1086,
  },
  luggage: {
    src: "/vehicles/business-minivan/luggage.png",
    width: 1448,
    height: 1086,
  },
};

export const BUSINESS_MINIVAN_VEHICLE = {
  code: BUSINESS_MINIVAN_CODE,
  images: BUSINESS_MINIVAN_IMAGES,
};
