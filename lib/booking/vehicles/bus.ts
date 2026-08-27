import { BUS_CODE } from "@/lib/booking/pricing/vehicle-quote";
import { type VehicleGalleryKey } from "@/lib/booking/vehicles/copy";

export const BUS_IMAGES: Record<
  VehicleGalleryKey,
  { src: string; width: number; height: number }
> = {
  exterior: {
    src: "/vehicles/bus/exterior.png",
    width: 1448,
    height: 1086,
  },
  interior: {
    src: "/vehicles/bus/interior.png",
    width: 1672,
    height: 941,
  },
  luggage: {
    src: "/vehicles/bus/luggage.png",
    width: 1448,
    height: 1086,
  },
};

export const BUS_VEHICLE = {
  code: BUS_CODE,
  images: BUS_IMAGES,
};
