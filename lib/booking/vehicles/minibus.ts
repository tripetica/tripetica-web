import { MINIBUS_CODE } from "@/lib/booking/pricing/vehicle-quote";
import { type VehicleGalleryKey } from "@/lib/booking/vehicles/copy";

export const MINIBUS_IMAGES: Record<
  VehicleGalleryKey,
  { src: string; width: number; height: number }
> = {
  exterior: {
    src: "/vehicles/minibus/exterior.png",
    width: 1448,
    height: 1086,
  },
  interior: {
    src: "/vehicles/minibus/interior.png",
    width: 1448,
    height: 1086,
  },
  luggage: {
    src: "/vehicles/minibus/luggage.png",
    width: 1448,
    height: 1086,
  },
};

export const MINIBUS_VEHICLE = {
  code: MINIBUS_CODE,
  images: MINIBUS_IMAGES,
};
