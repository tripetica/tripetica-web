import { STANDARD_MINIVAN_CODE } from "@/lib/booking/pricing/vehicle-quote";
import { type VehicleGalleryKey } from "@/lib/booking/vehicles/copy";

export const STANDARD_MINIVAN_IMAGES: Record<
  VehicleGalleryKey,
  { src: string; width: number; height: number }
> = {
  exterior: {
    src: encodeURI("/standard minivan dis.png"),
    width: 1448,
    height: 1086,
  },
  interior: {
    src: encodeURI("/standard minivan ic.png"),
    width: 1448,
    height: 1086,
  },
  luggage: {
    src: encodeURI("/standard minivan bagaj.png"),
    width: 1448,
    height: 1086,
  },
};

export const STANDARD_MINIVAN_VEHICLE = {
  code: STANDARD_MINIVAN_CODE,
  images: STANDARD_MINIVAN_IMAGES,
};
