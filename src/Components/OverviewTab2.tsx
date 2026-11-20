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
import { linkToGeoJson } from "../Preset/Constants2";

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
        
        {subText !== null && <div style={{ fontSize: '2.8rem', fontWeight: 800 }}>{subText}</div>}
        <div style={{ fontSize: '0.95rem', color: '#444', marginBottom: '12px', lineHeight: 1.4 }}>{mainText}</div>

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
        courseData
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

        if (store.courseCategory === 'CS Total') return all.length;
        if (store.courseCategory === 'CS Foundational') {
            return all.filter((c: any) => c[1] === 'CS').length;
        }
        return all.filter((c: any) => c[2] === store.courseCategory).length;
    }, [courseData, store.courseCategory]);

    // Per-district totals and CS percentage for the map, same join logic as DistrictTable2.
    const districtStats = useMemo(() => {
        const popRows = leaPopData[year] || [];
        const schPopRows = schoolPopData[year] || [];
        const csRows = schoolCSData[year] || [];
        const selectedCat = store.courseCategory;
        const selectedLevel = store.courseLevel;

        const stats = new Map<string, { total: number; csEnrollment: number; pct: number }>();

        popRows
            .filter((row: any) => String(row[1] || '').toLowerCase().includes('district'))
            .forEach((row: any) => {
                const name = String(row[1]).trim();
                const ncesDistID = String(row[3]).trim();

                const total = schPopRows.reduce((acc: number, schRow: any) => {
                    const schDistNCES = String(schRow[8]).trim();
                    return schDistNCES === ncesDistID ? acc + (Number(schRow[9]) || 0) : acc;
                }, 0);

                const csEnrollment = csRows.reduce((acc: number, csRow: any) => {
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
                    if (selectedLevel !== 'Advanced') val += Number(csRow[9]) || 0;
                    if (selectedLevel !== 'Basic') val += Number(csRow[15]) || 0;
                    return acc + val;
                }, 0);

                stats.set(name, { total, csEnrollment, pct: total > 0 ? csEnrollment / total : 0 });
            });

        return stats;
    }, [leaPopData, schoolPopData, schoolCSData, year, store.courseCategory, store.courseLevel]);

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
                    return interpolateBlues(((stat?.pct ?? 0) / highestDistrictPercent) || 0);
                })
                .attr('stroke-width', 1)
                .attr('stroke', '#222')
                .on('mouseover', (e, d: any) => {
                    const stat = districtStats.get(d.properties.NAME);
                    const [x, y] = pointer(e, svgNode.parentNode);
                    tooltip
                        .html(`${d.properties.NAME}, ${!stat || stat.total === 0 ? 'n<10' : format(',.0%')(stat.pct)}`)
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
        let body = `This view displays data specifically for ${cat} courses.`;
        if (cat === "CS Total") body = "CS Total includes all Foundational and CS-Related courses.";
        else if (cat === "CS Foundational") body = "CS Foundational courses directly teach fundamental computer science skills, excluding CS-Related courses.";

        return (
            <>
                <div style={{ color: categoryColor, fontWeight: 'bold', fontSize: '1.3rem', marginBottom: '8px' }}>{cat}</div>
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
                                mainText={<span>{store.getCourseCategoryAndLevelString()} Courses</span>}
                                subText={<span style={{ color: categoryColor }}>{uniqueCourseCount}</span>}
                            />
                        </OverviewGridItem>

                        <OverviewGridItem xs={6}>
                            <OverviewCard
                                mainText={<span>Schools <b>Offering</b> {store.getCourseCategoryAndLevelString()} Courses</span>}
                                subText={<span style={{ color: categoryColor }}>{schoolsOfferingCount}</span>}
                            />
                        </OverviewGridItem>

                        <OverviewGridItem xs={6}>
                            <OverviewCard
                                mainText={<span>Students <b>Participating</b> in {store.getCourseCategoryAndLevelString()} Courses</span>}
                                subText={
                                    <span style={{ color: categoryColor, fontSize: store.showPercentage ? '3.2rem' : '2.8rem' }}>
                                        {store.showPercentage
                                            ? format(".1%")(totalStudentsCount > 0 ? participatingCount / totalStudentsCount : 0)
                                            : format(",")(participatingCount)}
                                    </span>
                                }
                            />
                        </OverviewGridItem>
                    </Grid>
                </Grid>

                <Grid xs={12} md={6} sx={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '10px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ textAlign: 'center', color: categoryColor, fontWeight: 'bold', marginBottom: '15px', fontSize: '1.15rem' }}>
                            Percentage of Students in {store.getCourseCategoryAndLevelString()} by District for {year}
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