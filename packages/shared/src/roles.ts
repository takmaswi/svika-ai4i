// Roles are not a column. Everyone is a rider by default (a profile row); an
// owners row or a conductors row elevates the same person. One profile can hold
// several roles, so we resolve a single "primary" role for the shell by
// precedence: owner surfaces first, then conductor, then rider.

export type Role = "rider" | "owner" | "conductor";

export interface RoleFlags {
  isOwner: boolean;
  isConductor: boolean;
}

/** Primary role for the app shell, by precedence owner > conductor > rider. */
export function primaryRole(flags: RoleFlags): Role {
  if (flags.isOwner) return "owner";
  if (flags.isConductor) return "conductor";
  return "rider";
}
