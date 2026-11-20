import { Table, TableHead, TableRow, TableBody, Typography, Box } from "@mui/material";
import { observer } from "mobx-react-lite";
import { FC, useContext, useState } from "react";
import Store from "../../Interface/Store2";
import { DataContext } from "../../App2";
import { StickyTableContainer, TextCell, SortableHeader, DataValue } from "../CellComponents/TableComponents2";
import { normalizeGradeLevelName } from "../../Preset/Constants2";

const SchoolTable: FC<{ categoryColor: string }> = observer(({ categoryColor }) => {
    const store = useContext(Store);
    const { schoolPopData, schoolCSData, gradeLevelSchoolTotals } = useContext(DataContext);
    const year = store.schoolYearShowing;
    const selectedCat = store.courseCategory;
    const selectedLevel = store.courseLevel;

    const [sortAttr, setSortAttr] = useState<'name' | 'total' | 'enroll'>('name');
    const [sortUp, setSortUp] = useState(true);

    const selectedIDs = [...store.selectedDistricts];
    const popRows = schoolPopData[year] || [];
    const csRows = schoolCSData[year] || [];

    const filteredSchools = selectedIDs.length === 0 ? [] : popRows
        // "NULL" as the NCES school number marks a placeholder, not a real school -
        // e.g. "Out of State School", used to bucket out-of-state-enrolled students
        // under a district for funding purposes.
        .filter((row: any) => String(row[3]).trim().toUpperCase() !== 'NULL')
        .filter((row: any) => selectedIDs.includes(String(row[8]).trim()))
        .map((row: any) => {
            const name = String(row[1]).trim();
            const ncesID = String(row[3]).trim();
            // Prefer USBE's grade-level file for a true 9-12-only count; fall back to
            // "School Pop. Data" (whatever grades this school serves) if the school
            // isn't in the grade-level file (wrong year, or a name that didn't match).
            const gradeLevelTotal = gradeLevelSchoolTotals[normalizeGradeLevelName(name)];
            const totalStudents = gradeLevelTotal !== undefined ? gradeLevelTotal : Number(row[9]) || 0;

            const csStats = csRows.reduce((acc: any, csRow: any) => {
                const rowSchNCES = String(csRow[3]).trim();
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

                if (!matches || rowSchNCES !== ncesID) return acc;

                if (selectedLevel !== 'Advanced') {
                    const raw = csRow[9];
                    if (raw != null && isNaN(Number(raw))) acc.suppressed = true;
                    else acc.total += Number(raw) || 0;
                    acc.girls += Number(csRow[10]) || 0;
                    acc.boys += Number(csRow[11]) || 0;
                }
                if (selectedLevel !== 'Basic') {
                    const raw = csRow[15];
                    if (raw != null && isNaN(Number(raw))) acc.suppressed = true;
                    else acc.total += Number(raw) || 0;
                    acc.girls += Number(csRow[16]) || 0;
                    acc.boys += Number(csRow[17]) || 0;
                }
                return acc;
            }, { total: 0, girls: 0, boys: 0, suppressed: false });
            // Suppressed only matters when it's the reason the total came out 0 -
            // a masked cell next to real, countable enrollment doesn't make the total unknown.
            const suppressed = csStats.suppressed && csStats.total === 0;

            return {
                name,
                ncesID,
                total: totalStudents,
                csEnrollment: csStats.total,
                csGirls: csStats.girls,
                csBoys: csStats.boys,
                suppressed,
                pct: totalStudents > 0 ? csStats.total / totalStudents : 0
            };
        });

    const sortedSchools = [...filteredSchools].sort((a, b) => {
        let aV: any = a.name; let bV: any = b.name;
        if (sortAttr === 'total') { aV = a.total; bV = b.total; }
        else if (sortAttr === 'enroll') { aV = a.csEnrollment; bV = b.csEnrollment; }
        return sortUp ? (aV > bV ? 1 : -1) : (aV < bV ? 1 : -1);
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
                            headerName={`School Name (${sortedSchools.length})`} 
                            isSorting={sortAttr === 'name'} 
                            isSortUp={sortUp} 
                            onClick={() => {setSortAttr('name'); setSortUp(!sortUp)}} 
                        />
                        <SortableHeader 
                            headerName="Total Students" 
                            isSorting={sortAttr === 'total'} 
                            isSortUp={sortUp} 
                            onClick={() => {setSortAttr('total'); setSortUp(!sortUp)}} 
                        />
                        <SortableHeader 
                            headerName={selectedCat === 'CS Total' ? 'Total CS' : selectedCat} 
                            isSorting={sortAttr === 'enroll'} 
                            isSortUp={sortUp} 
                            onClick={() => {setSortAttr('enroll'); setSortUp(!sortUp)}} 
                            additionalStyle={{ color: categoryColor }}
                        />
                        <TextCell style={{ fontWeight: 'bold', backgroundColor: '#f9f9f9', color: categoryColor }}>
                            CS Gender
                        </TextCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {sortedSchools.map((s) => (
                        <TableRow key={s.ncesID} hover>
                            <TextCell>{s.name}</TextCell>
                            
                            <TextCell style={{ color: '#666' }}>
                                {s.total === 0 ? 'n<10' : s.total.toLocaleString()}
                            </TextCell>

                            <TextCell style={{ fontWeight: 'bold', color: categoryColor }}>
                                <DataValue val={s.csEnrollment} pct={s.pct} showPercentage={store.showPercentage} suppressed={s.suppressed} />
                            </TextCell>

                            <TextCell style={{ fontSize: '0.8rem', color: '#555', lineHeight: '1.4' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    {/* A confirmed (non-suppressed) 0 overall means both genders are really 0 too - no ambiguity to hide behind "n<10". */}
                                    <span><span style={{ fontWeight: 'bold' }}>Male:</span> <span style={{ color: '#555' }}>{!s.suppressed && s.csEnrollment === 0 ? 0 : (s.csBoys === 0 ? 'n<10' : s.csBoys)}</span></span>
                                    <span><span style={{ fontWeight: 'bold' }}>Female:</span> <span style={{ color: '#555' }}>{!s.suppressed && s.csEnrollment === 0 ? 0 : (s.csGirls === 0 ? 'n<10' : s.csGirls)}</span></span>
                                </div>
                            </TextCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </StickyTableContainer>
    );
});

export default SchoolTable;