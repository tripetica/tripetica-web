export const GPS_DEVICE_DELETE_ACTOR_ID = "9403e89a-26da-4330-9a9d-a2e7960ccf75";

export function canDeleteGpsDevice(actorId: string) {
  return actorId === GPS_DEVICE_DELETE_ACTOR_ID;
}
