import { Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Grid, LinearProgress, Typography } from "@mui/material";
import { observer } from "mobx-react-lite";
import { FC, useContext } from "react";
import Store from "../Interface/Store";

// All props are optional so the legacy dashboard (App.tsx) can keep using
// <DataLoadingModal /> with no props, driven by store.dataLoading as before.
interface Props {
    open?: boolean;
    loaded?: number;          // sheets finished so far
    total?: number;           // sheets to load
    failedSheets?: string[];  // names of sheets that could not be loaded
}

const DataLoadingModal: FC<Props> = ({ open, loaded, total, failedSheets = [] }) => {
    const store = useContext(Store);

    // Error message (new dashboard only).
    if (failedSheets.length > 0) {
        return <Dialog open={open ?? true}>
            <DialogTitle>Some data didn't load</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    A few numbers on this page may show as 0. Reloading usually fixes this.
                </DialogContentText>
                <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 2 }}>
                    Details: {failedSheets.join(', ')}
                </Typography>
            </DialogContent>
            <DialogActions>
                <Button variant="contained" onClick={() => window.location.reload()}>Reload</Button>
            </DialogActions>
        </Dialog>;
    }

    // Progress bar (new dashboard, which passes loaded and total).
    if (loaded !== undefined && total !== undefined && total > 0) {
        return <Dialog open={open ?? true} fullWidth maxWidth="xs">
            <DialogTitle>Loading data...</DialogTitle>
            <DialogContent>
                <Box sx={{ py: 1 }}>
                    <LinearProgress variant="determinate" value={(loaded / total) * 100} />
                </Box>
            </DialogContent>
        </Dialog>;
    }

    // Legacy dashboard: unchanged.
    return <Dialog open={open ?? store.dataLoading} >
        <DialogTitle>Just one second</DialogTitle>
        <DialogContent >
            <Grid container spacing={2}>
                <Grid item>
                    <CircularProgress />
                </Grid>
                <Grid item style={{ alignSelf: "center" }}>
                    <DialogContentText>
                        We are fetching required data.
                    </DialogContentText>
                </Grid>
            </Grid>
        </DialogContent>

    </Dialog>;
};
export default observer(DataLoadingModal);
