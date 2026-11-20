import Grid from '@mui/material/Unstable_Grid2';
import { observer } from "mobx-react-lite";
import { FC, useContext, useMemo, useRef, useEffect, ReactNode } from "react";
import { DataContext } from "../App2";
import Store from "../Interface/Store2";
import styled from "@emotion/styled";
import { format } from "d3-format";
import { interpolateBlues } from "d3-scale-chromatic";
import { select, pointer } from "d3-selection";
import { geoMercator, geoPath } from "d3-geo";
import { json } from "d3-fetch";
import { linkToGeoJson, normalizeGradeLevelName, CourseCategoryDictionary, CourseCategoryDescriptionDictionary, CourseCategoryShortDictionary } from "../Preset/Constants2";
import 'bootstrap-icons/font/bootstrap-icons.css';

const OverviewGridItem = styled(Grid)({
    padding: '10px',
    display: 'flex',
    flexDirection: 'column'
});

//cards for the overview tab, used to show the total number of schools, students, and courses in the state as well as a description of the tab.
const OverviewCard: FC<{ mainText: ReactNode, subText: ReactNode }> = ({ mainText, subText }) => (
    <div style={{
        backgroundColor: 'white', border: '1px solid #ddd', padding: '22px',
        height: '100%', boxSizing: 'border-box', borderRadius: '4px',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center'
    }}>
        
        {subText !== null && <div style={{ fontSize: '3.75rem', fontWeight: 300 }}>{subText}</div>}
        <div style={{ fontSize: '1rem', fontWeight: 400, color: '#444', marginBottom: '12px', lineHeight: 1.4 }}>{mainText}</div>

    </div>
);

interface Props {
    categoryColor: string;
}

// Download the (7 MB) district boundaries file once and share it between redraws.
// Like a static cached field in Java: every caller gets the same Promise.
let geoJsonPromise: Promise<any> | null = null;
const loadGeoJson = () => {
    if (!geoJsonPromise) {
        geoJsonPromise = json(linkToGeoJson).catch(err => {
            geoJsonPromise = null; // allow a retry on the next draw
            throw err;
        });
    }
    return geoJsonPromise;
};

const OverviewTab: FC<Props> = ({ categoryColor }) => {
    const store = useContext(Store);
    const {
        statePopData,
        stateCSData,
        schoolCSData,
        schoolPopData,
        leaPopData,
        courseData,
        gradeLevelDistrictTotals
    } = useContext(DataContext);

    const mapRef = useRef(null);
    const tooltipRef = useRef(null);

    const year = store.schoolYearShowing;

    const totalStudentsCount = useMemo(() => {
        const rows = statePopData[year] || [];
        return rows.reduce((acc: number, row: any) => acc + (Number(row[2]) || 0), 0);
    }, [statePopData, year]);

    const participatingCount = useMemo(() => {
        const rows = stateCSData[year] || [];
        const selectedCat = store.courseCategory; 
    
        return rows.reduce((acc: number, row: any) => {
            const rowCat = String(row[2] || '').trim();
    
            let include = false;
            if (selectedCat === 'CS Total') {
                include = true;
            } else if (selectedCat === 'CS Foundational') {
                include = (rowCat !== 'CS-Related');
            } else {
                include = (rowCat === selectedCat);
            }
    
            if (!include) return acc;
    
            let val = 0;
            if (store.courseLevel === 'Basic' || store.courseLevel === 'All') {
                val += Number(row[4]) || 0;
            }
            if (store.courseLevel === 'Advanced' || store.courseLevel === 'All') {
                val += Number(row[16]) || 0;
            }
            return acc + val;
        }, 0);
    }, [stateCSData, year, store.courseCategory, store.courseLevel]);

    const schoolsOfferingCount = useMemo(() => {
        const rows = schoolCSData[year] || [];
        const uniqueOfferingSchools = new Set<string>();

        rows.forEach((row: any) => {
            const schoolName = String(row[1] || '').trim();
            const rowCat = String(row[7] || '').trim();

            let include = false;
            if (store.courseCategory === 'CS Total') {
                include = true;
            } else if (store.courseCategory === 'CS Foundational') {
                include = (rowCat !== 'CS-Related');
            } else if (store.courseCategory === 'Web/Software Development') {
                include = (rowCat === 'WebSoftDev');
            } else {
                include = (rowCat.toLowerCase() === store.courseCategory.toLowerCase());
            }

            if (!include) return;

            let enrollment = 0;
            if (store.courseLevel === 'Basic' || store.courseLevel === 'All') enrollment += Number(row[8]) || 0;
            if (store.courseLevel === 'Advanced' || store.courseLevel === 'All') enrollment += Number(row[14]) || 0;

            if (enrollment > 0) {
                uniqueOfferingSchools.add(schoolName);
            }
        });

        return uniqueOfferingSchools.size;
    }, [schoolCSData, year, store.courseCategory, store.courseLevel]);

    const uniqueCourseCount = useMemo(() => {
        if (!courseData?.byCode) return 0;
        const all = Object.values(courseData.byCode);
        const matchesLevel = (c: any) => store.courseLevel === 'All' || c[3] === store.courseLevel;

        if (store.courseCategory === 'CS Total') return all.filter(matchesLevel).length;
        if (store.courseCategory === 'CS Foundational') {
            return all.filter((c: any) => c[1] === 'CS' && matchesLevel(c)).length;
        }
        return all.filter((c: any) => c[2] === store.courseCategory && matchesLevel(c)).length;
    }, [courseData, store.courseCategory, store.courseLevel]);

    // Per-district totals and CS percentage for the map, same join logic as DistrictTable2.
    const districtStats = useMemo(() => {
        const popRows = leaPopData[year] || [];
        const schPopRows = schoolPopData[year] || [];
        const csRows = schoolCSData[year] || [];
        const selectedCat = store.courseCategory;
        const selectedLevel = store.courseLevel;

        // For 2024-25, "LEA Pop. Data" only lists districts with at least one
        // CS-offering school, and for that year its "Total" column (index 4) holds
        // the district's unique CS-participant count, not population like every
        // other year. A district missing from the sheet that year has confirmed
        // zero CS participation - it's not suppressed, so it isn't included here.
        const leaRowByName = new Map<string, any>();
        popRows
            .filter((row: any) => String(row[1] || '').toLowerCase().includes('district'))
            .forEach((row: any) => leaRowByName.set(String(row[1]).trim(), row));

        // Districts come from "School Pop. Data" instead of "LEA Pop. Data" so a
        // district with no CS (and so no "LEA Pop. Data" row in 2024-25) still
        // shows up, correctly, as a real 0% rather than being left off the map.
        const districtIds = new Map<string, string>();
        schPopRows
            .filter((row: any) => String(row[6] || '').toLowerCase().includes('district'))
            .forEach((row: any) => districtIds.set(String(row[6]).trim(), String(row[8]).trim()));
        leaRowByName.forEach((row, name) => districtIds.set(name, String(row[3]).trim()));

        const stats = new Map<string, { total: number; csEnrollment: number; pct: number; suppressed: boolean }>();

        districtIds.forEach((ncesDistID, name) => {
            // Prefer USBE's grade-level file for a true 9-12-only count; fall back to
            // "School Pop. Data" (whatever grades each school serves) if that district
            // isn't in the grade-level file (wrong year, or a name that didn't match).
            const gradeLevelTotal = gradeLevelDistrictTotals[normalizeGradeLevelName(name)];
            const total = gradeLevelTotal !== undefined ? gradeLevelTotal : schPopRows.reduce((acc: number, schRow: any) => {
                const schDistNCES = String(schRow[8]).trim();
                return schDistNCES === ncesDistID ? acc + (Number(schRow[9]) || 0) : acc;
            }, 0);

            let csEnrollment = 0;
            let suppressed = false;

            if (year === '2024-25' && selectedCat === 'CS Total' && selectedLevel === 'All') {
                const leaRow = leaRowByName.get(name);
                if (!leaRow) {
                    csEnrollment = 0; // no CS courses this year, confirmed
                } else {
                    const raw = leaRow[4];
                    if (raw != null && isNaN(Number(raw))) suppressed = true;
                    else csEnrollment = Number(raw) || 0;
                }
            } else {
                // No reliable district-level total exists for a single category or a
                // single level, so fall back to summing "School CS Data" rows - this
                // can still understate a district if some of its rows are masked.
                let hasMaskedCell = false;
                csEnrollment = csRows.reduce((acc: number, csRow: any) => {
                    const rowDistNCES = String(csRow[6]).trim();
                    const rowCat = String(csRow[7] || '').trim();

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

                    let val = 0;
                    if (selectedLevel !== 'Advanced') {
                        const raw = csRow[9];
                        if (raw != null && isNaN(Number(raw))) hasMaskedCell = true;
                        else val += Number(raw) || 0;
                    }
                    if (selectedLevel !== 'Basic') {
                        const raw = csRow[15];
                        if (raw != null && isNaN(Number(raw))) hasMaskedCell = true;
                        else val += Number(raw) || 0;
                    }
                    return acc + val;
                }, 0);
                suppressed = csEnrollment === 0 && hasMaskedCell;
            }

            stats.set(name, { total, csEnrollment, pct: total > 0 ? csEnrollment / total : 0, suppressed });
        });

        return stats;
    }, [leaPopData, schoolPopData, schoolCSData, gradeLevelDistrictTotals, year, store.courseCategory, store.courseLevel]);

    useEffect(() => {
        if (!mapRef.current || !tooltipRef.current) return;

        const svgSelection = select(mapRef.current);
        const svgNode: any = svgSelection.node();
        const container = svgNode.parentNode;

        // Set by the cleanup below when districtStats changes (or the tab unmounts).
        // An older drawMap that is still waiting on the GeoJSON must not paint over
        // a newer one: it holds stale, possibly empty, districtStats.
        let cancelled = false;

        async function drawMap(svgWidth: number, svgHeight: number) {
            const file = await loadGeoJson();
            if (cancelled) return;

            svgSelection
                .attr('width', svgWidth)
                .attr('height', svgHeight)
                .attr('viewBox', `0 0 ${svgWidth} ${svgHeight}`);

            const tooltip = select(tooltipRef.current);

            const projection = geoMercator()
                .fitExtent([[0, 0], [svgWidth, svgHeight]], (file as any));

            const highestDistrictPercent = Array.from(districtStats.values())
                .reduce((max, d) => Math.max(max, d.pct), 0);

            const path = geoPath().projection(projection);

            svgSelection.select('#map').selectAll('path').data((file as any).features)
                .join('path')
                .attr('d', path as any)
                .attr('fill', (d: any) => {
                    const stat = districtStats.get(d.properties.NAME);
                    // !stat means this map shape's name didn't join to any district row at
                    // all (a real data problem, e.g. a GeoJSON/spreadsheet name mismatch) -
                    // grey it the same as a masked, suppressed count.
                    if (!stat || stat.suppressed) return '#bbb';
                    return interpolateBlues((stat.pct / highestDistrictPercent) || 0);
                })
                .attr('stroke-width', 1)
                .attr('stroke', '#222')
                .on('mouseover', (e, d: any) => {
                    const stat = districtStats.get(d.properties.NAME);
                    const [x, y] = pointer(e, svgNode.parentNode);
                    const label = !stat || stat.suppressed ? 'n<10' : format(',.0%')(stat.pct);
                    tooltip
                        .html(`${d.properties.NAME}, ${label}`)
                        .style('display', 'block')
                        .style('left', `${x + 10}px`)
                        .style('top', `${y + 10}px`);
                })
                .on('mousemove', (e) => {
                    const [x, y] = pointer(e, svgNode.parentNode);
                    tooltip.style('left', `${x + 10}px`).style('top', `${y + 10}px`);
                })
                .on('mouseout', () => {
                    tooltip.style('display', 'none');
                });

            svgSelection.select('#legend').select('rect')
                .attr('x', '75%')
                .attr('y', 0)
                .attr('width', 80)
                .attr('height', 30)
                .attr('fill', 'url(#legend-gradient)');

            svgSelection.select('#legend')
                .selectAll('text')
                .data([0, highestDistrictPercent])
                .join('text')
                .attr('x', (_, i) => 0.75 * svgWidth + i * 80)
                .attr('y', 40)
                .text(d => format(',.0%')(d))
                .attr('alignment-baseline', 'hanging')
                .attr('font-size', 'smaller')
                .attr('text-anchor', d => d ? 'end' : 'start');
        }

        // ResizeObserver fires once with the container's current size as soon as it's
        // observed, and again any time that size changes (e.g. once layout settles after
        // mount, or the browser window resizes) - so we don't have to guess when it's ready.
        const resizeObserver = new ResizeObserver((entries) => {
            const { width, height } = entries[0].contentRect;
            if (width > 0 && height > 0) {
                drawMap(width, height);
            }
        });
        resizeObserver.observe(container);

        return () => {
            cancelled = true;
            resizeObserver.disconnect();
        };
    }, [districtStats]);

    const renderDescription = (): JSX.Element => {
        const cat = store.courseCategory;
        const categoryLabel = CourseCategoryDictionary[cat] ?? cat;
        const levelLabel = store.courseLevel === 'All' ? 'All Levels' : store.courseLevel;
        const label = `${categoryLabel} (${levelLabel})`;
        const body = CourseCategoryDescriptionDictionary[cat] ?? `This view displays data specifically for ${categoryLabel} courses.`;

        return (
            <>
                <div style={{ color: categoryColor, fontWeight: 'bold', fontSize: '1.3rem', marginBottom: '8px' }}>{label}</div>
                <div style={{ fontSize: '1.05rem' }}>{body}</div>
            </>
        );
    };

    return (
        <div style={{ padding: '20px' }}>
            <Grid container spacing={0} alignItems="stretch">
                <Grid xs={12} md={6}>
                    <Grid container>
                        <OverviewGridItem xs={12}>
                            <OverviewCard mainText={renderDescription()} subText={null} />
                        </OverviewGridItem>

                        <OverviewGridItem xs={6}>
                            <OverviewCard
                                mainText={<span>Public Schools With 9-12 Graders</span>}
                                subText={<span style={{ color: categoryColor }}>{(schoolPopData[year] || []).length}</span>}
                            />
                        </OverviewGridItem>

                        <OverviewGridItem xs={6}>
                            <OverviewCard
                                mainText={<span>{CourseCategoryShortDictionary[store.courseCategory] ?? store.courseCategory} {uniqueCourseCount === 1 ? 'Course' : 'Courses'}{(store.courseLevel === 'Basic' || store.courseLevel === 'Advanced') ? ` (${store.courseLevel} only)` : ''}</span>}
                                subText={<span style={{ color: categoryColor }}>{uniqueCourseCount}</span>}
                            />
                        </OverviewGridItem>

                        <OverviewGridItem xs={6}>
                            <OverviewCard
                                mainText={
                                    <span>
                                        Schools <b>Offering</b> {CourseCategoryShortDictionary[store.courseCategory] ?? store.courseCategory} {uniqueCourseCount === 1 ? 'Course' : 'Courses'}{(store.courseLevel === 'Basic' || store.courseLevel === 'Advanced') ? ` (${store.courseLevel} only)` : ''}
                                        <br /><span style={{ display: 'flex', justifyContent: 'end' }}>
                                            <button onClick={() => store.updateShowPercentage()} className="bi bi-toggles" style={{ color: categoryColor, fontSize: 'larger', border: 'none', backgroundColor: 'white' }}></button>
                                        </span>
                                    </span>
                                }
                                subText={
                                    <span style={{ color: categoryColor }}>
                                        <span onClick={() => store.updateShowPercentage()} style={{ cursor: 'pointer' }}>
                                            {store.showPercentage
                                                ? format(".1%")((schoolPopData[year] || []).length > 0 ? schoolsOfferingCount / (schoolPopData[year] || []).length : 0)
                                                : format(",")(schoolsOfferingCount)}
                                        </span>
                                    </span>
                                }
                            />
                        </OverviewGridItem>

                        <OverviewGridItem xs={6}>
                            <OverviewCard
                                mainText={
                                    <span>
                                        Students <b>Participating</b> in {CourseCategoryShortDictionary[store.courseCategory] ?? store.courseCategory} {uniqueCourseCount === 1 ? 'Course' : 'Courses'}{(store.courseLevel === 'Basic' || store.courseLevel === 'Advanced') ? ` (${store.courseLevel} only)` : ''}
                                        <br /><span style={{ display: 'flex', justifyContent: 'end' }}>
                                            <button onClick={() => store.updateShowPercentage()} className="bi bi-toggles" style={{ color: categoryColor, fontSize: 'larger', border: 'none', backgroundColor: 'white' }}></button>
                                        </span>
                                    </span>
                                }
                                subText={
                                    <span style={{ color: categoryColor, fontSize: store.showPercentage ? '3.2rem' : '2.8rem' }}>
                                        <span onClick={() => store.updateShowPercentage()} style={{ cursor: 'pointer' }}>
                                            {store.showPercentage
                                                ? format(".1%")(totalStudentsCount > 0 ? participatingCount / totalStudentsCount : 0)
                                                : format(",")(participatingCount)}
                                        </span>
                                    </span>
                                }
                            />
                        </OverviewGridItem>
                    </Grid>
                </Grid>

                <Grid xs={12} md={6} sx={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '10px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ textAlign: 'center', color: categoryColor, fontWeight: 'bold', marginBottom: '15px', fontSize: '1.15rem' }}>
                            Percentage of Students in {CourseCategoryShortDictionary[store.courseCategory] ?? store.courseCategory} {uniqueCourseCount === 1 ? 'Course' : 'Courses'}{(store.courseLevel === 'Basic' || store.courseLevel === 'Advanced') ? ` (${store.courseLevel} Only)` : ''} by District for {year}
                        </div>
                        <div style={{
                            flex: 1,
                            backgroundColor: 'white',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            position: 'relative'
                        }}>
                            <svg ref={mapRef} style={{ width: '100%', height: '100%' }}>
                                <linearGradient id="legend-gradient" x1="0" x2="1" y1="0" y2="0" colorInterpolation="CIE-LCHab">
                                    <stop offset="0%" stopColor={interpolateBlues(0)} />
                                    <stop offset="50%" stopColor={interpolateBlues(0.5)} />
                                    <stop offset="100%" stopColor={interpolateBlues(1)} />
                                </linearGradient>
                                <g id="map" />
                                <g id="legend">
                                    <rect />
                                </g>
                            </svg>
                            <div
                                id="overview-map-tooltip"
                                ref={tooltipRef}
                                style={{
                                    position: 'absolute',
                                    background: '#f4f1d6',
                                    borderRadius: '8px',
                                    pointerEvents: 'none',
                                    padding: '5px',
                                    textAlign: 'center',
                                    display: 'none'
                                }} />
                        </div>
                    </div>
                </Grid>
            </Grid>
        </div>
    );
};

export default observer(OverviewTab);