// Static FRT van directory — one row per FRT posting.
//
// FRT number, substation name and mobile number are FIXED (they never change),
// so they are hard-coded here rather than read from the database. Only the
// *vehicle number* is dynamic: the /frt-directory page looks it up from the DB
// by matching the vehicle's current FRT number (see app/frt-directory/page.tsx).
//
// Divisions/sub-divisions drive the "one page per division" print layout, which
// mirrors the official paper sheet. FRT numbers are assigned in division blocks;
// Ramsanehighat's sub-divisions + incharge come from that sheet. To adjust,
// just edit the rows below — no migration.

export type FrtDirectoryEntry = {
  frtNo: number; // 1..50 — the key used to map the current vehicle from the DB
  substation: string;
  mobile: string;
  division: string;
  subDivision?: string;
  qrt?: boolean; // true for the division-wide QRT van (spans the location columns)
};

export const FRT_CIRCLE = "Barabanki";

export const FRT_DIRECTORY: FrtDirectoryEntry[] = [
  // ── Barabanki (FRT 1–11) ──────────────────────────────────────────────────
  { frtNo: 1, substation: "OBARI", mobile: "9311912667", division: "Barabanki", subDivision: "BARABANKI (I)" },
  { frtNo: 2, substation: "OBARI NEW", mobile: "9311912668", division: "Barabanki", subDivision: "BARABANKI (I)" },
  { frtNo: 3, substation: "JP NAGAR", mobile: "9311912669", division: "Barabanki", subDivision: "BARABANKI (I)" },
  { frtNo: 4, substation: "PALHARI OLD", mobile: "9311912670", division: "Barabanki", subDivision: "BARABANKI (II)" },
  { frtNo: 5, substation: "PALHARI NEW", mobile: "9311912671", division: "Barabanki", subDivision: "BARABANKI (II)" },
  { frtNo: 6, substation: "BADEL", mobile: "9311912672", division: "Barabanki", subDivision: "BARABANKI (II)" },
  { frtNo: 7, substation: "SATRIKH", mobile: "9311912673", division: "Barabanki", subDivision: "BARABANKI (II)" },
  { frtNo: 8, substation: "BANKI", mobile: "9311912674", division: "Barabanki", subDivision: "BARABANKI (III)" },
  { frtNo: 9, substation: "CHANDAULI", mobile: "9311912675", division: "Barabanki", subDivision: "BARABANKI (III)" },
  { frtNo: 10, substation: "DEWA", mobile: "9311912676", division: "Barabanki", subDivision: "BARABANKI (III)" },
  { frtNo: 11, substation: "DUNDPURWA", mobile: "9311912677", division: "Barabanki", subDivision: "BARABANKI (III)" },

  // ── Ramnagar (FRT 12–21) ──────────────────────────────────────────────────
  { frtNo: 12, substation: "RAMNAGAR OLD", mobile: "9311912678", division: "Ramnagar", subDivision: "RAMNAGAR" },
  { frtNo: 13, substation: "RAMNAGAR TEHSIL", mobile: "9311912679", division: "Ramnagar", subDivision: "RAMNAGAR" },
  { frtNo: 14, substation: "RAMNAGAR IPDS", mobile: "9311912680", division: "Ramnagar", subDivision: "RAMNAGAR" },
  { frtNo: 15, substation: "SURATGANJ", mobile: "9311912681", division: "Ramnagar", subDivision: "RAMNAGAR" },
  { frtNo: 16, substation: "SUDHIYAMAU", mobile: "9311912682", division: "Ramnagar", subDivision: "RAMNAGAR" },
  { frtNo: 17, substation: "RASAULI", mobile: "9311912683", division: "Ramnagar", subDivision: "MASAULI" },
  { frtNo: 18, substation: "MASAULI", mobile: "9311912684", division: "Ramnagar", subDivision: "MASAULI" },
  { frtNo: 19, substation: "SIRAULI GAUSPUR OLD", mobile: "9311912685", division: "Ramnagar", subDivision: "MASAULI" },
  { frtNo: 20, substation: "SIRAULI GAUSPUR TEHSIL", mobile: "9311912686", division: "Ramnagar", subDivision: "MASAULI" },
  { frtNo: 21, substation: "TRILOKPUR", mobile: "9311912687", division: "Ramnagar", subDivision: "MASAULI" },

  // ── Haidergarh (FRT 22–29) ────────────────────────────────────────────────
  { frtNo: 22, substation: "HAIDERGARH RURAL", mobile: "9311912688", division: "Haidergarh", subDivision: "HAIDERGARH" },
  { frtNo: 23, substation: "HAIDERGARH TEHSIL", mobile: "9311912689", division: "Haidergarh", subDivision: "HAIDERGARH" },
  { frtNo: 24, substation: "KHARSATIYA", mobile: "9311912690", division: "Haidergarh", subDivision: "HAIDERGARH" },
  { frtNo: 25, substation: "BHILWAL DDUGJY", mobile: "9311912691", division: "Haidergarh", subDivision: "HAIDERGARH" },
  { frtNo: 26, substation: "DEVIGANJ", mobile: "9311912692", division: "Haidergarh", subDivision: "DEVIGANJ" },
  { frtNo: 27, substation: "KOTHI", mobile: "9311912693", division: "Haidergarh", subDivision: "DEVIGANJ" },
  { frtNo: 28, substation: "SIDHAUR DDUGJY", mobile: "9311912694", division: "Haidergarh", subDivision: "DEVIGANJ" },
  { frtNo: 29, substation: "SUBEHA", mobile: "9311912695", division: "Haidergarh", subDivision: "DEVIGANJ" },

  // ── Fatehpur (FRT 30–39) ──────────────────────────────────────────────────
  { frtNo: 30, substation: "FATEHPUR NEW", mobile: "9311912696", division: "Fatehpur", subDivision: "FATEHPUR" },
  { frtNo: 31, substation: "FATEHPUR IPDS", mobile: "9311912697", division: "Fatehpur", subDivision: "FATEHPUR" },
  { frtNo: 32, substation: "FATEHPUR TEHSIL", mobile: "9311912698", division: "Fatehpur", subDivision: "FATEHPUR" },
  { frtNo: 33, substation: "FATEHPUR OLD", mobile: "9311912699", division: "Fatehpur", subDivision: "FATEHPUR" },
  { frtNo: 34, substation: "BADDUPUR", mobile: "9311912700", division: "Fatehpur", subDivision: "FATEHPUR" },
  { frtNo: 35, substation: "BELAHRA", mobile: "9311912701", division: "Fatehpur", subDivision: "FATEHPUR" },
  { frtNo: 36, substation: "KURSI", mobile: "9311912702", division: "Fatehpur", subDivision: "KURSI" },
  { frtNo: 37, substation: "UPSIDC I", mobile: "9311912703", division: "Fatehpur", subDivision: "KURSI" },
  { frtNo: 38, substation: "UPSIDC II", mobile: "9311912704", division: "Fatehpur", subDivision: "KURSI" },
  { frtNo: 39, substation: "BABAGANJ", mobile: "9311912705", division: "Fatehpur", subDivision: "KURSI" },

  // ── Ramsanehighat (FRT 40–50) ─────────────────────────────────────────────
  { frtNo: 40, substation: "RAM SANEHIGHAT", mobile: "9311912706", division: "Ram Sanehighat", subDivision: "RAM SANEHIGHAT" },
  { frtNo: 41, substation: "DULHADEPUR", mobile: "9311912707", division: "Ram Sanehighat", subDivision: "RAM SANEHIGHAT" },
  { frtNo: 42, substation: "DARIYABAD", mobile: "9311912708", division: "Ram Sanehighat", subDivision: "RAM SANEHIGHAT" },
  { frtNo: 43, substation: "ZAIDPUR", mobile: "9311912709", division: "Ram Sanehighat", subDivision: "ZAIDPUR" },
  { frtNo: 44, substation: "SAFDARGANJ", mobile: "9311912710", division: "Ram Sanehighat", subDivision: "ZAIDPUR" },
  { frtNo: 45, substation: "MOHANA", mobile: "9311912711", division: "Ram Sanehighat", subDivision: "ZAIDPUR" },
  { frtNo: 46, substation: "TIKAIT NAGAR", mobile: "9311912712", division: "Ram Sanehighat", subDivision: "TIKAIT NAGAR" },
  { frtNo: 47, substation: "PUREDALAI", mobile: "9311912713", division: "Ram Sanehighat", subDivision: "TIKAIT NAGAR" },
  { frtNo: 48, substation: "KOTWA DHAM", mobile: "9311912714", division: "Ram Sanehighat", subDivision: "TIKAIT NAGAR" },
  { frtNo: 49, substation: "SARAY DUNAULI", mobile: "9311912715", division: "Ram Sanehighat", subDivision: "TIKAIT NAGAR" },
  { frtNo: 50, substation: "FRT Van For QRT Team", mobile: "9311912716", division: "Ram Sanehighat", qrt: true },
];

/** Extract the integer FRT number from a value like "FRT 40" / "FRT_40" / "40". */
export function parseFrtNo(value?: string | null): number | null {
  const match = (value ?? "").match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

/** Format a 10-digit mobile as 931-1912-706, matching the paper sheet. */
export function formatMobile(mobile: string): string {
  const digits = mobile.replace(/\D/g, "");
  if (digits.length !== 10) return mobile;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}
