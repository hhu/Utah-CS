import Box from '@mui/material/Box';
import { Typography, Table, TableHead, TableRow, TableBody, TableCell } from '@mui/material';
import { StickyTableContainer } from "../GeneralComponents";
import Modal from '@mui/material/Modal';
import { FC, useContext, useMemo } from "react";
import { DataContext } from "../../App2";
import Store from "../../Interface/Store2";
import { CourseCategoryDictionary } from "../../Preset/Constants2";
import { ModalTitleBar } from "../FrequentlyUsedComponents/FrequentlyUsedComponents";

const style = {
  position: 'absolute' as 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '60vw',
  bgcolor: 'background.paper',
  border: '2px solid dimgray',
  boxShadow: 50,
  p: 4,
};

interface CourseInfoModalProps {
    categoryColor: string;
    onClose: () => void;
}

const CourseInfoModal2: FC<CourseInfoModalProps> = ({ categoryColor, onClose }) => {

    const store = useContext(Store);
    const courseData = useContext(DataContext).courseData;

    const courseList = useMemo(() => {
        if (!courseData?.byCode) return [];
        const matchesLevel = (level: string) => store.courseLevel === 'All' || level === store.courseLevel;

        return Object.entries(courseData.byCode)
            .filter(([, [, type, category, level]]) => {
                if (!matchesLevel(level)) return false;
                if (store.courseCategory === 'CS Total') return true;
                if (store.courseCategory === 'CS Foundational') return type === 'CS';
                return category === store.courseCategory;
            })
            .sort(([codeA], [codeB]) => codeA.localeCompare(codeB));
    }, [courseData, store.courseCategory, store.courseLevel]);

    const categoryLabel = CourseCategoryDictionary[store.courseCategory] ?? store.courseCategory;

    return (
        <div>
            <Modal
                open={true}
                onClose={onClose}
                aria-labelledby="Courses Under Category"
                aria-describedby="All Courses & Codes"
            >
                <Box sx={style}>
                    {ModalTitleBar(`${categoryLabel} Courses`, categoryColor, onClose)}
                    <Typography id="All Courses & Codes" sx={{ mt: 2 }}>
                        <StickyTableContainer>
                            <Table style={{ paddingLeft: '10px', paddingRight: '10px', paddingTop: '10px' }} stickyHeader aria-label="sticky table">
                                <TableHead style={{ backgroundColor: 'dimgray' }}>
                                    <TableRow>
                                        <TableCell style={{ fontWeight: 'bolder', color: categoryColor }}>
                                            Course Code
                                        </TableCell>
                                        <TableCell style={{ fontWeight: 'bolder', color: categoryColor }}>
                                            Course Name
                                        </TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {courseList.map(([code, [name]]) => (
                                        <TableRow key={code}>
                                            <TableCell>{code}</TableCell>
                                            <TableCell>{name}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </StickyTableContainer>
                    </Typography>
                </Box>
            </Modal>
        </div>
    );
};

export default CourseInfoModal2;
