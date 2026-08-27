import { MIDIBUS_CODE } from "@/lib/booking/pricing/vehicle-quote";
import { type VehicleGalleryKey } from "@/lib/booking/vehicles/copy";

export const MIDIBUS_IMAGES: Record<
  VehicleGalleryKey,
  { src: string; width: number; height: number }
> = {
  exterior: {
    src: "/vehicles/midibus/exterior.png",
    width: 1448,
    height: 1086,
  },
  interior: {
    src: "/vehicles/midibus/interior.png",
    width: 1448,
    height: 1086,
  },
  luggage: {
    src: "/vehicles/midibus/luggage.png",
    width: 1448,
    height: 1086,
  },
};

export const MIDIBUS_VEHICLE = {
  code: MIDIBUS_CODE,
  images: MIDIBUS_IMAGES,
};
