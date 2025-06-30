import { useEffect, useState, type ReactElement } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  type ChartData,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { AggregatePeriod } from "../../data/requests/skill-data";
import * as DateFNS from "date-fns";

import "./skill-graph.css";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const options = {
  responsive: true,
  plugins: {
    legend: {
      position: "top" as const,
    },
    title: {
      display: true,
      text: "Chart.js Line Chart",
    },
  },
};

/**
 * Returns the finitely enumerated x-axis labels for a given aggregate period.
 */
const enumerateLabelsForPeriod = (period: AggregatePeriod): { date: Date; label: string }[] => {
  const now = new Date(Date.now());

  const results: { date: Date; label: string }[] = [];

  switch (period) {
    case "Day":
      for (const date of DateFNS.eachHourOfInterval({ start: DateFNS.subDays(now, 1), end: now })) {
        results.push({ date, label: DateFNS.format(date, "p") });
      }
      break;
    case "Week":
      for (const date of DateFNS.eachDayOfInterval({ start: DateFNS.subWeeks(now, 1), end: now })) {
        results.push({ date, label: DateFNS.format(date, "PP") });
      }
      break;
    case "Month":
      for (const date of DateFNS.eachDayOfInterval({ start: DateFNS.subMonths(now, 1), end: now })) {
        results.push({ date, label: DateFNS.format(date, "MMM d") });
      }
      break;
    case "Year":
      for (const date of DateFNS.eachMonthOfInterval({ start: DateFNS.subYears(now, 1), end: now })) {
        results.push({ date, label: DateFNS.format(date, "MMM y") });
      }
  }

  return results.slice(1);
};

export const SkillGraph = (): ReactElement => {
  const [period, setPeriod] = useState<AggregatePeriod>("Day");
  const [chartData, setChartData] = useState<ChartData<"line", number[], string>>({ labels: [], datasets: [] });

  useEffect(() => {
    const dates = enumerateLabelsForPeriod(period);

    const labelPerDate = [];
    const experiencePerDate = [];

    let i = 0;
    for (const { label } of dates) {
      labelPerDate.push(label);
      experiencePerDate.push(i);
      i += 1;
    }

    setChartData({
      labels: labelPerDate,
      datasets: [
        {
          label: period,
          data: experiencePerDate,
          borderColor: "rgb(53, 162, 235)",
          backgroundColor: "rgba(53, 162, 235, 0.5)",
        },
      ],
    });
  }, [period]);

  const style = getComputedStyle(document.body);
  ChartJS.defaults.color = style.getPropertyValue("--primary-text");
  ChartJS.defaults.scale.grid.color = style.getPropertyValue("--graph-grid-border");

  return (
    <>
      <div id="skill-graph-control-container">
        <div id="skill-graph-period-select" className="rsborder-tiny rsbackground rsbackground-hover">
          <select
            value={period}
            onChange={({ target }) => {
              const selected = target.options[target.selectedIndex].value as AggregatePeriod;
              if (period === selected || !AggregatePeriod.includes(selected)) return;
              setPeriod(selected);
            }}
          >
            <option value="Day">Period: 24 Hours</option>
            <option value="Week">Period: 7 Days</option>
            <option value="Month">Period: 30 Days</option>
            <option value="Year">Period: 12 Months</option>
          </select>
        </div>
      </div>
      <div className="rsborder rsbackground">
        <Line id="skill-graph-canvas" className="rsborder-tiny" options={options} data={chartData} />
      </div>
    </>
  );
};
