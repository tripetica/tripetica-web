type LocationRole = "pickup" | "dropoff";

export function locationIconKind(
  types: string[] | null | undefined,
  _role: LocationRole,
  isAirport: boolean,
) {
  if (isAirport || typesIncludes(types, ["airport"])) {
    return "airport";
  }
  if (typesIncludes(types, ["lodging", "hotel", "accommodation"])) {
    return "hotel";
  }
  if (typesIncludes(types, ["hospital", "doctor", "health"])) {
    return "hospital";
  }
  if (typesIncludes(types, ["cafe", "coffee_shop", "coffee"])) {
    return "cafe";
  }
  if (typesIncludes(types, ["restaurant", "food", "meal_takeaway", "meal_delivery"])) {
    return "restaurant";
  }
  if (typesIncludes(types, ["bakery", "bar"])) {
    return "cafe";
  }
  if (
    typesIncludes(types, [
      "shopping_mall",
      "store",
      "supermarket",
      "department_store",
      "clothing_store",
    ])
  ) {
    return "shop";
  }
  if (
    typesIncludes(types, [
      "train_station",
      "subway_station",
      "transit_station",
      "light_rail_station",
    ])
  ) {
    return "train";
  }
  if (typesIncludes(types, ["bus_station", "bus_stop"])) {
    return "bus";
  }
  if (typesIncludes(types, ["harbor", "marina", "ferry_terminal", "port"])) {
    return "ship";
  }
  return "pin";
}

function typesIncludes(types: string[] | null | undefined, matches: string[]) {
  return Boolean(types?.some((type) => matches.includes(type)));
}

type IconKind = ReturnType<typeof locationIconKind>;

export function LocationGlyph({
  kind,
  className = "location-icon",
}: {
  kind: IconKind;
  className?: string;
}) {
  switch (kind) {
    case "airport":
      return <AirplaneIcon className={className} />;
    case "hotel":
      return <HotelIcon className={className} />;
    case "hospital":
      return <HospitalIcon className={className} />;
    case "restaurant":
      return <RestaurantIcon className={className} />;
    case "cafe":
      return <CafeIcon className={className} />;
    case "shop":
      return <ShopIcon className={className} />;
    case "train":
      return <TrainIcon className={className} />;
    case "bus":
      return <BusIcon className={className} />;
    case "ship":
      return <ShipIcon className={className} />;
    default:
      return <PinIcon className={className} />;
  }
}

function AirplaneIcon({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5Z" />
    </svg>
  );
}

function HotelIcon({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7 4 8.34 4 10s1.34 3 3 3Zm13-6h-8v7H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4Z" />
    </svg>
  );
}

function HospitalIcon({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M5 21V5h14v16H5Zm6.2-4.2h1.6V13.6h3.2v-1.6h-3.2V8.8h-1.6v3.2H8.2v1.6h3Z" />
    </svg>
  );
}

function RestaurantIcon({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M7.2 3.6v7.2c0 1.1.7 2 1.7 2.3V20h1.6v-6.9c1-.3 1.7-1.2 1.7-2.3V3.6h-1.6v6.6H11V3.6H9.4v6.6H8.8V3.6H7.2Zm8.4 0c-1.6 1.8-2.4 3.8-2.4 6.2 0 1.7.7 3.1 1.8 4V20h1.6v-6.2c1.1-.9 1.8-2.3 1.8-4 0-2.4-.8-4.4-2.4-6.2h-.4Z" />
    </svg>
  );
}

function CafeIcon({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M4 6h11.5v6.2c0 2.3-1.9 4.2-4.2 4.2H8.2C5.9 16.4 4 14.5 4 12.2V6Zm13 1.4h1.4c1.7 0 3.1 1.4 3.1 3.1S20.1 13.6 18.4 13.6H17V7.4ZM6.2 18.6h11.6V20.4H6.2v-1.8Z" />
    </svg>
  );
}

function ShopIcon({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M5 8.4 6.6 4h10.8L19 8.4V20H5V8.4Zm2 1.6v8.4h10V10H7Zm1.4-4.4L7.6 8.4h8.8l-.8-2.8H8.4Z" />
    </svg>
  );
}

function TrainIcon({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M7.2 3.6h9.6c1.5 0 2.8 1.3 2.8 2.8v8.8c0 1.7-1.2 3.1-2.8 3.4l1.4 1.4v.8H6v-.8l1.4-1.4c-1.6-.3-2.8-1.7-2.8-3.4V6.4c0-1.5 1.3-2.8 2.8-2.8Zm.8 13.2h8V12H8v4.8Zm0-6.4h8V6.4H8v4Z" />
    </svg>
  );
}

function BusIcon({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M6 4h12c1.7 0 3 1.3 3 3v9.2c0 1.2-.8 2.3-2 2.7V21h-1.8v-2H8.8v2H7v-2.1c-1.2-.4-2-1.5-2-2.7V7c0-1.7 1.3-3 3-3Zm0 10.4h12V8H6v6.4Zm2.2 1.8a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Zm7.6 0a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Z" />
    </svg>
  );
}

function ShipIcon({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M4.4 14.2 12 11.4l7.6 2.8-1.4 4.2H5.8l-1.4-4.2ZM12 4.2 16.4 10H7.6L12 4.2ZM4 20.2c1.4-.8 2.8-.8 4.2 0 1.4.8 2.8.8 4.2 0 1.4-.8 2.8-.8 4.2 0 1.4.8 2.8.8 4.2 0v1.4c-1.4.8-2.8.8-4.2 0-1.4-.8-2.8-.8-4.2 0-1.4.8-2.8.8-4.2 0-1.4-.8-2.8-.8-4.2 0V20.2Z" />
    </svg>
  );
}

function PinIcon({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 3.2A5.8 5.8 0 0 0 6.2 9c0 3.6 4.2 8.6 5.5 10.2.2.2.6.2.8 0C13.8 17.6 17.8 12.6 17.8 9A5.8 5.8 0 0 0 12 3.2Zm0 7.8A2 2 0 1 1 12 7a2 2 0 0 1 0 4Z" />
    </svg>
  );
}
