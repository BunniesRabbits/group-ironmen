import { useContext, useEffect, useRef, useState, type ReactElement } from "react";
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
  type ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { AggregatePeriod } from "../../api/requests/skill-data";
import * as DateFNS from "date-fns";
import { APIContext } from "../../context/api-context";
import type { Experience } from "../../game/skill";
import * as Member from "../../game/member";

import "./skill-graph.css";

const LineChartYAxisOption = ["Total Experience", "Cumulative Experience Gained", "Experience per hour"] as const;
type LineChartYAxisOption = (typeof LineChartYAxisOption)[number];

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const options: ChartOptions<"line"> = {
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
  scales: {
    x: {
      ticks: {
        autoSkip: false,
      },
      grid: {
        drawTicks: false,
      },
    },
    y: {
      type: "linear",
      min: 0,
    },
  },
};

/**
 * Returns the finitely enumerated x-axis labels for a given aggregate period.
 */
const enumerateLabelsForPeriod = (period: AggregatePeriod): { dates: Date[]; labels: string[] } => {
  const now = new Date(Date.now());

  const results: { dates: Date[]; labels: string[] } = { dates: [], labels: [] };
  let formatString = "";

  switch (period) {
    case "Day":
      formatString = "p";
      for (const date of DateFNS.eachHourOfInterval({ start: DateFNS.subDays(now, 1), end: now })) {
        results.dates.push(date);
      }
      break;
    case "Week":
      formatString = "PP";
      for (const date of DateFNS.eachDayOfInterval({ start: DateFNS.subWeeks(now, 1), end: now })) {
        results.dates.push(date);
      }
      break;
    case "Month":
      formatString = "MMM d";
      for (const date of DateFNS.eachDayOfInterval({ start: DateFNS.subMonths(now, 1), end: now })) {
        results.dates.push(date);
      }
      break;
    case "Year":
      formatString = "MMM y";
      for (const date of DateFNS.eachMonthOfInterval({ start: DateFNS.subYears(now, 1), end: now })) {
        results.dates.push(date);
      }
  }

  for (const date of results.dates) {
    results.labels.push(DateFNS.format(date, formatString));
  }

  return results;
};

/**
 * Takes in a bunch of experience samples for all members, then outputs the data
 * with all samples binned and data filled in for display on the chart.
 *
 * For gaps, older existing samples are extrapolated forward.
 */
const buildDatasetsFromMemberSkillData = (
  skillData: Map<Member.Name, { time: Date; data: Experience[] }[]>,
  dateBins: Date[],
  yAxisOption: LineChartYAxisOption,
): { label: string; data: number[]; borderColor: string; backgroundColor: string }[] => {
  /**
   * The backend only sends samples it has, so there are gaps. We need to
   * fill those gaps and interpolate the existing samples into our buckets.
   */
  const datasets = [];
  for (const [member, memberSkillData] of skillData) {
    const binnedSamples: ({ experience: Experience; sampleDate: Date } | undefined)[] = Array<undefined>(
      dateBins.length,
    ).fill(undefined);

    const swapBinIfNewer = (incoming: { experience: Experience; sampleDate: Date }, index: number): void => {
      if (index < 0 || index >= binnedSamples.length) throw new Error("Out of bounds bin swap");

      const currentBinnedSample = binnedSamples.at(index);
      if (!currentBinnedSample) {
        binnedSamples[index] = structuredClone(incoming);
        return;
      }

      const incomingDateIsNewer = DateFNS.compareAsc(incoming.sampleDate, currentBinnedSample?.sampleDate) >= 0;
      if (!incomingDateIsNewer) return;

      binnedSamples[index] = structuredClone(incoming);
    };

    // Bin all of our samples received from the server
    for (const { time: sampleDate, data: sampleAllSkillsExperience } of memberSkillData) {
      const sampleExperience = sampleAllSkillsExperience.reduce((sum, value) => {
        return sum + value;
      }, 0) as Experience;

      const binIndex = DateFNS.closestIndexTo(sampleDate, dateBins)!;
      swapBinIfNewer({ experience: sampleExperience, sampleDate }, binIndex);
    }

    // Fill the gaps
    const chartYNumbersForMember: number[] = [];
    for (let i = 0; i < binnedSamples.length; i++) {
      const sample = binnedSamples.at(i);

      if (sample) {
        chartYNumbersForMember.push(sample.experience);
        continue;
      }

      const previous = chartYNumbersForMember.at(chartYNumbersForMember.length - 1);
      chartYNumbersForMember.push(previous ?? 0);
    }

    switch (yAxisOption) {
      case "Cumulative Experience Gained": {
        const start = chartYNumbersForMember[0] ?? 0;
        for (let i = 0; i < chartYNumbersForMember.length; i++) {
          chartYNumbersForMember[i] -= start;
        }
        break;
      }
      case "Experience per hour": {
        // Iterate backwards to avoid overwriting.
        for (let i = chartYNumbersForMember.length - 1; i >= 1; i--) {
          const hoursPerSample = DateFNS.differenceInHours(dateBins[i], dateBins[i - 1]);
          const experienceGained = chartYNumbersForMember[i] - chartYNumbersForMember[i - 1];
          chartYNumbersForMember[i] = experienceGained / hoursPerSample;
        }
        break;
      }
      case "Total Experience":
        break;
    }

    datasets.push({ label: member, data: chartYNumbersForMember, borderColor: "#118811", backgroundColor: "#118811" });
  }

  return datasets;
};

export const SkillGraph = (): ReactElement => {
  const [period, setPeriod] = useState<AggregatePeriod>("Day");
  const [yAxisOption, setYAxisOption] = useState<LineChartYAxisOption>("Total Experience");
  const [chartData, setChartData] = useState<ChartData<"line", number[], string>>({ labels: [], datasets: [] });
  const { fetchSkillData } = useContext(APIContext);
  const updateChartPromiseRef = useRef<Promise<void>>(undefined);

  useEffect(() => {
    if (updateChartPromiseRef.current || !fetchSkillData) return;

    updateChartPromiseRef.current = fetchSkillData(period)
      .then((skillData) => {
        const { dates, labels } = enumerateLabelsForPeriod(period);

        setChartData({
          labels: labels.slice(1),
          datasets: buildDatasetsFromMemberSkillData(skillData, dates, yAxisOption).map(
            ({ label, data, borderColor, backgroundColor }) => ({
              label,
              borderColor,
              backgroundColor,
              data: data.slice(1),
            }),
          ),
        });
      })
      .finally(() => {
        updateChartPromiseRef.current = undefined;
      });
  }, [period, yAxisOption, fetchSkillData]);

  const style = getComputedStyle(document.body);
  ChartJS.defaults.color = style.getPropertyValue("--primary-text");
  ChartJS.defaults.scale.grid.color = style.getPropertyValue("--graph-grid-border");

  return (
    <>
      <div id="skill-graph-control-container">
        <div className="skill-graph-dropdown rsborder-tiny rsbackground rsbackground-hover">
          <select
            value={period}
            onChange={({ target }) => {
              const selected = target.options[target.selectedIndex].value as AggregatePeriod;
              if (period === selected || !AggregatePeriod.includes(selected)) return;
              setPeriod(selected);
            }}
          >
            {AggregatePeriod.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="skill-graph-dropdown rsborder-tiny rsbackground rsbackground-hover">
          <select
            value={yAxisOption}
            onChange={({ target }) => {
              const selected = target.options[target.selectedIndex].value as LineChartYAxisOption;
              if (yAxisOption === selected || !LineChartYAxisOption.includes(selected)) return;
              setYAxisOption(selected);
            }}
          >
            {LineChartYAxisOption.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div id="skill-graph-container" className="rsborder rsbackground">
        <Line id="skill-graph-canvas" className="rsborder-tiny" options={options} data={chartData} />
      </div>
    </>
  );
};
