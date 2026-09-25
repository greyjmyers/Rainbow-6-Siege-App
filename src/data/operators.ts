export type Side = "attack" | "defense";

/**
 * Role tags drive team-composition rules. They are deliberately coarse: the
 * point is "does this lineup have a hard breacher", not a full meta model.
 */
export type Role =
  // attack
  | "hard-breach"
  | "soft-breach"
  | "anti-gadget"
  | "intel"
  | "entry"
  | "flank-watch"
  | "shield"
  | "vertical"
  | "support"
  // defense
  | "anti-breach"
  | "anchor"
  | "roam"
  | "trap"
  | "anti-drone"
  | "area-denial"
  | "site-setup"
  | "flex";

export interface Operator {
  id: string;
  name: string;
  side: Side;
  roles: Role[];
}

const atk = (name: string, roles: Role[]): Operator => ({
  id: slug(name),
  name,
  side: "attack",
  roles,
});
const def = (name: string, roles: Role[]): Operator => ({
  id: slug(name),
  name,
  side: "defense",
  roles,
});

export function slug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ø/gi, "o")
    .replace(/ä/gi, "a")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Roster is editable in-app (custom operators) so new seasons don't need a code change.
export const OPERATORS: Operator[] = [
  atk("Sledge", ["soft-breach", "entry", "vertical"]),
  atk("Thatcher", ["anti-gadget"]),
  atk("Ash", ["soft-breach", "entry"]),
  atk("Thermite", ["hard-breach"]),
  atk("Twitch", ["anti-gadget", "intel"]),
  atk("Montagne", ["shield"]),
  atk("Glaz", ["support", "flank-watch"]),
  atk("Fuze", ["anti-gadget"]),
  atk("Blitz", ["shield", "entry"]),
  atk("IQ", ["intel", "anti-gadget"]),
  atk("Buck", ["soft-breach", "vertical"]),
  atk("Blackbeard", ["entry"]),
  atk("Capitão", ["support"]),
  atk("Hibana", ["hard-breach", "vertical"]),
  atk("Jackal", ["intel"]),
  atk("Ying", ["entry"]),
  atk("Zofia", ["soft-breach", "entry"]),
  atk("Dokkaebi", ["intel"]),
  atk("Lion", ["intel"]),
  atk("Finka", ["support"]),
  atk("Maverick", ["hard-breach"]),
  atk("Nomad", ["flank-watch"]),
  atk("Gridlock", ["flank-watch"]),
  atk("Nøkk", ["entry"]),
  atk("Amaru", ["entry", "vertical"]),
  atk("Kali", ["anti-gadget"]),
  atk("Iana", ["intel"]),
  atk("Ace", ["hard-breach"]),
  atk("Zero", ["intel"]),
  atk("Flores", ["anti-gadget"]),
  atk("Osa", ["shield"]),
  atk("Sens", ["support"]),
  atk("Grim", ["intel"]),
  atk("Brava", ["anti-gadget", "intel"]),
  atk("Ram", ["soft-breach", "anti-gadget"]),
  atk("Deimos", ["intel", "entry"]),
  atk("Striker", ["flex"]),

  def("Smoke", ["area-denial", "anchor"]),
  def("Mute", ["anti-breach", "anti-drone"]),
  def("Castle", ["site-setup"]),
  def("Pulse", ["intel", "roam"]),
  def("Doc", ["anchor"]),
  def("Rook", ["anchor"]),
  def("Kapkan", ["trap"]),
  def("Tachanka", ["anchor", "area-denial"]),
  def("Jäger", ["anti-gadget"]),
  def("Bandit", ["anti-breach"]),
  def("Frost", ["trap"]),
  def("Valkyrie", ["intel"]),
  def("Caveira", ["roam", "intel"]),
  def("Echo", ["intel", "anchor"]),
  def("Mira", ["anchor", "site-setup"]),
  def("Lesion", ["trap", "roam"]),
  def("Ela", ["trap", "roam"]),
  def("Vigil", ["roam"]),
  def("Maestro", ["intel", "anchor"]),
  def("Alibi", ["roam", "trap"]),
  def("Clash", ["anchor"]),
  def("Kaid", ["anti-breach"]),
  def("Mozzie", ["anti-drone", "intel"]),
  def("Warden", ["anchor"]),
  def("Goyo", ["area-denial"]),
  def("Wamai", ["anti-gadget"]),
  def("Oryx", ["roam"]),
  def("Melusi", ["trap", "intel"]),
  def("Aruni", ["anti-gadget", "roam"]),
  def("Thunderbird", ["anchor"]),
  def("Thorn", ["trap"]),
  def("Azami", ["site-setup"]),
  def("Solis", ["intel", "roam"]),
  def("Fenrir", ["trap"]),
  def("Tubarão", ["anti-breach"]),
  def("Sentry", ["flex"]),
  def("Rauora", ["site-setup"]),
];

export const ROLE_LABELS: Record<Role, string> = {
  "hard-breach": "Hard breach",
  "soft-breach": "Soft breach",
  "anti-gadget": "Utility clear",
  intel: "Intel",
  entry: "Entry",
  "flank-watch": "Flank watch",
  shield: "Shield",
  vertical: "Vertical",
  support: "Support",
  "anti-breach": "Anti-breach",
  anchor: "Anchor",
  roam: "Roam",
  trap: "Trap",
  "anti-drone": "Anti-drone",
  "area-denial": "Area denial",
  "site-setup": "Site setup",
  flex: "Flex",
};
