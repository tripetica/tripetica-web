import { type ServiceType } from "@/lib/booking/types";

const services: ServiceType[] = ["transfer", "hourly", "tour"];

type ServiceSelectorProps = {
  groupLabel: string;
  labels: Record<ServiceType, string>;
  value: ServiceType;
  onChange: (value: ServiceType) => void;
};

export function ServiceSelector({
  groupLabel,
  labels,
  value,
  onChange,
}: ServiceSelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label={groupLabel}
      className="service-selector"
    >
      {services.map((service) => {
        const selected = service === value;
        return (
          <button
            key={service}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`service-chip ${selected ? "is-selected" : ""}`}
            onClick={() => onChange(service)}
          >
            <span>{labels[service]}</span>
          </button>
        );
      })}
    </div>
  );
}
