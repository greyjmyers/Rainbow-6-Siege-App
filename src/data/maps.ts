export interface BombSite {
  id: string;
  name: string;
  floor: string;
}

export interface GameMap {
  id: string;
  name: string;
  sites: BombSite[];
}

const site = (floor: string, name: string): BombSite => ({
  id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
  name,
  floor,
});

// Maps and sites are editable in-app; this is only the starting pool.
export const MAPS: GameMap[] = [
  {
    id: "bank",
    name: "Bank",
    sites: [
      site("2F", "CEO Office / Executive Lounge"),
      site("1F", "Open Area / Staff Room"),
      site("1F", "Tellers' Office / Archives"),
      site("B", "Lockers / CCTV Room"),
    ],
  },
  {
    id: "border",
    name: "Border",
    sites: [
      site("2F", "Armory Lockers / Archives"),
      site("1F", "Workshop / Ventilation Room"),
      site("1F", "Customs Inspection / Supply Room"),
      site("1F", "Bathroom / Tellers"),
    ],
  },
  {
    id: "chalet",
    name: "Chalet",
    sites: [
      site("2F", "Master Bedroom / Office"),
      site("1F", "Bar / Gaming Room"),
      site("1F", "Kitchen / Dining Room"),
      site("B", "Wine Cellar / Snowmobile Garage"),
    ],
  },
  {
    id: "clubhouse",
    name: "Clubhouse",
    sites: [
      site("2F", "Gym / Bedroom"),
      site("2F", "CCTV Room / Cash Room"),
      site("1F", "Bar / Stage"),
      site("B", "Church / Arsenal Room"),
    ],
  },
  {
    id: "coastline",
    name: "Coastline",
    sites: [
      site("2F", "Theater / Penthouse"),
      site("2F", "Hookah Lounge / Billiards Room"),
      site("1F", "Kitchen / Service Entrance"),
      site("1F", "Blue Bar / Sunrise Bar"),
    ],
  },
  {
    id: "consulate",
    name: "Consulate",
    sites: [
      site("2F", "Consul Office / Meeting Room"),
      site("1F", "Lobby / Press Room"),
      site("B", "Garage / Cafeteria"),
      site("B", "Tellers / Archives"),
    ],
  },
  {
    id: "kafe",
    name: "Kafe Dostoyevsky",
    sites: [
      site("3F", "Bar / Cocktail Lounge"),
      site("2F", "Fireplace Hall / Mining Room"),
      site("2F", "Reading Room / Fireplace Hall"),
      site("1F", "Kitchen Service / Kitchen Cooking"),
    ],
  },
  {
    id: "oregon",
    name: "Oregon",
    sites: [
      site("2F", "Kids' Dorms / Dorms Main Hall"),
      site("1F", "Kitchen / Dining Hall"),
      site("1F", "Meeting Hall / Kitchen"),
      site("B", "Laundry Room / Supply Room"),
    ],
  },
  {
    id: "outback",
    name: "Outback",
    sites: [
      site("2F", "Laundry / Games Room"),
      site("2F", "Party Room / Office"),
      site("1F", "Nature Room / Bushranger Room"),
      site("1F", "Compressor Room / Gear Store"),
    ],
  },
  {
    id: "skyscraper",
    name: "Skyscraper",
    sites: [
      site("2F", "Bedroom / Bathroom"),
      site("2F", "Tea Room / Karaoke"),
      site("1F", "Exhibition / Office"),
      site("1F", "Kitchen / BBQ"),
    ],
  },
  {
    id: "theme-park",
    name: "Theme Park",
    sites: [
      site("2F", "Initiation Room / Office"),
      site("2F", "Bunk / Day Care"),
      site("1F", "Armory / Throne Room"),
      site("1F", "Lab / Storage"),
    ],
  },
  {
    id: "villa",
    name: "Villa",
    sites: [
      site("2F", "Aviator Room / Games Room"),
      site("2F", "Trophy Room / Statuary Room"),
      site("1F", "Living Room / Library"),
      site("1F", "Dining Room / Kitchen"),
    ],
  },
];
