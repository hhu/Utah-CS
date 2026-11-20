// Known data quirks and exceptions, 2024-25 (new dashboard). Code that handles one
// of these links back to this comment; add new ones here so they stay in one place.
//
// 1. Schools that don't serve grades 9-12 (e.g. Harris Intermediate, Alpine Online
//    School) are simply not in "School Pop. Data" / "School CS Data" - whoever
//    built 2026_02_20_Cleaned_v2.xlsx already filtered them out upstream. No code
//    here needs to drop them; there is just nothing to drop.
// 2. A district/LEA missing from "LEA Pop. Data" or "Total LEA CS Data" for
//    2024-25 has confirmed zero CS participation/courses that year, not a
//    suppressed small count - see OverviewTab2.tsx, DistrictTable2.tsx, and
//    DistrictClassTable.tsx, which all add these districts back in at 0 using
//    "School Pop. Data" as the full district list.
// 3. Utah Schools for the Deaf and the Blind (and its individual campuses, e.g.
//    Kenneth Burdett School) are excluded from USBE's grade-level enrollment file
//    entirely, at both the school and LEA level, by USBE's own stated policy (see
//    that file's "Title and Notes" sheet) - not suppressed, not a name mismatch.
// 4. "Out of State School" (School Pop. Data / School CS Data) is a placeholder
//    under Box Elder District for out-of-state-enrolled students, not a real
//    school - identifiable by its NCES school number being the literal string
//    "NULL". Filtered out in SchoolTable2.tsx.
// 5. For 2024-25 only, "LEA Pop. Data"'s Total/Girls/Boys columns hold unique
//    CS-participant counts, not population like every other year in that same
//    column - see districtStats in OverviewTab2.tsx.
// 6. A handful of LEA/school names differ between our workbook and USBE's
//    grade-level enrollment file in ways a case-insensitive match alone can't
//    bridge - see gradeLevelNameAliases below.
export const linkToData = '/Utah-CS/data/2026_02_20_Cleaned_v2.xlsx';
export const linkToGeoJson = '/Utah-CS/data/Utah_School_District_Boundaries.geojson';

// USBE's Oct 1 fall-enrollment count, broken down by grade. Despite the "2025" in
// the filename, this is the Oct 2024 count - the file USBE publishes for a school
// year is named after the year school *ends* in (so "2024-25" -> "2025"). Next
// year's update will likely be named 2026FallEnrollmentGradeLevelDemographics.xlsx -
// check its "Title and Notes" sheet to confirm which school year it's really for.
export const linkToGradeLevelData = '/Utah-CS/data/2025FallEnrollmentGradeLevelDemographics.xlsx';

// A few LEA/school names differ between our workbook and the grade-level file in
// ways a plain string match can't bridge (not just upper/lower case). Keyed by the
// grade-level file's own spelling, lowercased -> our workbook's spelling, lowercased.
const gradeLevelNameAliases: Record<string, string> = {
    'innovations high school': 'innovations early college high school',
};

// Case differences alone (e.g. "InTech" vs "Intech") are handled by lowercasing;
// this also folds in the alias table above for names that differ more than that.
export const normalizeGradeLevelName = (name: string): string => {
    const key = String(name || '').trim().toLowerCase();
    return gradeLevelNameAliases[key] ?? key;
};

export const PossibleSchoolYears = [
    '2024-25'
];

export const PossibleCategories = [
    { name: 'All CS TEST', key: 'CST', shortName: 'ALL CS TEST' },
    { name: 'All CS TEST Basic', key: 'CST-B', shortName: 'Total Basic CS' },
     { name: 'CS Total Advanced', key: 'CST-A', shortName: 'Total Advanced CS' },

    { name: 'CS Foundational', key: 'CSF', shortName: 'Foundational CS' },
    { name: 'CS Foundational Basic', key: 'CSF-B', shortName: 'Foundational Basic CS' },
    { name: 'CS Foundational Advanced', key: 'CSF-A', shortName: 'Foundational Advanced CS' },

    { name: 'Related CS', key: 'CSR', shortName: 'Related CS' },
    { name: 'Related CS Basic', key: 'CSR-B', shortName: 'Related CS Basic' },
    { name: 'Related CS Advanced', key: 'CSR-A', shortName: 'Related CS Advanced' },

    { name: 'Core CS', key: 'CSC', shortName: 'Core CS' },
    { name: 'Core CS Basic', key: 'CSC-B', shortName: 'Core CS Basic' },
    { name: 'Core CS Advanced', key: 'CSC-A', shortName: 'Core CS Advanced' },

    { name: 'Cybersecurity', key: 'CB', shortName: 'Cybersecurity' },
    { name: 'Cybersecurity Basic', key: 'CB-B', shortName: 'Cybersecurity Basic' },
    { name: 'Cybersecurity Advanced', key: 'CB-A', shortName: 'Cybersecurity Advanced' },

    { name: 'Databases', key: 'D', shortName: 'Databases' },
    { name: 'Databases Basic', key: 'D-B', shortName: 'Databases Basic' },
    { name: 'Databases Advanced', key: 'D-A', shortName: 'Databases Advanced' },

    { name: 'Web/Software Development', key: 'WSD', shortName: 'Web/Software Development' },
    { name: 'Web/Software Development Basic', key: 'WSD-B', shortName: 'Web/Software Development Basic' },
    { name: 'Web/Software Development Advanced', key: 'WSD-A', shortName: 'Web/Software Development Advanced' }



];

export const ColorPalette = [
    '#253D81', // Dark Blue
    '#EE2A26', // Red
    '#DD9505', // Gold
    '#27AE60', // Green
    '#8E44AD', // Purple
    '#E67E22', // Orange
    '#16A085', // Teal
    '#2C3E50', // Dark Grey
    '#C0392B', // Dark Red
    '#2980B9', // Bright Blue
];