import { Table, TableBody, TableHead, TableRow, Typography, Box } from "@mui/material";
import { observer } from "mobx-react-lite";
import { FC, useContext, useState } from "react";
import Store from "../../Interface/Store2";
import { DataContext } from "../../App2";
import { StickyTableContainer, TextCell, SortableHeader } from "../CellComponents/TableComponents2";
import { CourseCategoryShortDictionary } from "../../Preset/Constants2";

const SchoolClassTable: FC<{ categoryColor: string }> = observer(({ categoryColor }) => {
    const store = useContext(Store);
    const { schoolPopData, schoolCSData } = useContext(DataContext);
    const year = store.schoolYearShowing;
    const selectedCat = store.courseCategory;
    const selectedLevel = store.courseLevel;

    const [sortAttr, setSortAttr] = useState<'name' | 'courses' | 'category'>('name');
    const [sortUp, setSortUp] = useState(true);

    const selectedIDs = [...store.selectedDistricts];
    const popRows = schoolPopData[year] || [];
    const csRows = schoolCSData[year] || [];

    const schools = selectedIDs.length === 0 ? [] : popRows
        // "NULL" as the NCES school number marks a placeholder, not a real school -
        // e.g. "Out of State School", used to bucket out-of-state-enrolled students
        // under a district for funding purposes.
        .filter((row: any) => String(row[3]).trim().toUpperCase() !== 'NULL')
        .filter((row: any) => selectedIDs.includes(String(row[8]).trim()))
        .map((row: any) => {
            const name = String(row[1]).trim();
            const ncesID = String(row[3]).trim();

            const csStats = csRows.reduce((acc: any, csRow: any) => {
                const rowSchNCES = String(csRow[3]).trim();
                if (rowSchNCES !== ncesID) return acc;

                // Unconditional total - every category's course count, added once each,
                // regardless of which category/level is currently selected.
                acc.totalCourses += (Number(csRow[8]) || 0) + (Number(csRow[14]) || 0);

                const rowCat = String(csRow[7]).trim();
                let matches = false;
                if (selectedCat === 'CS Total') {
                    matches = true;
                } else if (selectedCat === 'CS Foundational') {
                    matches = (rowCat !== 'CS-Related');
                } else if (selectedCat === 'Web/Software Development') {
                    matches = (rowCat === 'WebSoftDev');
                } else {
                    matches = (rowCat.toLowerCase() === selectedCat.toLowerCase());
                }
                if (!matches) return acc;

                if (selectedLevel !== 'Advanced') acc.basic += Number(csRow[8]) || 0;
                if (selectedLevel !== 'Basic') acc.advanced += Number(csRow[14]) || 0;

                return acc;
            }, { totalCourses: 0, basic: 0, advanced: 0 });

            return {
                name,
                ncesID,
                totalCourses: csStats.totalCourses,
                categoryCourses: csStats.basic + csStats.advanced,
                basic: csStats.basic,
                advanced: csStats.advanced,
            };
        });

    const sortedSchools = [...schools].sort((a, b) => {
        const aValue = sortAttr === 'name' ? a.name : sortAttr === 'courses' ? a.totalCourses : a.categoryCourses;
        const bValue = sortAttr === 'name' ? b.name : sortAttr === 'courses' ? b.totalCourses : b.categoryCourses;
        if (aValue === bValue) return 0;
        return sortUp ? (aValue > bValue ? 1 : -1) : (aValue < bValue ? 1 : -1);
    });

    if (selectedIDs.length === 0) {
        return (
            <Box sx={{ p: 10, textAlign: 'center', border: '1px dashed #ccc', borderRadius: '4px' }}>
                <Typography color="textSecondary">
                    Check one or more districts on the left to view the list of schools.
                </Typography>
            </Box>
        );
    }

    return (
        <StickyTableContainer>
            <Table stickyHeader size="small">
                <TableHead>
                    <TableRow>
                        <SortableHeader
                            headerName="School Name"
                            isSorting={sortAttr === 'name'}
                            isSortUp={sortUp}
                            onClick={() => { setSortAttr('name'); setSortUp(!sortUp); }}
                        />
                        <SortableHeader
                            headerName="Total Computing Courses"
                            isSorting={sortAttr === 'courses'}
                            isSortUp={sortUp}
                            onClick={() => { setSortAttr('courses'); setSortUp(!sortUp); }}
                        />
                        <SortableHeader
                            headerName={`${CourseCategoryShortDictionary[selectedCat] ?? selectedCat} Courses`}
                            isSorting={sortAttr === 'category'}
                            isSortUp={sortUp}
                            onClick={() => { setSortAttr('category'); setSortUp(!sortUp); }}
                            additionalStyle={{ color: categoryColor }}
                        />
                        <TextCell style={{ fontWeight: 'bold', backgroundColor: '#f9f9f9', color: categoryColor }}>
                            Basic & Advanced
                        </TextCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {sortedSchools.map((s) => (
                        <TableRow key={s.ncesID} hover>
                            <TextCell>{s.name}</TextCell>

                            <TextCell style={{ color: '#666' }}>
                                {s.totalCourses.toLocaleString()}
                            </TextCell>

                            <TextCell style={{ fontWeight: 'bold', color: categoryColor }}>
                                {s.categoryCourses.toLocaleString()}
                            </TextCell>

                            <TextCell style={{ fontSize: '0.8rem', color: '#555', lineHeight: '1.4' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span><span style={{ fontWeight: 'bold' }}>Basic:</span> <span style={{ color: '#555' }}>{s.basic.toLocaleString()}</span></span>
                                    <span><span style={{ fontWeight: 'bold' }}>Advanced:</span> <span style={{ color: '#555' }}>{s.advanced.toLocaleString()}</span></span>
                                </div>
                            </TextCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </StickyTableContainer>
    );
});

export default SchoolClassTable;
