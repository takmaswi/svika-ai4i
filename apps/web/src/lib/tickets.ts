// PostgREST embeds board_codes as a single object while the ticket to code
// relationship is one-to-one (unique ticket_id), and as an array when it is
// not. Normalise so pages never care.
export interface BoardCodeEmbed {
  code: string;
  valid_until: string;
}

export function boardCodesOf(
  embed: BoardCodeEmbed | BoardCodeEmbed[] | null | undefined,
): BoardCodeEmbed[] {
  if (!embed) return [];
  return Array.isArray(embed) ? embed : [embed];
}
