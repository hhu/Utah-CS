import { Table, TableHead, TableRow, TableBody, Checkbox } from "@mui/material";
import { observer } from "mobx-react-lite";
import { FC, useContext, useState, useEffect, useMemo } from "react";
import Store from "../../Interface/Store2";
import { DataContext } from "../../App2";
import { StickyTableContainer, TextCell, FunctionCell, SortableHeader, DataValue } from "../CellComponents/TableComponents2";
import { normalizeGradeLevelName } from "../../Preset/Constants2";

const DistrictTable: FC<{ categoryColor: string }> = observer(({ categoryColor }) => {
    const store = useContext(Store);
    const { leaPopData, schoolPopData, schoolCSData, gradeLevelDistrictTotals } = useContext(DataContext);
    const year = store.schoolYearShowing;
    const selectedCat = store.courseCategory;
    const selectedLevel = store.courseLevel;

    const [sortAttr, setSortAttr] = useState<'name' | 'total' | 'enroll'>('name');
    const [sortUp, setSortUp] = useState(true);

    const selectedIDs = [...store.selectedDistricts];

    const districts = useMemo(() => {

        const popRows = leaPopData[year] || [];
        const schPopRows = schoolPopData[year] || [];
        const csRows = schoolCSData[year] || [];

        // For 2024-25, "LEA Pop. Data" only lists districts with at least one
        // CS-offering school, and for that year its Total/Girls/Boys columns
        // (indexes 4/12/13) hold unique CS-participant counts, not population
        // like every other year. A district missing from the sheet that year
        // has confirmed zero CS participation - it's not suppressed.
        const leaRowByName = new Map<string, any>();
        popRows
            .filter((row: any) => String(row[1] || '').toLowerCase().includes('district'))
            .forEach((row: any) => leaRowByName.set(String(row[1]).trim(), row));

        // Districts come from "School Pop. Data" instead of "LEA Pop. Data" so a
        // district with no CS (and so no "LEA Pop. Data" row in 2024-25) still
        // shows up as a real 0 rather than being left off the table.
        const districtIds = new Map<string, string>();
        schPopRows
            .filter((row: any) => String(row[6] || '').toLowerCase().includes('district'))
            .forEach((row: any) => districtIds.set(String(row[6]).trim(), String(row[8]).trim()));
        leaRowByName.forEach((row, name) => districtIds.set(name, String(row[3]).trim()));

        return Array.from(districtIds.entries()).map(([name, ncesDistID]) => {
            // Prefer USBE's grade-level file for a true 9-12-only count; fall back to
            // "School Pop. Data" (whatever grades each school serves) if that district
            // isn't in the grade-level file (wrong year, or a name that didn't match).
            const gradeLevelTotal = gradeLevelDistrictTotals[normalizeGradeLevelName(name)];
            const totalStudents = gradeLevelTotal !== undefined ? gradeLevelTotal : schPopRows.reduce((acc: number, schRow: any) => {
                const schDistNCES = String(schRow[8]).trim();
                if (schDistNCES === ncesDistID) {
                    return acc + (Number(schRow[9]) || 0);
                }
                return acc;
            }, 0);

            let csStats = { total: 0, girls: 0, boys: 0, suppressed: false };

            if (year === '2024-25' && selectedCat === 'CS Total' && selectedLevel === 'All') {
                const leaRow = leaRowByName.get(name);
                if (leaRow) {
                    const rawTotal = leaRow[4];
                    if (rawTotal != null && isNaN(Number(rawTotal))) {
                        csStats.suppressed = true;
                    } else {
                        csStats.total = Number(rawTotal) || 0;
                        csStats.girls = Number(leaRow[12]) || 0;
                        csStats.boys = Number(leaRow[13]) || 0;
                    }
                }
                // No leaRow at all means no CS courses this year, confirmed - leave at 0.
            } else {
                // No reliable district-level total exists for a single category or a
                // single level, so fall back to summing "School CS Data" rows - this
                // can still understate a district if some of its rows are masked.
                csStats = csRows.reduce((acc: any, csRow: any) => {
                    const rowDistNCES = String(csRow[6]).trim();
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

                    if (!matches || rowDistNCES !== ncesDistID) return acc;

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
                csStats.suppressed = csStats.suppressed && csStats.total === 0;
            }

            return {
                name,
                id: ncesDistID,
                total: totalStudents,
                csEnrollment: csStats.total,
                csGirls: csStats.girls,
                csBoys: csStats.boys,
                suppressed: csStats.suppressed,
                pct: totalStudents > 0 ? csStats.total / totalStudents : 0
            };
        });
    }, [leaPopData, schoolPopData, schoolCSData, gradeLevelDistrictTotals, year, selectedCat, selectedLevel]);

    useEffect(() => {
        if (districts.length > 0 && store.selectedDistricts.length === 0) {
            store.setSelectedDistricts(districts.map((d: any) => d.id));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [year]);

    const sorted = [...districts].sort((a, b) => {
        let aV: any = a.name; let bV: any = b.name;
        if (sortAttr === 'total') { aV = a.total; bV = b.total; }
        else if (sortAttr === 'enroll') { aV = a.csEnrollment; bV = b.csEnrollment; }
        return sortUp ? (aV > bV ? 1 : -1) : (aV < bV ? 1 : -1);
    });

    const handleSelectAll = () => {
        if (selectedIDs.length === districts.length) {
            store.setSelectedDistricts([]);
        } else {
            store.setSelectedDistricts(districts.map((d: any) => d.id));
        }
    };

    return (
        <StickyTableContainer>
            <Table stickyHeader size="small">
                <TableHead>
                    <TableRow>
                        <FunctionCell>
                            <Checkbox 
                                size="small"
                                color="primary"
                                indeterminate={selectedIDs.length > 0 && selectedIDs.length < districts.length}
                                checked={districts.length > 0 && selectedIDs.length === districts.length}
                                onChange={handleSelectAll}
                            />
                        </FunctionCell>
                        <SortableHeader 
                            headerName="District Name" 
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
                    {sorted.map(d => (
                        <TableRow key={d.id} hover>
                            <FunctionCell>
                                <Checkbox 
                                    size="small"
                                    color="primary"
                                    checked={selectedIDs.includes(d.id)} 
                                    onChange={() => store.updateSelectedDistrict(d.id)}
                                />
                            </FunctionCell>
                            <TextCell style={{ fontWeight: 500 }}>{d.name}</TextCell>
                            
                            <TextCell style={{ color: '#666' }}>
                                {d.total === 0 ? 'n<10' : d.total.toLocaleString()}
                            </TextCell>

                            <TextCell style={{ color: categoryColor, fontWeight: 'bold' }}>
                                <DataValue val={d.csEnrollment} pct={d.pct} showPercentage={store.showPercentage} suppressed={d.suppressed} />
                            </TextCell>
                            
                            <TextCell style={{ fontSize: '0.8rem', color: '#555', lineHeight: '1.4' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    {/* A confirmed (non-suppressed) 0 overall means both genders are really 0 too - no ambiguity to hide behind "n<10". */}
                                    <span><span style={{ fontWeight: 'bold' }}>Male:</span> <span style={{ color: '#555' }}>{!d.suppressed && d.csEnrollment === 0 ? 0 : (d.csBoys === 0 ? 'n<10' : d.csBoys)}</span></span>
                                    <span><span style={{ fontWeight: 'bold' }}>Female:</span> <span style={{ color: '#555' }}>{!d.suppressed && d.csEnrollment === 0 ? 0 : (d.csGirls === 0 ? 'n<10' : d.csGirls)}</span></span>
                                </div>
                            </TextCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </StickyTableContainer>
    );
});

export default DistrictTable;