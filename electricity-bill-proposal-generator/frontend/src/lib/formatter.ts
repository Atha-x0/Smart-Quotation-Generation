export function formatINR(value: number): string {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(value || 0);
}

export function formatNumber(value: number, digits = 1): string {
    return Number(value || 0).toFixed(digits);
}

export function formatPercent(value: number, digits = 1): string {
    return `${Number(value || 0).toFixed(digits)}%`;
}

export function formatKVA(value: number, digits = 0): string {
    return `${Number(value || 0).toFixed(digits)} kVA`;
}

export function formatKVAR(value: number, digits = 0): string {
    return `${Number(value || 0).toFixed(digits)} kVAR`;
}

export function formatKWh(value: number, digits = 0): string {
    return `${Number(value || 0).toFixed(digits)} kWh`;
}

export function formatPayback(months: number): string {
    if (!Number.isFinite(months) || months <= 0) {
        return "Not applicable";
    }

    if (months < 1) {
        return "< 1 month";
    }

    return `${months.toFixed(1)} months`;
}