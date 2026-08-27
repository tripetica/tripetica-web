import { FIRST_CLASS_MINIVAN_CODE } from "@/lib/booking/pricing/vehicle-quote";
import { type VehicleGalleryKey } from "@/lib/booking/vehicles/copy";

export const FIRST_CLASS_MINIVAN_IMAGES: Record<
  VehicleGalleryKey,
  { src: string; width: number; height: number }
> = {
  exterior: {
    src: "/vehicles/first-class-minivan/exterior.png",
    width: 1448,
    height: 1086,
  },
  interior: {
    src: "/vehicles/first-class-minivan/interior.png",
    width: 1448,
    height: 1086,
  },
  luggage: {
    src: "/vehicles/first-class-minivan/cabin.png",
    width: 1448,
    height: 1086,
  },
};

export const FIRST_CLASS_MINIVAN_VEHICLE = {
  code: FIRST_CLASS_MINIVAN_CODE,
  images: FIRST_CLASS_MINIVAN_IMAGES,
};
