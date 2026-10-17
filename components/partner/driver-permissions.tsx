"use client";

import { useEffect, useRef, useState } from "react";
import {
  driverGpsPermissionKeys,
  driverPermissionGroupState,
  driverUetdsPermissionKeys,
  setDriverPermissionGroup,
  type DriverPermissionKey,
  type DriverPermissions,
} from "@/lib/driver-portal/permissions";
import { type PartnerCopy } from "@/lib/partner/copy";
import { savePartnerDriverPermissionsAction } from "@/lib/partner/driver-permissions";

function GroupBox({
  label,
  checked,
  indeterminate,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  indeterminate: boolean;
  disabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <label className="driver-permission-main">
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

export function DriverPermissionsEditor({
  driverId,
  initial,
  copy,
}: {
  driverId: string;
  initial: DriverPermissions;
  copy: PartnerCopy;
}) {
  const [permissions, setPermissions] = useState(initial);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const gps = driverPermissionGroupState(permissions, driverGpsPermissionKeys);
  const uetds = driverPermissionGroupState(permissions, driverUetdsPermissionKeys);

  async function save(next: DriverPermissions) {
    const previous = permissions;
    setPermissions(next);
    setPending(true);
    setFailed(false);
    const result = await savePartnerDriverPermissionsAction({ driverId, permissions: next });
    setPending(false);
    if (!result.ok) {
      setPermissions(previous);
      setFailed(true);
      return;
    }
    setPermissions(result.permissions);
  }

  function toggle(key: DriverPermissionKey, enabled: boolean) {
    void save({ ...permissions, [key]: enabled });
  }

  const gpsItems: { key: DriverPermissionKey; label: string }[] = [
    { key: "gpsLive", label: copy.driverPermissionsLive },
    { key: "gpsHistory", label: copy.driverPermissionsHistory },
    { key: "gpsMaintenance", label: copy.driverPermissionsMaintenance },
    { key: "gpsDrive", label: copy.driverPermissionsDrive },
    { key: "gpsDevice", label: copy.driverPermissionsDevice },
  ];
  const uetdsItems: { key: DriverPermissionKey; label: string }[] = [
    { key: "uetdsNew", label: copy.driverPermissionsUetdsNew },
    { key: "uetdsList", label: copy.driverPermissionsUetdsList },
  ];

  return (
    <div className="driver-permissions">
      <fieldset disabled={pending}>
        <GroupBox
          label={copy.driverPermissionsGps}
          checked={gps === "all"}
          indeterminate={gps === "some"}
          disabled={pending}
          onChange={(enabled) => void save(setDriverPermissionGroup(permissions, driverGpsPermissionKeys, enabled))}
        />
        <div className="driver-permission-children">
          {gpsItems.map((item) => (
            <label key={item.key}>
              <input
                type="checkbox"
                checked={permissions[item.key]}
                onChange={(event) => toggle(item.key, event.target.checked)}
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset disabled={pending}>
        <GroupBox
          label={copy.driverPermissionsUetds}
          checked={uetds === "all"}
          indeterminate={uetds === "some"}
          disabled={pending}
          onChange={(enabled) => void save(setDriverPermissionGroup(permissions, driverUetdsPermissionKeys, enabled))}
        />
        <div className="driver-permission-children">
          {uetdsItems.map((item) => (
            <label key={item.key}>
              <input
                type="checkbox"
                checked={permissions[item.key]}
                onChange={(event) => toggle(item.key, event.target.checked)}
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {failed ? <p className="ops-form-error">{copy.driverSaveFailed}</p> : null}
    </div>
  );
}
