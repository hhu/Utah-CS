import { FC, useContext, useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import { Box, Table, TableHead, TableRow, TableBody, TableCell, Typography, Tooltip, TableSortLabel } from "@mui/material";
import { StickyTableContainer, TextCell } from "../GeneralComponents";
import { DataContext } from "../../App2";
import Store from "../../Interface/Store2";
import { CourseCategoryDictionary, resolveBaseCourseName } from "../../Preset/Constants2";

interface CourseCatalogTabProps {
    categoryColor: string;
}

// Navy from the dashboard's main palette - white "CE" text on it meets 4.5:1
// contrast.
const CE_BADGE_COLOR = '#253D81';

const ceBadgeSx = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 26,
    height: 26,
    minWidth: 26,
    borderRadius: '50%',
    backgroundColor: CE_BADGE_COLOR,
    color: '#fff',
    fontSize: '0.65rem',
    fontWeight: 700,
    lineHeight: 1,
} as const;

// The real badge shown next to a course that has a CE version: focusable and
// labeled for screen readers, with the CE course code in a tooltip since a
// bare "CE" is otherwise cryptic.
const CEBadge: FC<{ ceCode: string }> = ({ ceCode }) => (
    <Tooltip title={`Concurrent enrollment (CE) course code: ${ceCode}`}>
        <Box component="span" tabIndex={0} aria-label="Concurrent enrollment" sx={{ ...ceBadgeSx, ml: 1 }}>
            CE
        </Box>
    </Tooltip>
);

// A decorative copy of the same badge, used only in the legend above the
// table to explain what the real badges mean.
const CELegendSample: FC = () => (
    <Box aria-hidden="true" sx={ceBadgeSx}>CE</Box>
);

// Swatch colors for the Level column - paired with the level's name as text,
// never color alone.
const LEVEL_SWATCH_COLOR: Record<string, string> = {
    Basic: '#253D81',
    Advanced: '#6D95CE',
};

const LevelCell: FC<{ level: string }> = ({ level }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: LEVEL_SWATCH_COLOR[level] ?? '#999',
            flexShrink: 0,
        }} />
        <span>{level}</span>
    </Box>
);

// Basic sorts before Advanced - not alphabetical, which would put Advanced first.
const LEVEL_SORT_RANK: Record<string, number> = { Basic: 0, Advanced: 1 };

const headerCellSx = {
    backgroundColor: '#003789',
    color: '#fff',
    fontWeight: 700,
} as const;

const sortLabelSx = {
    color: '#fff',
    '&:hover': { color: '#fff' },
    '&.Mui-active': { color: '#fff' },
    '& .MuiTableSortLabel-icon': { color: '#fff !important' },
} as const;

type CourseDetails = [string, string, string, string]; // [Name, Type, Category, Level]

type CatalogRow = {
    code: string;
    name: string;
    category: string;
    level: string;
    ceCode: string | null;
};

type SortField = 'course' | 'category' | 'level' | 'code';

const categoryLabelFor = (category: string) => CourseCategoryDictionary[category] ?? category;

const CourseCatalogTab: FC<CourseCatalogTabProps> = ({ categoryColor }) => {
    const store = useContext(Store);
    const courseData = useContext(DataContext).courseData;

    const [sortField, setSortField] = useState<SortField>('course');
    const [sortAsc, setSortAsc] = useState(true);

    const handleSort = (field: SortField) => {
        if (field === sortField) {
            setSortAsc(prev => !prev);
        } else {
            setSortField(field);
            setSortAsc(true);
        }
    };

    const { rows, ceCount } = useMemo(() => {
        if (!courseData?.byCode) return { rows: [] as CatalogRow[], ceCount: 0 };

        const matchesLevel = (level: string) => store.courseLevel === 'All' || level === store.courseLevel;
        const matchesCategory = (type: string, category: string) => {
            if (store.courseCategory === 'CS Total') return true;
            if (store.courseCategory === 'CS Foundational') return type === 'CS';
            return category === store.courseCategory;
        };

        // Split all courses into base courses and CE (concurrent enrollment)
        // courses, by name - CE rows are named "<base name> CE" (quirk 7 in
        // Constants2.tsx).
        const baseEntries: [string, CourseDetails][] = [];
        const ceEntries: [string, CourseDetails][] = [];

        Object.entries(courseData.byCode).forEach(([code, details]) => {
            const [name] = details as CourseDetails;
            if (/\s+CE$/i.test(name)) {
                ceEntries.push([code, details as CourseDetails]);
            } else {
                baseEntries.push([code, details as CourseDetails]);
            }
        });

        // Base course name (lowercased) -> its CE course code.
        const ceCodeByBaseName: Record<string, string> = {};
        ceEntries.forEach(([ceCode, [ceName]]) => {
            const baseName = resolveBaseCourseName(ceName);
            ceCodeByBaseName[baseName] = ceCode;
        });

        const matchedBaseNames = new Set<string>();

        const allRows: CatalogRow[] = baseEntries
            .filter(([, [, type, category, level]]) => matchesCategory(type, category) && matchesLevel(level))
            .map(([code, [name, , category, level]]) => {
                const baseNameKey = name.trim().toLowerCase();
                const ceCode = ceCodeByBaseName[baseNameKey] ?? null;
                if (ceCode) matchedBaseNames.add(baseNameKey);
                return { code, name, category, level, ceCode };
            });

        // A CE row whose resolved base name never matched a base course - flag it
        // instead of silently dropping it, since that means the data changed in a
        // way the alias table in Constants2.tsx doesn't yet cover.
        Object.entries(ceCodeByBaseName).forEach(([baseName, ceCode]) => {
            if (!matchedBaseNames.has(baseName)) {
                console.error(`Course Catalog: CE course ${ceCode} ("${baseName} CE") has no matching base course.`);
            }
        });

        return { rows: allRows, ceCount: allRows.filter(r => r.ceCode).length };
    }, [courseData, store.courseCategory, store.courseLevel]);

    const sortedRows = useMemo(() => {
        const copy = [...rows];
        copy.sort((a, b) => {
            let cmp: number;
            if (sortField === 'course') {
                cmp = a.name.localeCompare(b.name);
            } else if (sortField === 'category') {
                cmp = categoryLabelFor(a.category).localeCompare(categoryLabelFor(b.category));
            } else if (sortField === 'level') {
                cmp = (LEVEL_SORT_RANK[a.level] ?? 2) - (LEVEL_SORT_RANK[b.level] ?? 2);
            } else {
                cmp = Number(a.code) - Number(b.code);
            }
            return sortAsc ? cmp : -cmp;
        });
        return copy;
    }, [rows, sortField, sortAsc]);

    const categoryLabel = categoryLabelFor(store.courseCategory);
    const levelLabel = store.courseLevel === 'All' ? 'All Levels' : store.courseLevel;

    return (
        <Box sx={{ p: 2 }}>
            <Typography variant="h5" sx={{ color: categoryColor, fontWeight: 700 }}>
                Course Catalog: {categoryLabel}
            </Typography>
            <Typography sx={{ color: '#555', mb: 2 }}>
                {rows.length} courses listed ({levelLabel}) - {ceCount} with a Concurrent Enrollment version
            </Typography>

            {rows.length > 0 && ceCount > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <CELegendSample />
                    <Typography variant="body2" sx={{ color: '#555' }}>
                        = a concurrent enrollment (CE) version of this course is also offered
                    </Typography>
                </Box>
            )}

            {rows.length === 0 ? (
                <Typography sx={{ p: 2, color: '#777' }}>
                    No courses are listed in this category at this level.
                </Typography>
            ) : (
                <StickyTableContainer>
                    <Table size="small" stickyHeader>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={headerCellSx} onClick={() => handleSort('course')} style={{ cursor: 'pointer' }}>
                                    <TableSortLabel
                                        active={sortField === 'course'}
                                        direction={sortField === 'course' ? (sortAsc ? 'asc' : 'desc') : 'asc'}
                                        sx={sortLabelSx}
                                    >
                                        Course
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell sx={headerCellSx} onClick={() => handleSort('category')} style={{ cursor: 'pointer' }}>
                                    <TableSortLabel
                                        active={sortField === 'category'}
                                        direction={sortField === 'category' ? (sortAsc ? 'asc' : 'desc') : 'asc'}
                                        sx={sortLabelSx}
                                    >
                                        Category
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell sx={headerCellSx} onClick={() => handleSort('level')} style={{ cursor: 'pointer' }}>
                                    <TableSortLabel
                                        active={sortField === 'level'}
                                        direction={sortField === 'level' ? (sortAsc ? 'asc' : 'desc') : 'asc'}
                                        sx={sortLabelSx}
                                    >
                                        Level
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell sx={headerCellSx} onClick={() => handleSort('code')} style={{ cursor: 'pointer' }}>
                                    <TableSortLabel
                                        active={sortField === 'code'}
                                        direction={sortField === 'code' ? (sortAsc ? 'asc' : 'desc') : 'asc'}
                                        sx={sortLabelSx}
                                    >
                                        Course Code
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell sx={headerCellSx}>Description</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {sortedRows.map(row => (
                                <TableRow key={row.code}>
                                    <TextCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                            <span>{row.name}</span>
                                            {row.ceCode && <CEBadge ceCode={row.ceCode} />}
                                        </Box>
                                    </TextCell>
                                    <TextCell>{categoryLabelFor(row.category)}</TextCell>
                                    <TextCell><LevelCell level={row.level} /></TextCell>
                                    <TextCell>{row.code}</TextCell>
                                    <TextCell />
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </StickyTableContainer>
            )}
        </Box>
    );
};

export default observer(CourseCatalogTab);
