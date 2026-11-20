import { ChangeEvent, createContext, useContext, useEffect, useMemo, useState } from "react";
import { ColorPalette, linkToData, linkToGradeLevelData, normalizeGradeLevelName, PossibleSchoolYears } from "./Preset/Constants2";
import readXlsxFile from "read-excel-file";
import { observer } from 'mobx-react-lite';
import Store from './Interface/Store2';
import { Box, Typography } from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2';
import styled from '@emotion/styled';
import StateTable from "./Components/StateTable2";
import SettingBar from "./Components/SettingBar2";
import DataLoadingModal from './Components/DataLoadingModal';
import TabsComponent from "./Components/TabsComponent/Tabs2";
import OverviewTab from "./Components/OverviewTab2";
import SchoolTable from "./Components/SchoolComponent/SchoolTable2";
import SchoolClassTable from "./Components/SchoolComponent/SchoolClassTable";
import DistrictTable from "./Components/DistrictComponent/DistrictTable2";
import DistrictClassTable from "./Components/DistrictComponent/DistrictClassTable";
import Footer from "./Components/Footer";
import CourseCatalogTab from "./Components/CourseCatalogComponent/CourseCatalogTab2";

export const SectionTitle = styled(Typography)({
    color: '#2f1600',
    fontWeight: 600,
    marginLeft: '15px',
    marginTop: '20px',
    marginBottom: '20px',
});

type CourseDetails = [string, string, string, string]; // [Name, Type, Category, Level]

interface CourseDataStore {
    byCode: Record<string, CourseDetails>;      // Main Dictionary: "350..." -> ["Name", "Type", "Cat", "Lvl"]
    byType: Record<string, string[]>;           // Reverse: "CS" -> ["350...", "360..."]
    byCategory: Record<string, string[]>;       // Reverse: "Core CS" -> ["350...", "380..."]
    byLevel: Record<string, string[]>;          // Reverse: "Basic" -> ["350...", "390..."]
}

type StatePopStore = Record<string, any[]>;
type StateCSStore = Record<string, any[]>;
type TotalStateCSStore = Record<string, any[]>;
type SchoolPopStore = Record<string, any[]>;
type SchoolCSStore = Record<string, any[]>;
type TotalSchoolCSStore = Record<string, any[]>;
type LeaPopStore = Record<string, any[]>;
type TotalLeaCSStore = Record<string, any[]>;
// USBE's grade-level enrollment file is one file per year (not a tab per year like
// the main workbook), so this is just name -> 9-12 enrollment, for whichever single
// year that file covers today.
type GradeLevelTotals = Record<string, number>;

interface DataContextType {
    courseData: CourseDataStore | null;
    statePopData: StatePopStore;
    stateCSData: StateCSStore;
    totalStateCSData: TotalStateCSStore;
    schoolPopData: SchoolPopStore;
    schoolCSData: SchoolCSStore;
    totalSchoolCSData: TotalSchoolCSStore;
    leaPopData: LeaPopStore;
    totalLeaCSData: TotalLeaCSStore;
    gradeLevelDistrictTotals: GradeLevelTotals;
    gradeLevelSchoolTotals: GradeLevelTotals;
}

export const DataContext = createContext<DataContextType>({
    courseData: null,
    statePopData: {},
    stateCSData: {},
    totalStateCSData: {},
    schoolPopData: {},
    schoolCSData: {},
    totalSchoolCSData: {},
    leaPopData: {},
    totalLeaCSData: {},
    gradeLevelDistrictTotals: {},
    gradeLevelSchoolTotals: {}
});

export const App = () => {

    const store = useContext(Store);
    // console.log(store)

    const [courseData, setCourseData] = useState<CourseDataStore | null>(null);
// Where colors are rendered and defined under constant2.tsx 
    const categoryColor = useMemo(() => {
        if (store.courseCategory === "CS Total") return ColorPalette[0];
        if (store.courseCategory === "CS Foundational") return ColorPalette[9];

        if (!courseData?.byCategory) return '#003789';
        const categories = Object.keys(courseData.byCategory).sort();
        const index = categories.indexOf(store.courseCategory);

        return index >= 0
            ? ColorPalette[(index + 2) % ColorPalette.length]
            : '#003789';
    }, [courseData, store.courseCategory]);

    const initStore = () => {
        const initial: Record<string, any[]> = {};
        PossibleSchoolYears.forEach(year => initial[year] = []);
        return initial;
    };

    const [schoolPopData, setSchoolPopData] = useState<SchoolPopStore>(initStore);
    const [schoolCSData, setSchoolCSData] = useState<SchoolCSStore>(initStore);
    const [totalSchoolCSData, setTotalSchoolCSData] = useState<TotalSchoolCSStore>(initStore);
    const [statePopData, setStatePopData] = useState<StatePopStore>(initStore);
    const [stateCSData, setStateCSData] = useState<StateCSStore>(initStore);
    const [totalStateCSData, setTotalStateCSData] = useState<TotalStateCSStore>(initStore);
    const [leaPopData, setLeaPopData] = useState<LeaPopStore>(initStore());
    const [totalLeaCSData, setTotalLeaCSData] = useState<TotalLeaCSStore>(initStore());
    const [gradeLevelDistrictTotals, setGradeLevelDistrictTotals] = useState<GradeLevelTotals>({});
    const [gradeLevelSchoolTotals, setGradeLevelSchoolTotals] = useState<GradeLevelTotals>({});

    // Loading progress, shown in the DataLoadingModal popup.
    const [sheetsLoaded, setSheetsLoaded] = useState(0);
    const [failedSheets, setFailedSheets] = useState<string[]>([]);

    useEffect(() => {
        // Set by the cleanup below if this component unmounts mid-load,
        // so we never call setState on a component that is gone.
        let cancelled = false;

        // Groups the rows of a sheet by school year, skipping the header row.
        // yearColumn: which column holds the year. headerText: that column's heading.
        const groupByYear = (rows: any[], yearColumn = 0, headerText = 'School Year') => {
            const dataByYear = initStore();
            rows.forEach((row) => {
                const year = String(row[yearColumn]);
                if (year === headerText) return;
                if (dataByYear[year]) dataByYear[year].push(row);
            });
            return dataByYear;
        };

        const buildCourseStore = (rows: any[]): CourseDataStore => {
            const courses: CourseDataStore = {
                byCode: {},
                byType: {},
                byCategory: {},
                byLevel: {}
            };

            const addToGroup = (dict: Record<string, string[]>, key: string, code: string) => {
                const safeKey = key ? key.trim() : 'Unknown';
                if (!dict[safeKey]) dict[safeKey] = [];
                dict[safeKey].push(code);
            };

            rows.forEach((row) => {
                const rawCode = row[5];

                if (!rawCode || String(rawCode).trim() === 'Course Code') return;

                const code = String(rawCode).trim();
                const name = String(row[1] || '').trim();
                const type = String(row[2] || '').trim();
                const category = String(row[3] || '').trim();
                const level = String(row[4] || '').trim();

                courses.byCode[code] = [name, type, category, level];

                addToGroup(courses.byType, type, code);
                addToGroup(courses.byCategory, category, code);
                addToGroup(courses.byLevel, level, code);
            });

            return courses;
        };

        // One entry per sheet: [sheet name in the Excel file, what to do with its rows].
        // Like a list of (String, Consumer<List<Row>>) pairs in Java.
        const sheets: [string, (rows: any[]) => void][] = [
            ['Course List', rows => setCourseData(buildCourseStore(rows))],
            ['State Pop. Data', rows => setStatePopData(groupByYear(rows))],
            ['State CS Data', rows => setStateCSData(groupByYear(rows))],
            ['School Pop. Data', rows => setSchoolPopData(groupByYear(rows))],
            ['School CS Data', rows => setSchoolCSData(groupByYear(rows))],
            ['LEA Pop. Data', rows => setLeaPopData(groupByYear(rows))],
            ['Total State CS Data', rows => setTotalStateCSData(groupByYear(rows))],
            ['Total School CS Data', rows => setTotalSchoolCSData(groupByYear(rows))],
            ['Total LEA CS Data', rows => setTotalLeaCSData(groupByYear(rows, 1, 'Year'))],
        ];

        // Sums the four 9-12 grade columns starting at grade9Index, keyed by the
        // district/school name at nameIndex - a true 9-12-only enrollment count,
        // unlike "School Pop. Data"'s Total column (whatever grades that school serves).
        const buildGradeLevelTotals = (rows: any[], nameIndex: number, grade9Index: number): GradeLevelTotals => {
            const totals: GradeLevelTotals = {};
            rows.forEach((row) => {
                const name = String(row[nameIndex] || '').trim();
                if (!name || name === 'LEA Name' || name === 'School Name') return;
                totals[normalizeGradeLevelName(name)] = [0, 1, 2, 3].reduce((sum, i) => sum + (Number(row[grade9Index + i]) || 0), 0);
            });
            return totals;
        };

        // A separate file from USBE, with its own two sheets.
        const gradeLevelSheets: [string, (rows: any[]) => void][] = [
            ['By LEA', rows => setGradeLevelDistrictTotals(buildGradeLevelTotals(rows, 2, 13))],
            ['By School', rows => setGradeLevelSchoolTotals(buildGradeLevelTotals(rows, 3, 14))],
        ];

        const loadAllSheets = async () => {
            // 1. Download the Excel file once.
            let fileContents: ArrayBuffer;
            try {
                const response = await fetch(linkToData);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status} ${response.statusText} for ${linkToData}`);
                }
                fileContents = await response.arrayBuffer();
            } catch (err) {
                console.error('Error downloading the data file:', err);
                if (!cancelled) setFailedSheets(sheets.map(([name]) => name));
                return;
            }

            // 2. Parse the sheets one at a time from that single download.
            for (const [sheetName, handleRows] of sheets) {
                if (cancelled) return;
                try {
                    const rows = await readXlsxFile(fileContents, { sheet: sheetName });
                    if (cancelled) return;
                    handleRows(rows);
                } catch (err) {
                    console.error(`Error loading sheet "${sheetName}":`, err);
                    if (!cancelled) setFailedSheets(prev => [...prev, sheetName]);
                }
                if (cancelled) return;
                setSheetsLoaded(n => n + 1);

                // Parsing is synchronous, so without this pause the browser would not
                // redraw until every sheet was done. Yielding lets React render (and the
                // numbers fill in) after each sheet, like the legacy dashboard.
                await new Promise(resolve => setTimeout(resolve, 0));
            }

            // 3. Same two steps again, for the separate USBE grade-level enrollment file.
            let gradeLevelContents: ArrayBuffer;
            try {
                const gradeResponse = await fetch(linkToGradeLevelData);
                if (!gradeResponse.ok) {
                    throw new Error(`HTTP ${gradeResponse.status} ${gradeResponse.statusText} for ${linkToGradeLevelData}`);
                }
                gradeLevelContents = await gradeResponse.arrayBuffer();
            } catch (err) {
                console.error('Error downloading the grade-level enrollment file:', err);
                if (!cancelled) setFailedSheets(prev => [...prev, ...gradeLevelSheets.map(([name]) => name)]);
                return;
            }

            for (const [sheetName, handleRows] of gradeLevelSheets) {
                if (cancelled) return;
                try {
                    const rows = await readXlsxFile(gradeLevelContents, { sheet: sheetName });
                    if (cancelled) return;
                    handleRows(rows);
                } catch (err) {
                    console.error(`Error loading sheet "${sheetName}":`, err);
                    if (!cancelled) setFailedSheets(prev => [...prev, sheetName]);
                }
                if (cancelled) return;
                setSheetsLoaded(n => n + 1);
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        };

        loadAllSheets();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const totalSheets = 11; // must match `sheets`.length + `gradeLevelSheets`.length above

    const [tabVal, setTabVal] = useState(0);

    const tabChange = (event: ChangeEvent<{}>, newValue: number) => {
        setTabVal(newValue);
    };

    return (
        <DataContext.Provider
            value={{
                courseData: courseData,
                schoolPopData: schoolPopData,
                schoolCSData: schoolCSData,
                totalSchoolCSData: totalSchoolCSData,
                statePopData: statePopData,
                stateCSData: stateCSData,
                totalStateCSData: totalStateCSData,
                leaPopData: leaPopData,
                totalLeaCSData: totalLeaCSData,
                gradeLevelDistrictTotals: gradeLevelDistrictTotals,
                gradeLevelSchoolTotals: gradeLevelSchoolTotals
            }}
        >
            <div className="App" style={{ overflow: 'hidden', minHeight: '100vh', backgroundColor: '#fafafa' }}>
                <Box
                    sx={{
                        padding: 3,
                        marginBottom: 3,
                        backgroundColor: '#003789',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                >
                    <Typography
                        variant="h5"
                        component="h1"
                        sx={{ textAlign: 'center', color: '#ffffff', fontWeight: 700, letterSpacing: '0.02em' }}
                    >
                        Utah Computer Science Dashboard for Grades 9-12
                        <Box
                            component="span"
                            sx={{
                                backgroundColor: '#0c9400',
                                color: '#ffffff',
                                fontSize: '0.8rem',
                                fontWeight: 900,
                                padding: '2px 8px',
                                borderRadius: '4px',
                                marginLeft: '20px'
                            }}
                        >
                            ⚠️ Dev Mode
                        </Box>
                    </Typography>
                </Box>

                <Box sx={{ maxWidth: '1400px', margin: '0 auto', px: 2 }}>

                    <Box
                        sx={{
                            margin: '0 0 24px 0',
                            padding: 3,
                            backgroundColor: '#e7f0ff',
                            borderRadius: '8px'
                        }}
                    >
                        <SectionTitle sx={{ mt: 0, ml: 0, mb: 2 }}>Dashboard Settings</SectionTitle>
                        <SettingBar />
                    </Box>

                    <Box
                        sx={{
                            margin: '0 0 24px 0',
                            padding: 3,
                            backgroundColor: '#f5f3f3',
                            borderRadius: '8px'
                        }}
                    >
                        <SectionTitle sx={{ mt: 0, ml: 0, mb: 2 }}>Student Population</SectionTitle>
                        <Grid container>
                            <Grid id="state-view" xs={12}>
                                <StateTable categoryColor={categoryColor} />
                            </Grid>
                        </Grid>
                    </Box>

                </Box>

                <Box sx={{ padding: 2 }}>
                    <TabsComponent
                        tabVal={tabVal}
                        tabChange={tabChange}
                        categoryColor={categoryColor}
                    />

                    <Box sx={{ mt: 3 }}>
                        {tabVal === 0 && <OverviewTab categoryColor={categoryColor} />}
                        {tabVal === 1 && (
                            <Grid container spacing={2} sx={{ p: 2 }}>
                                <Grid xs={12} md={6}>
                                    <div style={{
                                        fontSize: '1.3rem',
                                        fontWeight: 'bold',
                                        color: categoryColor,
                                        marginBottom: '10px',
                                        paddingLeft: '10px'
                                    }}>
                                        District Enrollments
                                    </div>
                                    <DistrictTable categoryColor={categoryColor} />    
                                </Grid>

                                <Grid xs={12} md={6}>
                                    <div style={{
                                        fontSize: '1.3rem',
                                        fontWeight: 'bold',
                                        color: categoryColor,
                                        marginBottom: '10px',
                                        paddingLeft: '10px'
                                    }}>
                                        {store.hoveredDistrict
                                            ? `Schools in ${store.hoveredDistrict}`
                                            : "Schools in Selected District(s)"}
                                    </div>
                                    <SchoolTable categoryColor={categoryColor} />
                                </Grid>
                            </Grid>
                        )}
                        {tabVal === 2 && (
                            <Grid container spacing={2} sx={{ p: 2 }}>
                                <Grid xs={12} md={6}>
                                    <div style={{
                                        fontSize: '1.3rem',
                                        fontWeight: 'bold',
                                        color: categoryColor,
                                        marginBottom: '10px',
                                        paddingLeft: '10px'
                                    }}>
                                        Computing Courses Offered by Districts
                                    </div>
                                    <DistrictClassTable categoryColor={categoryColor} />
                                </Grid>

                                <Grid xs={12} md={6}>
                                    <div style={{
                                        fontSize: '1.3rem',
                                        fontWeight: 'bold',
                                        color: categoryColor,
                                        marginBottom: '10px',
                                        paddingLeft: '10px'
                                    }}>
                                        {store.hoveredDistrict
                                            ? `Schools in ${store.hoveredDistrict}`
                                            : "Schools in Selected District(s)"}
                                    </div>
                                    <SchoolClassTable categoryColor={categoryColor} />
                                </Grid>
                            </Grid>
                        )}
                        {tabVal === 3 && <CourseCatalogTab categoryColor={categoryColor} />}
                    </Box>
                </Box>
                <Footer />
            </div>
            <DataLoadingModal
                open={sheetsLoaded < totalSheets || failedSheets.length > 0}
                loaded={sheetsLoaded}
                total={totalSheets}
                failedSheets={failedSheets}
            />
        </DataContext.Provider>
    );

    // return (
    //     <div style={{ padding: 20, fontFamily: 'monospace' }}>
    //         <h1>Data Dump</h1>

    //         <div style={{ marginBottom: 30, borderBottom: '2px solid black' }}>
    //             <h2>1. Grouped by TYPE</h2>
    //             {Object.entries(courseData.byType).map(([type, codes]) => (
    //                 <div key={type} style={{ marginBottom: 10 }}>
    //                     <h3 style={{ color: 'blue' }}>Type: {type} ({codes.length})</h3>
    //                     <div style={{ paddingLeft: 20 }}>
    //                         {codes.map(code => (
    //                             <div key={code}>
    //                                 {code} : {courseData.byCode[code][0]}
    //                             </div>
    //                         ))}
    //                     </div>
    //                 </div>
    //             ))}
    //         </div>

    //         <div style={{ marginBottom: 30, borderBottom: '2px solid black' }}>
    //             <h2>2. Grouped by CATEGORY</h2>
    //             {Object.entries(courseData.byCategory).map(([cat, codes]) => (
    //                 <div key={cat} style={{ marginBottom: 10 }}>
    //                     <h3 style={{ color: 'green' }}>Category: {cat} ({codes.length})</h3>
    //                     <div style={{ paddingLeft: 20 }}>
    //                         {codes.map(code => (
    //                             <div key={code}>
    //                                 {code} : {courseData.byCode[code][0]}
    //                             </div>
    //                         ))}
    //                     </div>
    //                 </div>
    //             ))}
    //         </div>

    //         <div style={{ marginBottom: 30, borderBottom: '2px solid black' }}>
    //             <h2>3. Grouped by LEVEL</h2>
    //             {Object.entries(courseData.byLevel).map(([lvl, codes]) => (
    //                 <div key={lvl} style={{ marginBottom: 10 }}>
    //                     <h3 style={{ color: 'red' }}>Level: {lvl} ({codes.length})</h3>
    //                     <div style={{ paddingLeft: 20 }}>
    //                         {codes.map(code => (
    //                             <div key={code}>
    //                                 {code} : {courseData.byCode[code][0]}
    //                             </div>
    //                         ))}
    //                     </div>
    //                 </div>
    //             ))}
    //         </div>

    //         <div>
    //             <h2>4. Main Dictionary (Code : Data)</h2>
    //             <ul>
    //                 {Object.entries(courseData.byCode).map(([code, details]) => (
    //                     <li key={code}>
    //                         <strong>{code}</strong>: {JSON.stringify(details)}
    //                     </li>
    //                 ))}
    //             </ul>
    //         </div>
    //     </div>
    // );
}

export default observer(App);