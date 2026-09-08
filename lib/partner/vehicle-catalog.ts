export type VehicleCatalogModel = {
  code: string;
  name: string;
};

export type VehicleCatalogBrand = {
  code: string;
  name: string;
  models: readonly VehicleCatalogModel[];
};

export const PARTNER_VEHICLE_CATALOG: readonly VehicleCatalogBrand[] = [
  {
    code: "mercedes-benz",
    name: "Mercedes-Benz",
    models: [
      { code: "c-class", name: "C-Class" },
      { code: "e-class", name: "E-Class" },
      { code: "s-class", name: "S-Class" },
      { code: "vito", name: "Vito" },
      { code: "v-class", name: "V-Class" },
      { code: "sprinter", name: "Sprinter" },
      { code: "tourismo", name: "Tourismo" },
      { code: "travego", name: "Travego" },
    ],
  },
  {
    code: "volkswagen",
    name: "Volkswagen",
    models: [
      { code: "passat", name: "Passat" },
      { code: "caddy", name: "Caddy" },
      { code: "caravelle", name: "Caravelle" },
      { code: "transporter", name: "Transporter" },
      { code: "crafter", name: "Crafter" },
    ],
  },
  {
    code: "ford",
    name: "Ford",
    models: [
      { code: "transit", name: "Transit" },
      { code: "transit-custom", name: "Transit Custom" },
      { code: "tourneo-custom", name: "Tourneo Custom" },
      { code: "tourneo-connect", name: "Tourneo Connect" },
    ],
  },
  {
    code: "renault",
    name: "Renault",
    models: [
      { code: "megane", name: "Megane" },
      { code: "trafic", name: "Trafic" },
      { code: "master", name: "Master" },
    ],
  },
  {
    code: "fiat",
    name: "Fiat",
    models: [
      { code: "egea", name: "Egea" },
      { code: "doblo", name: "Doblo" },
      { code: "ducato", name: "Ducato" },
    ],
  },
  {
    code: "toyota",
    name: "Toyota",
    models: [
      { code: "corolla", name: "Corolla" },
      { code: "camry", name: "Camry" },
      { code: "hiace", name: "Hiace" },
      { code: "coaster", name: "Coaster" },
    ],
  },
  {
    code: "peugeot",
    name: "Peugeot",
    models: [
      { code: "508", name: "508" },
      { code: "traveller", name: "Traveller" },
      { code: "expert", name: "Expert" },
      { code: "boxer", name: "Boxer" },
    ],
  },
  {
    code: "citroen",
    name: "Citroën",
    models: [
      { code: "c5", name: "C5" },
      { code: "spacetourer", name: "SpaceTourer" },
      { code: "jumpy", name: "Jumpy" },
      { code: "jumper", name: "Jumper" },
    ],
  },
  {
    code: "opel",
    name: "Opel",
    models: [
      { code: "insignia", name: "Insignia" },
      { code: "zafira-life", name: "Zafira Life" },
      { code: "vivaro", name: "Vivaro" },
      { code: "movano", name: "Movano" },
    ],
  },
  {
    code: "hyundai",
    name: "Hyundai",
    models: [
      { code: "elantra", name: "Elantra" },
      { code: "staria", name: "Staria" },
      { code: "h350", name: "H350" },
    ],
  },
  {
    code: "kia",
    name: "Kia",
    models: [
      { code: "carnival", name: "Carnival" },
      { code: "k8", name: "K8" },
    ],
  },
  {
    code: "skoda",
    name: "Skoda",
    models: [
      { code: "octavia", name: "Octavia" },
      { code: "superb", name: "Superb" },
    ],
  },
  {
    code: "audi",
    name: "Audi",
    models: [
      { code: "a6", name: "A6" },
      { code: "a8", name: "A8" },
    ],
  },
  {
    code: "bmw",
    name: "BMW",
    models: [
      { code: "5-series", name: "5 Series" },
      { code: "7-series", name: "7 Series" },
    ],
  },
  {
    code: "isuzu",
    name: "Isuzu",
    models: [
      { code: "turkuaz", name: "Turkuaz" },
      { code: "novo", name: "Novo" },
      { code: "novo-ultra", name: "Novo Ultra" },
      { code: "citibus", name: "Citibus" },
      { code: "grand-toro", name: "Grand Toro" },
    ],
  },
  {
    code: "iveco",
    name: "Iveco",
    models: [
      { code: "daily", name: "Daily" },
      { code: "daily-minibus", name: "Daily Minibus" },
      { code: "crossway", name: "Crossway" },
      { code: "magelys", name: "Magelys" },
    ],
  },
  {
    code: "man",
    name: "MAN",
    models: [
      { code: "tge", name: "TGE" },
      { code: "lions-coach", name: "Lion's Coach" },
      { code: "lions-intercity", name: "Lion's Intercity" },
    ],
  },
  {
    code: "temsa",
    name: "Temsa",
    models: [
      { code: "prestij-sx", name: "Prestij SX" },
      { code: "md9", name: "MD9" },
      { code: "ld13", name: "LD 13" },
      { code: "safari", name: "Safari" },
    ],
  },
  {
    code: "otokar",
    name: "Otokar",
    models: [
      { code: "sultan", name: "Sultan" },
      { code: "doruk", name: "Doruk" },
      { code: "kent", name: "Kent" },
      { code: "navigo", name: "Navigo" },
    ],
  },
  {
    code: "karsan",
    name: "Karsan",
    models: [
      { code: "jest", name: "Jest" },
      { code: "atak", name: "Atak" },
      { code: "e-ata", name: "e-ATA" },
    ],
  },
] as const;

export function partnerVehicleBrandByCode(code: string) {
  return PARTNER_VEHICLE_CATALOG.find((brand) => brand.code === code) ?? null;
}

export function partnerVehicleModelByCode(brandCode: string, modelCode: string) {
  return (
    partnerVehicleBrandByCode(brandCode)?.models.find((model) => model.code === modelCode) ?? null
  );
}

export function isPartnerVehicleCatalogPair(brandCode: string, modelCode: string) {
  return Boolean(partnerVehicleModelByCode(brandCode, modelCode));
}

export function partnerVehicleCatalogLabels(brandCode: string, modelCode: string) {
  const brand = partnerVehicleBrandByCode(brandCode);
  const model = partnerVehicleModelByCode(brandCode, modelCode);
  return {
    brand: brand?.name ?? null,
    model: model?.name ?? null,
  };
}
