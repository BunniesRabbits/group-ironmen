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
import { Skill, SkillIconsBySkill, type Experience } from "../../game/skill";
import * as Member from "../../game/member";
import { LoadingScreen } from "../loading-screen/loading-screen";
import { SkillsInBackendOrder } from "../../api/requests/group-data";

import "./skill-graph.css";

const SkillFilteringOption = ["Overall", ...Skill] as const;
type SkillFilteringOption = (typeof SkillFilteringOption)[number];

const LineChartYAxisOption = ["Total Experience", "Cumulative Experience Gained", "Experience per Hour"] as const;
type LineChartYAxisOption = (typeof LineChartYAxisOption)[number];

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

/**
 * Returns the finitely enumerated x-axis labels for a given aggregate period.
 */
const enumerateLabelsForPeriod = (period: AggregatePeriod): { dates: Date[]; labels: string[]; earliest: Date } => {
  const now = new Date(Date.now());

  const results: { dates: Date[]; labels: string[]; earliest: Date } = {
    dates: [],
    labels: [],
    earliest: new Date(Date.now()),
  };
  let formatString = "";

  switch (period) {
    case "Day": {
      formatString = "p";
      const start = DateFNS.subDays(now, 1);
      results.earliest = start;
      for (const date of DateFNS.eachHourOfInterval({ start, end: now })) {
        results.dates.push(date);
      }
      break;
    }
    case "Week": {
      formatString = "PP";
      const start = DateFNS.subWeeks(now, 1);
      results.earliest = start;
      for (const date of DateFNS.eachDayOfInterval({ start, end: now })) {
        results.dates.push(date);
      }
      break;
    }
    case "Month": {
      formatString = "MMM d";
      const start = DateFNS.subMonths(now, 1);
      results.earliest = start;
      for (const date of DateFNS.eachDayOfInterval({ start, end: now })) {
        results.dates.push(date);
      }
      break;
    }
    case "Year": {
      formatString = "MMM y";
      const start = DateFNS.subYears(now, 1);
      results.earliest = start;
      for (const date of DateFNS.eachMonthOfInterval({ start, end: now })) {
        results.dates.push(date);
      }
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
  options: {
    yAxisUnit: LineChartYAxisOption;
    skillFilter: SkillFilteringOption;
  },
): { label: string; data: number[]; borderColor: string; backgroundColor: string }[] => {
  const sumFilteredExperience = (skills: Experience[]): Experience =>
    skills.reduce((sum, xp, index) => {
      if (options.skillFilter !== "Overall" && Skill[index] !== options.skillFilter) return sum;

      return sum + xp;
    }, 0) as Experience;

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
      const sampleExperience = sumFilteredExperience(sampleAllSkillsExperience);

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

    switch (options.yAxisUnit) {
      case "Cumulative Experience Gained": {
        const start = chartYNumbersForMember[0] ?? 0;
        for (let i = 0; i < chartYNumbersForMember.length; i++) {
          chartYNumbersForMember[i] -= start;
        }
        break;
      }
      case "Experience per Hour": {
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

    const color = `hsl(${Member.computeMemberHueDegrees(member)}deg 80% 50%)`;
    datasets.push({ label: member, data: chartYNumbersForMember, borderColor: color, backgroundColor: color });
  }

  return datasets.sort(({ label: labelA }, { label: labelB }) => labelA.localeCompare(labelB));
};

const buildTableRowsFromMemberSkillData = (
  skillData: Map<Member.Name, { time: Date; data: Experience[] }[]>,
  options: {
    yAxisUnit: LineChartYAxisOption;
    skillFilter: SkillFilteringOption;
  },
): SkillGraphTableRow[] => {
  // Aggregates we so we can compute what fraction of total gains over a period each member did
  let groupGainTotal = 0 as Experience;

  // Individual gains to display for the individual rows
  const groupGains: { name: Member.Name; total: Experience; perSkill: Experience[] }[] = [];

  for (const [member, samples] of skillData) {
    const memberGain = { name: member, total: 0 as Experience, perSkill: [] as Experience[] };

    const samplesSortedOldestFirst = samples.sort(({ time: timeA }, { time: timeB }) =>
      DateFNS.compareAsc(timeA, timeB),
    );

    /*
     * TODO: New members AND members that haven't logged in a lot both have 1
     * sample, and we cannot differentiate them even though we'd like to display
     * new member's gains over a month/year. This is fairly minor, since this
     * only happens if the new member hasn't played enough to be logged multiple
     * times.
     */
    if (samplesSortedOldestFirst.length >= 2) {
      const startingSkills = samplesSortedOldestFirst.at(0)!.data;
      const endingSkills = samplesSortedOldestFirst.at(-1)!.data;

      const skillIndexMax = Math.max(startingSkills.length, endingSkills.length);
      for (let skillIndex = 0; skillIndex < skillIndexMax; skillIndex++) {
        const skill = SkillsInBackendOrder[skillIndex];
        if (options.skillFilter !== "Overall" && skill !== options.skillFilter) {
          continue;
        }

        const start = startingSkills.at(skillIndex) ?? 0;
        const end = endingSkills.at(skillIndex) ?? 0;
        const xpGain = Math.max(0, end - start) as Experience;

        memberGain.perSkill[skillIndex] = xpGain;
        memberGain.total = (memberGain.total + xpGain) as Experience;
        groupGainTotal = (groupGainTotal + xpGain) as Experience;
      }
    }

    groupGains.push(memberGain);
  }

  const rows: SkillGraphTableRow[] = [];

  groupGains.sort(({ total: a }, { total: b }) => b - a);

  for (const { name, total, perSkill } of groupGains) {
    if (options.skillFilter !== "Overall") {
      const skill: Skill = options.skillFilter;

      rows.push({
        name,
        colorCSS: `hsl(69deg, 60%, 60%)`,
        fillFraction: total / groupGainTotal,
        iconSource: SkillIconsBySkill.get(skill)!.href,
        quantity: total,
      });
      continue;
    }

    const overallFraction = total / groupGainTotal;
    const header: SkillGraphTableRow = {
      name,
      colorCSS: `hsl(69deg, 60%, 60%)`,
      fillFraction: overallFraction,
      iconSource: "/ui/3579-0.png",
      quantity: total,
    };
    const skillRows: SkillGraphTableRow[] = [];
    for (let skillIndex = 0; skillIndex < perSkill.length; skillIndex++) {
      const xpGain = perSkill.at(skillIndex);
      const skill = SkillsInBackendOrder[skillIndex];

      if (!xpGain || xpGain <= 0 || !skill) {
        continue;
      }

      const fraction = xpGain / total;

      skillRows.push({
        name: skill,
        colorCSS: `hsl(69deg, 60%, 60%)`,
        fillFraction: fraction * overallFraction,
        iconSource: SkillIconsBySkill.get(skill)!.href,
        quantity: xpGain,
      });
    }

    rows.push(header);
    rows.push(...skillRows.sort(({ quantity: a }, { quantity: b }) => b - a));
  }
  return rows;
};

interface SkillGraphTableRow {
  iconSource: string;
  name: string;
  quantity: number;
  colorCSS: string;
  fillFraction: number;
}

export const SkillGraph = (): ReactElement => {
  const [period, setPeriod] = useState<AggregatePeriod>("Day");
  const [yAxisOption, setYAxisOption] = useState<LineChartYAxisOption>("Total Experience");
  const [skillFilter, setSkillFilter] = useState<SkillFilteringOption>("Overall");
  const [chartData, setChartData] = useState<ChartData<"line", number[], string>>({ labels: [], datasets: [] });
  const [tableRowData, setTableRowData] = useState<SkillGraphTableRow[]>([]);
  const { fetchSkillData } = useContext(APIContext);
  const updateChartPromiseRef = useRef<Promise<void>>(undefined);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (updateChartPromiseRef.current || !fetchSkillData) return;

    setLoading(true);
    updateChartPromiseRef.current = fetchSkillData(period)
      .then((skillData) => new Promise<typeof skillData>((resolve) => setTimeout(() => resolve(skillData), 200)))
      .then((skillData) => {
        const { dates, labels, earliest } = enumerateLabelsForPeriod(period);

        for (const member of skillData.keys()) {
          const filtered = skillData.get(member)!.filter(({ time }) => DateFNS.compareAsc(time, earliest) >= 0);
          skillData.set(member, filtered);
        }

        /*
         * Slice the data, since there is an extra sample sent (e.g. 24 hours
         * ago when we already chart now). This also makes "per hour" options
         * well defined, since our calculations look backwards to determine
         * rates, and the first sample can't look backwards.
         */
        setChartData({
          labels: labels.slice(1),
          datasets: buildDatasetsFromMemberSkillData(skillData, dates, {
            yAxisUnit: yAxisOption,
            skillFilter: skillFilter,
          }).map(({ label, data, borderColor, backgroundColor }) => ({
            label,
            borderColor,
            backgroundColor,
            data: data.slice(1),
          })),
        });

        setTableRowData(
          buildTableRowsFromMemberSkillData(skillData, {
            yAxisUnit: yAxisOption,
            skillFilter: skillFilter,
          }),
        );
      })
      .finally(() => {
        updateChartPromiseRef.current = undefined;
        setLoading(false);
      });
  }, [period, yAxisOption, skillFilter, fetchSkillData]);

  const style = getComputedStyle(document.body);
  ChartJS.defaults.font.family = "rssmall";
  ChartJS.defaults.font.size = 16;
  ChartJS.defaults.color = style.getPropertyValue("--primary-text");
  ChartJS.defaults.scale.grid.color = style.getPropertyValue("--graph-grid-border");

  const options: ChartOptions<"line"> = {
    responsive: true,
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: { display: true, text: `Group ${yAxisOption} for the Preceding ${period}` },
    },
    layout: {
      padding: 4,
    },
    scales: {
      x: {
        title: {
          display: true,
          text: "Time",
        },
        ticks: {
          autoSkip: false,
        },
        grid: {
          drawTicks: false,
        },
      },
      y: {
        title: { display: true, text: yAxisOption },
        type: "linear",
        min: 0,
      },
    },
  };

  let skillIconSource = "/ui/3579-0.png";
  if (Skill.includes(skillFilter as Skill)) {
    skillIconSource = SkillIconsBySkill.get(skillFilter as Skill)?.href ?? skillIconSource;
  }

  let loadingOverlay = undefined;
  if (loading) {
    loadingOverlay = (
      <div id="skill-graph-loading-overlay">
        <LoadingScreen />
      </div>
    );
  }

  const tableRowElements = [];
  for (const { colorCSS, fillFraction, iconSource, name, quantity } of tableRowData) {
    const fillPercent = Math.max(0, Math.min(100, Math.round(100 * fillFraction)));
    tableRowElements.push(
      <tr
        style={{
          background: `linear-gradient(90deg, ${colorCSS} ${fillPercent}%, transparent ${fillPercent}%)`,
        }}
      >
        <td className="skill-graph-xp-change-table-label">
          <img alt="attack" src={iconSource} />
          {name}
        </td>
        <td className="skill-graph-xp-change-data">+{quantity.toLocaleString()}</td>
      </tr>,
    );
  }

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
        <div className="skill-graph-dropdown rsborder-tiny rsbackground rsbackground-hover">
          <select
            value={skillFilter}
            onChange={({ target }) => {
              const selected = target.options[target.selectedIndex].value as SkillFilteringOption;
              if (skillFilter === selected || !SkillFilteringOption.includes(selected)) return;
              setSkillFilter(selected);
            }}
          >
            {SkillFilteringOption.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div id="skill-graph-body" className="rsborder rsbackground">
        <div id="skill-graph-container" className="rsborder-tiny">
          <img alt={skillFilter} id="skill-graph-skill-image" loading="lazy" src={skillIconSource} />
          <Line id="skill-graph-canvas" options={options} data={chartData} />
        </div>
        <table id="skill-graph-xp-change-table">
          <tbody>{tableRowElements}</tbody>
        </table>
        {loadingOverlay}
      </div>
    </>
  );
};
