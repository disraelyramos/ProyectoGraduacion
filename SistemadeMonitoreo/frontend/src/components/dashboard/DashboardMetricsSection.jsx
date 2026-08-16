import React from "react";
import {
  FiTrendingUp,
  FiActivity,
  FiCheckCircle,
  FiCalendar,
} from "react-icons/fi";

import DashboardMetricCard from "./DashboardMetricCard";

const metricIcons = {
  prediction: <FiTrendingUp />,
  weight: <FiActivity />,
  collection: <FiCheckCircle />,
  calendar: <FiCalendar />,
};

const DashboardMetricsSection = ({
  metrics = [],
  interactiveMetricIds = [],
  onMetricClick,
}) => {
  return (
    <>
      {metrics.map((metric) => {
        const isInteractive =
          interactiveMetricIds.includes(metric.id) &&
          Boolean(onMetricClick);

        return (
          <DashboardMetricCard
            key={metric.id}
            title={metric.title}
            icon={metricIcons[metric.icon] ?? null}
            iconColor={metric.iconColor}
            value={metric.value}
            valueColor={metric.valueColor}
            subtitle={metric.subtitle}
            footer={metric.footer}
            onClick={
              isInteractive
                ? () => onMetricClick(metric.id)
                : undefined
            }
          />
        );
      })}
    </>
  );
};

export default DashboardMetricsSection;