import { Table, TableBody, TableHead, TableRow, Checkbox } from "@mui/material";
import { observer } from "mobx-react-lite";
import { FC, useContext, useEffect, useMemo, useState } from "react";
import { DataContext } from "../../App2";
import Store from "../../Interface/Store2";
import { FunctionCell, SortableHeader, StickyTableContainer, TextCell } from "../CellComponents/TableComponents2";
import { CourseCategoryShortDictionary } from "../../Preset/Constants2";

type CategoryTotals = { total: number; basic: number; advanced: number };

type DistrictAgg = {
	name: string;
	id: string;
	totalCourses: number;
	totalCS: CategoryTotals;
	coreCS: CategoryTotals;
	csRelated: CategoryTotals;
	ws: CategoryTotals;
	cybersecurity: CategoryTotals;
	csFoundational: CategoryTotals;
	databases: CategoryTotals;
	childIds?: string[];
};

const emptyCategoryTotals = (): CategoryTotals => ({ total: 0, basic: 0, advanced: 0 });

const emptyDistrictAgg = (name: string, id: string): DistrictAgg => ({
	name,
	id,
	totalCourses: 0,
	totalCS: emptyCategoryTotals(),
	coreCS: emptyCategoryTotals(),
	csRelated: emptyCategoryTotals(),
	ws: emptyCategoryTotals(),
	cybersecurity: emptyCategoryTotals(),
	csFoundational: emptyCategoryTotals(),
	databases: emptyCategoryTotals(),
});

const categoryKeyForType = (type: string): keyof Pick<DistrictAgg, 'coreCS' | 'csRelated' | 'ws' | 'cybersecurity' | 'csFoundational' | 'databases'> | null => {
	switch (type.toLowerCase()) {
		case 'core cs': return 'coreCS';
		case 'cs related': return 'csRelated';
		case 'web/software development': return 'ws';
		case 'cybersecurity': return 'cybersecurity';
		case 'cs foundational': return 'csFoundational';
		case 'databases': return 'databases';

		default: return null;
	}
};

// selected course category (store.courseCategory) -> DistrictAgg field
const categoryFieldForCourseCategory: Record<string, keyof DistrictAgg | undefined> = {
	'CS Total': 'totalCS',
	'CS Foundational': 'csFoundational',
	'CS-Related': 'csRelated',
	'Core CS': 'coreCS',
	'Cybersecurity': 'cybersecurity',
	'Web/Software Development': 'ws',
	'Databases': 'databases',
};

function accumulate(agg: DistrictAgg, type: string, total: number, basic: number, advanced: number) {
	agg.totalCourses += total;
	agg.totalCS.total += total;
	agg.totalCS.basic += basic;
	agg.totalCS.advanced += advanced;

	const key = categoryKeyForType(type);
	if (key) {
		const bucket = agg[key];
		bucket.total += total;
		bucket.basic += basic;
		bucket.advanced += advanced;
	}
}

const DistrictClassTable: FC<{ categoryColor: string }> = observer(({ categoryColor }) => {
	const store = useContext(Store);
	const { totalLeaCSData, schoolPopData } = useContext(DataContext);
	const year = store.schoolYearShowing;
	const selectedCat = store.courseCategory;
	const selectedLevel = store.courseLevel;
	const [sortAttr, setSortAttr] = useState<'name' | 'courses' | 'enroll'>('name');
	const [sortUp, setSortUp] = useState(true);
	const selectedIDs = [...store.selectedDistricts];






	const districts = useMemo(() => {
		const rows = totalLeaCSData[year] || [];
		const districtsById = new Map<string, DistrictAgg>();

		const charterAgg = emptyDistrictAgg("Charter", "charter");
		const deafBlindAgg = emptyDistrictAgg("DeafBlind", "deafBlind");
		const charterIds = new Set<string>();
		const deafBlindIds = new Set<string>();

		const deafBlindSchools = new Set([
			"jean massieu school for the deaf",
			"kenneth burdett school",
			"north region blind",
			"southern utah school of the deaf",
		]);

		rows.forEach((row: any) => {
			const name = String(row[2] || '').trim();
			const gender = String(row[5] || '').trim();
			const id = String(row[4] || '').trim();
			const totalCourses = Number(row[30]) || 0;
			const basicCourses = Number(row[6]) || 0;
			const advancedCourses = Number(row[18]) || 0;
			const type = String(row[0] || '').trim();

			//when making the districts it only includes rows that have 'district' in the name and a valid id
			//need to change this so it puts the charter schools in their own distict
			//and schools for deaf and blind have their own district 
			//if (!name.toLowerCase().includes('district') || !id) return;

			//ignore the female students classes becuase they are the same classes that the male students are taking
			if (gender.toLowerCase().includes('female')) return;

			const isDistrict = name.toLowerCase().includes('district');
			const isDeafBlind = deafBlindSchools.has(name.toLowerCase());

			if (isDeafBlind) {
				deafBlindIds.add(id);
				accumulate(deafBlindAgg, type, totalCourses, basicCourses, advancedCourses);
				return;
			}

			if (!isDistrict) {
				charterIds.add(id);
				accumulate(charterAgg, type, totalCourses, basicCourses, advancedCourses);
				return;
			}

			if (!districtsById.has(id)) {
				districtsById.set(id, emptyDistrictAgg(name, id));
			}
			accumulate(districtsById.get(id)!, type, totalCourses, basicCourses, advancedCourses);
		});

		districtsById.set("charter", { ...charterAgg, childIds: Array.from(charterIds) });
		districtsById.set("deafBlind", { ...deafBlindAgg, childIds: Array.from(deafBlindIds) });

		// "Total LEA CS Data" only has rows for an LEA that offers at least one CS
		// course, so a district with zero (e.g. Daggett, Wayne, North Summit in
		// 2024-25) is otherwise missing from this table entirely. Add it back in
		// from "School Pop. Data" - which lists every district regardless of CS -
		// with all of its course counts at a confirmed 0.
		(schoolPopData[year] || [])
			.filter((row: any) => String(row[6] || '').toLowerCase().includes('district'))
			.forEach((row: any) => {
				const name = String(row[6]).trim();
				const id = String(row[8]).trim();
				if (!districtsById.has(id)) {
					districtsById.set(id, emptyDistrictAgg(name, id));
				}
			});

		return Array.from(districtsById.values());
	}, [totalLeaCSData, schoolPopData, year, selectedCat, selectedLevel]);

	const allSelectableIds = useMemo(
		() => districts.flatMap(d => (d.childIds && d.childIds.length > 0 ? d.childIds : [d.id])),
		[districts]
	);

	useEffect(() => {
		if (districts.length > 0 && store.selectedDistricts.length === 0) {
			//store.setSelectedDistricts(districts.map(district => district.id));
			store.setSelectedDistricts(allSelectableIds);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [year]);

	const sorted = [...districts].sort((a, b) => {
		const aValue = sortAttr === 'name' ? a.name : sortAttr === 'courses' ? a.totalCourses : 0;
		const bValue = sortAttr === 'name' ? b.name : sortAttr === 'courses' ? b.totalCourses : 0;
		return sortUp ? (aValue > bValue ? 1 : -1) : (aValue < bValue ? 1 : -1);
	});

	const isDistrictSelected = (district: { id: string; childIds?: string[] }) =>
		district.childIds && district.childIds.length > 0
			? district.childIds.every(id => selectedIDs.includes(id))
			: selectedIDs.includes(district.id);

	const toggleDistrict = (district: { id: string; childIds?: string[] }) => {
		if (district.childIds && district.childIds.length > 0) {
			const allSelected = district.childIds.every(id => selectedIDs.includes(id));
			store.setSelectedDistricts(
				allSelected
					? selectedIDs.filter(id => !district.childIds!.includes(id))
					: Array.from(new Set([...selectedIDs, ...district.childIds]))
			);
			return;
		}
		store.updateSelectedDistrict(district.id);
	};

	const handleSelectAll = () => {
		// if (selectedIDs.length === districts.length) {
		// 	store.setSelectedDistricts([]);
		// } else {
		// 	store.setSelectedDistricts(districts.map(district => district.id));
		// }

		store.setSelectedDistricts(selectedIDs.length === allSelectableIds.length ? [] : allSelectableIds);
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
								// indeterminate={selectedIDs.length > 0 && selectedIDs.length < districts.length}
								// checked={districts.length > 0 && selectedIDs.length === districts.length}
								// onChange={handleSelectAll}

								indeterminate={selectedIDs.length > 0 && selectedIDs.length < allSelectableIds.length}
								checked={allSelectableIds.length > 0 && selectedIDs.length === allSelectableIds.length}
								onChange={handleSelectAll}
							/>
						</FunctionCell>
						<SortableHeader
							headerName="District Name"
							isSorting={sortAttr === 'name'}
							isSortUp={sortUp}
							onClick={() => { setSortAttr('name'); setSortUp(!sortUp); }}
						/>
						<SortableHeader
							headerName="Total Number of Courses"
							isSorting={sortAttr === 'courses'}
							isSortUp={sortUp}
							onClick={() => { setSortAttr('courses'); setSortUp(!sortUp); }}
						/>
						<SortableHeader
							headerName={`${CourseCategoryShortDictionary[store.courseCategory] ?? store.courseCategory} Courses`}
							isSorting={sortAttr === 'enroll'}
							isSortUp={sortUp}
							onClick={() => { setSortAttr('enroll'); setSortUp(!sortUp); }}
							additionalStyle={{ color: categoryColor }}
						/>
						<TextCell style={{ fontWeight: 'bold', backgroundColor: '#f9f9f9', color: categoryColor }}>
							Basic & Advanced
						</TextCell>
					</TableRow>
				</TableHead>
				<TableBody>
					{sorted.map(district => (
						<TableRow key={district.id} hover>
							<FunctionCell>
								<Checkbox
									size="small"
									color="primary"
									// checked={selectedIDs.includes(district.id)}
									// onChange={() => store.updateSelectedDistrict(district.id)}

									checked={isDistrictSelected(district)}
									onChange={() => toggleDistrict(district)}

								/>
							</FunctionCell>
							<TextCell style={{ fontWeight: 500 }}>{district.name}</TextCell>
							<TextCell style={{ color: '#666' }}>{district.totalCourses.toLocaleString()}</TextCell>

							{store.courseCategory === 'CS Total' ? (
								<TextCell style={{ color: categoryColor, fontWeight: 'bold' }}>{district.totalCS.total.toLocaleString()}</TextCell>
							) : store.courseCategory === 'CS Foundational' ? (
								<TextCell style={{ color: categoryColor, fontWeight: 'bold' }}>{district.csFoundational.total.toLocaleString()}</TextCell>
							) : store.courseCategory === 'CS-Related' ? (
								<TextCell style={{ color: categoryColor, fontWeight: 'bold' }}>{district.csRelated.total.toLocaleString()}</TextCell>
							) : store.courseCategory === 'Core CS' ? (
								<TextCell style={{ color: categoryColor, fontWeight: 'bold' }}>{district.coreCS.total.toLocaleString()}</TextCell>
							) : store.courseCategory === 'Cybersecurity' ? (
								<TextCell style={{ color: categoryColor, fontWeight: 'bold' }}>{district.cybersecurity.total.toLocaleString()}</TextCell>
							) : store.courseCategory === 'Databases' ? (
								<TextCell style={{ color: categoryColor, fontWeight: 'bold' }}>{district.databases.total.toLocaleString()}</TextCell>

								//<TextCell style={{ color: categoryColor, fontWeight: 'bold' }}>{district.databases.toLocaleString()}</TextCell>
							) : store.courseCategory === 'Web/Software Development' ? (
								<TextCell style={{ color: categoryColor, fontWeight: 'bold' }}>{district.ws.total.toLocaleString()}</TextCell>
							) :
								(
									<TextCell style={{ color: categoryColor, fontWeight: 'bold' }}>{district.totalCS.total.toLocaleString()}</TextCell>
								)}

							<TextCell style={{ fontSize: '0.8rem', color: '#555', lineHeight: '1.4' }}>
								<div style={{ display: 'flex', flexDirection: 'column' }}>
									<span><span style={{ fontWeight: 'bold' }}>Basic:</span> <span style={{ color: '#555' }}>{(district[categoryFieldForCourseCategory[store.courseCategory] ?? 'totalCS'] as CategoryTotals).basic.toLocaleString()}</span></span>
									<span><span style={{ fontWeight: 'bold' }}>Advanced:</span> <span style={{ color: '#555' }}>{(district[categoryFieldForCourseCategory[store.courseCategory] ?? 'totalCS'] as CategoryTotals).advanced.toLocaleString()}</span></span>
								</div>
							</TextCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</StickyTableContainer>
	);
});

export default DistrictClassTable;
