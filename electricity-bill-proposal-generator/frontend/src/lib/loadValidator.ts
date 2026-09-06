import type { ConnectedLoadData } from "../types/loadTypes";

export interface LoadValidationResult {
    totalConnectedKW: number;
    equipmentCount: number;
    zeroKWRows: number;
    highKWRows: number;
    highQuantityRows: number;
    missingNameRows: number;
    warnings: string[];
    highLoadItems: ConnectedLoadData[];
}

export function validateConnectedLoads(
    connectedLoads: ConnectedLoadData[]
): LoadValidationResult {
    const warnings: string[] = [];

    const totalConnectedKW = connectedLoads.reduce(
        (sum, item) => sum + (item.connectedKW || 0),
        0
    );

    const zeroKWRows = connectedLoads.filter(
        (item) => !item.connectedKW || item.connectedKW <= 0
    ).length;

    const highLoadItems = connectedLoads.filter(
        (item) => item.connectedKW > 250
    );

    const highKWRows = highLoadItems.length;

    const highQuantityRows = connectedLoads.filter(
        (item) => item.quantity > 50
    ).length;

    const missingNameRows = connectedLoads.filter(
        (item) =>
            !item.equipmentName ||
            item.equipmentName.trim() === "" ||
            item.equipmentName.toLowerCase().startsWith("row ")
    ).length;

    if (connectedLoads.length === 0) {
        warnings.push("No connected load data uploaded.");
    }

    if (zeroKWRows > 0) {
        warnings.push(
            `${zeroKWRows} connected load row(s) have zero or missing connected kW.`
        );
    }

    if (highKWRows > 0) {
        warnings.push(
            `${highKWRows} equipment row(s) have connected load above 250 kW. Please verify these values.`
        );
    }

    if (highQuantityRows > 0) {
        warnings.push(
            `${highQuantityRows} equipment row(s) have quantity above 50. Please verify whether quantity column is mapped correctly.`
        );
    }

    if (missingNameRows > 0) {
        warnings.push(
            `${missingNameRows} equipment row(s) have missing or unclear equipment name.`
        );
    }

    if (totalConnectedKW > 3000) {
        warnings.push(
            `Total connected load is ${totalConnectedKW.toFixed(
                2
            )} kW, which is high. Please verify connected load files and column mapping.`
        );
    }

    return {
        totalConnectedKW,
        equipmentCount: connectedLoads.length,
        zeroKWRows,
        highKWRows,
        highQuantityRows,
        missingNameRows,
        warnings,
        highLoadItems,
    };
}