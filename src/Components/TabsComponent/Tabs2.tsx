import { FC, useState } from "react";
import { Tabs, Tab, Hidden, IconButton, Drawer, List, ListItem, ListItemText, Box, Typography, ListItemButton } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';

interface TabsComponentProps {
    tabVal: number;
    tabChange: (event: React.SyntheticEvent, newValue: number) => void;
    categoryColor: string;
}

const TabsComponent: FC<TabsComponentProps> = ({ tabVal, tabChange, categoryColor }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const labels = ["OVERVIEW", "ENROLLMENT", "COURSES", "STATEWIDE TRENDS"];

    return (
        <Box sx={{ width: '100%', borderBottom: 1, borderColor: 'divider' }}>
            <Hidden mdDown>
                <Tabs
                    value={tabVal}
                    onChange={tabChange}
                    variant="scrollable"
                    sx={{
                        minHeight: 0,
                        backgroundColor: '#fafafa',
                        '& .MuiTabs-indicator': {
                            backgroundColor: '#1976d2',
                            height: '2px',
                            borderRadius: 0,
                        },
                    }}
                >
                    {labels.map((label, index) => (
                        <Tab
                            key={label}
                            label={label}
                            sx={{
                                textTransform: 'none',
                                fontSize: '18px',
                                fontWeight: 400,
                                color: tabVal === index ? '#1976d2' : 'gray',
                                backgroundColor: tabVal === index ? 'lightgray' : '#fafafa',
                                borderTopLeftRadius: '20px',
                                borderTopRightRadius: '20px',
                                minHeight: 0,
                            }}
                        />
                    ))}
                </Tabs>
            </Hidden>

            <Hidden mdUp>
                {/* tabs for lower section of screebn */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1 }}>
                    <Typography sx={{ fontWeight: 700, color: '#1976d2' }}>
                        {labels[tabVal]}
                    </Typography>
                    <IconButton onClick={() => setIsSidebarOpen(true)}>
                        <MenuIcon />
                    </IconButton>
                </Box>
                <Drawer anchor="right" open={isSidebarOpen} onClose={() => setIsSidebarOpen(false)}>
                    <List sx={{ width: 250,}}>
                        {labels.map((label, index) => (
                            <ListItem key={label} disablePadding>
                                <ListItemButton
                                    selected={tabVal === index}
                                    onClick={() => {
                                        tabChange({} as any, index);
                                        setIsSidebarOpen(false);
                                    }}
                                    sx={{
                                        '&.Mui-selected': {
                                            borderLeft: `4px solid ${categoryColor}`,
                                            backgroundColor: 'rgba(0, 0, 0, 0.04)',
                                        },
                                        '&.Mui-selected:hover': {
                                            backgroundColor: 'rgba(0, 0, 0, 0.08)',
                                        }
                                    }}
                                >
                                    <ListItemText
                                        primary={label}
                                        primaryTypographyProps={{
                                            fontWeight: tabVal === index ? 700 : 400,
                                            color: tabVal === index ? '#1976d2' : 'inherit'
                                        }}
                                    />
                                </ListItemButton>
                            </ListItem>
                        ))}
                    </List>
                </Drawer>
            </Hidden>

        </Box>
    );
};

export default TabsComponent;