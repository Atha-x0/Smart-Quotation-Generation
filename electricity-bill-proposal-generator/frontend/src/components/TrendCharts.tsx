import type { BillData } from "../types/billTypes";
import { formatINR, formatKVA } from "../lib/formatter";

interface TrendChartsProps {
  bills: BillData[];
}

interface ChartItem {
  label: string;
  value: number;
  displayValue: string;
}

interface ChartBlockProps {
  title: string;
  unitLabel: string;
  items: ChartItem[];
}

function getSafeValue(value: number | undefined | null): number {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return 0;
  }

  return Number(value);
}

function getMaxValue(items: ChartItem[]): number {
  if (items.length === 0) {
    return 0;
  }

  return Math.max(...items.map((item) => getSafeValue(item.value)));
}

function getBarClass(index: number): string {
  const classIndex = (index % 6) + 1;
  return `trend-bar-fill trend-bar-${classIndex}`;
}

function ChartBlock({ title, unitLabel, items }: ChartBlockProps) {
  const maxValue = getMaxValue(items);

  if (items.length === 0) {
    return (
      <div className="trend-chart-card">
        <h3>{title}</h3>
        <p className="section-note">No data available for this chart.</p>
      </div>
    );
  }

  return (
    <div className="trend-chart-card">
      <div className="trend-chart-header">
        <h3>{title}</h3>
        <span>{unitLabel}</span>
      </div>

      <div className="trend-chart">
        {items.map((item, index) => {
          const percentage =
            maxValue > 0 ? Math.max(4, (item.value / maxValue) * 100) : 0;

          return (
            <div className="trend-chart-row" key={`${title}-${item.label}-${index}`}>
              <div className="trend-chart-label">{item.label}</div>

              <div className="trend-bar-track">
                <div
                  className={getBarClass(index)}
                  style={{ width: `${percentage}%` }}
                />
              </div>

              <div className="trend-chart-value">{item.displayValue}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getBillAmountItems(bills: BillData[]): ChartItem[] {
  return bills.map((bill) => ({
    label: bill.month || "Month",
    value: getSafeValue(bill.totalBillAmount),
    displayValue: formatINR(getSafeValue(bill.totalBillAmount)),
  }));
}

function getKWhItems(bills: BillData[]): ChartItem[] {
  return bills.map((bill) => ({
    label: bill.month || "Month",
    value: getSafeValue(bill.kWh),
    displayValue: `${getSafeValue(bill.kWh).toLocaleString("en-IN", {
      maximumFractionDigits: 0,
    })} kWh`,
  }));
}

function getActualDemandItems(bills: BillData[]): ChartItem[] {
  return bills.map((bill) => ({
    label: bill.month || "Month",
    value: getSafeValue(bill.actualDemandKVA),
    displayValue: formatKVA(getSafeValue(bill.actualDemandKVA)),
  }));
}

function getBillingDemandItems(bills: BillData[]): ChartItem[] {
  return bills.map((bill) => ({
    label: bill.month || "Month",
    value: getSafeValue(bill.billingDemandKVA || bill.actualDemandKVA),
    displayValue: formatKVA(
      getSafeValue(bill.billingDemandKVA || bill.actualDemandKVA)
    ),
  }));
}

function getPowerFactorItems(bills: BillData[]): ChartItem[] {
  return bills.map((bill) => ({
    label: bill.month || "Month",
    value: getSafeValue(bill.powerFactor),
    displayValue: getSafeValue(bill.powerFactor).toFixed(3),
  }));
}

function TrendCharts({ bills }: TrendChartsProps) {
  if (bills.length === 0) {
    return (
      <section className="panel trend-panel">
        <h2>Trend Charts</h2>
        <p className="section-note">
          Upload electricity bills to view monthly trend charts.
        </p>
      </section>
    );
  }

  return (
    <section className="panel trend-panel">
      <div className="panel-header">
        <div>
          <h2>Trend Charts</h2>
          <p className="section-note">
            Visual review of bill amount, consumption, demand, and power factor
            across uploaded months.
          </p>
        </div>

        <span className="badge success">{bills.length} month(s)</span>
      </div>

      {bills.length < 3 && (
        <div className="alert warning">
          <h3>Trend Note</h3>
          <p>
            Trend charts are visible, but reliable trend interpretation requires
            at least 3 months of bills. For demand optimization, upload 6 to 12
            months of electricity bills.
          </p>
        </div>
      )}

      <div className="trend-chart-grid">
        <ChartBlock
          title="Monthly Bill Amount"
          unitLabel="₹"
          items={getBillAmountItems(bills)}
        />

        <ChartBlock
          title="kWh Consumption"
          unitLabel="kWh"
          items={getKWhItems(bills)}
        />

        <ChartBlock
          title="Actual Demand"
          unitLabel="kVA"
          items={getActualDemandItems(bills)}
        />

        <ChartBlock
          title="Billing Demand"
          unitLabel="kVA"
          items={getBillingDemandItems(bills)}
        />

        <ChartBlock
          title="Power Factor"
          unitLabel="PF"
          items={getPowerFactorItems(bills)}
        />
      </div>
    </section>
  );
}

export default TrendCharts;