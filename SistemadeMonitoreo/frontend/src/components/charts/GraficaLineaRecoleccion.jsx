import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const GraficaLineaRecoleccion = ({ categorias = [], series = [] }) => {
  const data = categorias.map((categoria, index) => ({
    semana: categoria,
    Bioinfeccioso:
      series.find((item) => item.name === "Bioinfeccioso")?.data?.[index] || 0,
    Punzocortante:
      series.find((item) => item.name === "Punzocortante")?.data?.[index] || 0,
  }));

  return (
    <div style={{ width: "100%", height: 320 }}>
      <ResponsiveContainer>
        <LineChart
          data={data}
          margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="semana" />
          <YAxis />
          <Tooltip />
          <Legend />

          <Line
            type="monotone"
            dataKey="Bioinfeccioso"
            stroke="#0d6efd"
            strokeWidth={2}
          />

          <Line
            type="monotone"
            dataKey="Punzocortante"
            stroke="#dc3545"
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default GraficaLineaRecoleccion;