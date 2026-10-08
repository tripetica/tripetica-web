export type GpsFollowFix = {
  id: string;
  latitude: number;
  longitude: number;
};

export type GpsFollowView = {
  selectedId: string | null;
  center: GpsFollowFix | null;
  zoom: number;
};

export function gpsSelectVehicle(clicked: GpsFollowFix, zoom: number): GpsFollowView {
  return {
    selectedId: clicked.id,
    center: clicked,
    zoom,
  };
}

export function gpsApplyVehicleFix(view: GpsFollowView, fix: GpsFollowFix): GpsFollowView {
  if (view.selectedId !== fix.id) {
    return view;
  }
  return {
    selectedId: view.selectedId,
    center: fix,
    zoom: view.zoom,
  };
}

export function gpsOpenPopup(view: GpsFollowView): GpsFollowView {
  return view;
}
