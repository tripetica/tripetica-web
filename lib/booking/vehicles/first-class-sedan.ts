import { FIRST_CLASS_SEDAN_CODE } from "@/lib/booking/pricing/vehicle-quote";
import { type VehicleGalleryKey } from "@/lib/booking/vehicles/copy";

export const FIRST_CLASS_SEDAN_IMAGES: Record<
  VehicleGalleryKey,
  { src: string; width: number; height: number }
> = {
  exterior: {
    src: "/vehicles/first-class-sedan/exterior.png",
    width: 1448,
    height: 1086,
  },
  interior: {
    src: "/vehicles/first-class-sedan/interior.png",
    width: 1448,
    height: 1086,
  },
  luggage: {
    src: "/vehicles/first-class-sedan/luggage.png",
    width: 1448,
    height: 1086,
  },
};

export const FIRST_CLASS_SEDAN_VEHICLE = {
  code: FIRST_CLASS_SEDAN_CODE,
  images: FIRST_CLASS_SEDAN_IMAGES,
};
