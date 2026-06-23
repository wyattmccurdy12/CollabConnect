/*
  author: GitHub Copilot
  description: Admin analytics dashboard for message load tracking and monitoring.
*/
import React, { useEffect, useState } from "react";
import { Box, Button, CircularProgress, MenuItem, Select, useTheme } from "@mui/material";
import axios from "axios";
import { tokens } from "../../theme";
import Header from "../../components/Header";
import { RefreshCw, TrendingUp } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const AdminAnalytics = () => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);

  const [lookbackMinutes, setLookbackMinutes] = useState(60);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000);

  const [loadSummary, setLoadSummary] = useState([]);
  const [topSenders, setTopSenders] = useState([]);
  const [stats, setStats] = useState({
    totalMessages: 0,
    peakThroughput: 0,
    avgThroughputMsgs: 0,
    topSenderName: "—",
    topSenderCount: 0,
  });

  const [loadingLoad, setLoadingLoad] = useState(false);
  const [loadingSenders, setLoadingSenders] = useState(false);
  const [error, setError] = useState(null);

  const fetchLoadSummary = async () => {
    try {
      setLoadingLoad(true);
      setError(null);
      const response = await axios.get("http://127.0.0.1:5001/api/analytics/message-load/summary", {
        params: { lookback_minutes: lookbackMinutes },
      });
      const data = response.data.data || [];
      setLoadSummary(
        data.map((row) => ({
          minute_bucket: row.minute_bucket,
          message_count: row.message_count,
          total_payload_bytes: row.total_payload_bytes,
        }))
      );
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to load summary");
    } finally {
      setLoadingLoad(false);
    }
  };

  const fetchTopSenders = async () => {
    try {
      setLoadingSenders(true);
      setError(null);
      const response = await axios.get("http://127.0.0.1:5001/api/analytics/message-load/senders", {
        params: { lookback_minutes: lookbackMinutes, limit: 20 },
      });
      const data = response.data.data || [];
      setTopSenders(
        data.map((row) => ({
          sender_user_id: row.sender_user_id,
          person_name: row.person_name || `User ${row.sender_user_id}`,
          message_count: row.message_count,
        }))
      );
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to load senders");
    } finally {
      setLoadingSenders(false);
    }
  };

  const calculateStats = () => {
    if (loadSummary.length === 0) {
      setStats({
        totalMessages: 0,
        peakThroughput: 0,
        avgThroughputMsgs: 0,
        topSenderName: topSenders[0]?.person_name || "—",
        topSenderCount: topSenders[0]?.message_count || 0,
      });
      return;
    }

    const totalMessages = loadSummary.reduce((sum, row) => sum + row.message_count, 0);
    const peakThroughput = Math.max(...loadSummary.map((row) => row.message_count));
    const avgThroughputMsgs = totalMessages / Math.max(loadSummary.length, 1);

    setStats({
      totalMessages,
      peakThroughput,
      avgThroughputMsgs: Math.round(avgThroughputMsgs * 100) / 100,
      topSenderName: topSenders[0]?.person_name || "—",
      topSenderCount: topSenders[0]?.message_count || 0,
    });
  };

  useEffect(() => {
    fetchLoadSummary();
    fetchTopSenders();
  }, [lookbackMinutes]);

  useEffect(() => {
    calculateStats();
  }, [loadSummary, topSenders]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchLoadSummary();
      fetchTopSenders();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, lookbackMinutes]);

  const handleRefresh = () => {
    fetchLoadSummary();
    fetchTopSenders();
  };

  return (
    <Box m="20px">
      <Header title="Message Analytics" subtitle="Real-time load tracking and top senders" />

      {error && (
        <Box
          sx={{
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            border: `1px solid ${colors.redAccent[500] || "rgba(239, 68, 68, 0.35)"}`,
            color: colors.grey[100],
            borderRadius: "12px",
            px: 2,
            py: 1.5,
            mb: 2,
          }}
        >
          {error}
        </Box>
      )}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "1fr 1fr 1fr 1fr" },
          gap: "20px",
          mb: 3,
        }}
      >
        <Box
          sx={{
            backgroundColor: colors.primary[400],
            borderRadius: "12px",
            padding: "20px",
            border: `1px solid ${colors.primary[300]}`,
          }}
        >
          <Box color={colors.grey[300]} fontSize="0.9rem" fontWeight={600} mb={1}>
            TOTAL MESSAGES
          </Box>
          <Box color={colors.grey[100]} fontSize="2.2rem" fontWeight={800}>
            {stats.totalMessages.toLocaleString()}
          </Box>
        </Box>

        <Box
          sx={{
            backgroundColor: colors.primary[400],
            borderRadius: "12px",
            padding: "20px",
            border: `1px solid ${colors.primary[300]}`,
          }}
        >
          <Box color={colors.grey[300]} fontSize="0.9rem" fontWeight={600} mb={1}>
            PEAK THROUGHPUT
          </Box>
          <Box color={colors.greenAccent[400]} fontSize="2.2rem" fontWeight={800}>
            {stats.peakThroughput.toLocaleString()} msgs
          </Box>
        </Box>

        <Box
          sx={{
            backgroundColor: colors.primary[400],
            borderRadius: "12px",
            padding: "20px",
            border: `1px solid ${colors.primary[300]}`,
          }}
        >
          <Box color={colors.grey[300]} fontSize="0.9rem" fontWeight={600} mb={1}>
            AVG THROUGHPUT
          </Box>
          <Box color={colors.blueAccent[400]} fontSize="2.2rem" fontWeight={800}>
            {stats.avgThroughputMsgs.toLocaleString()} msgs/min
          </Box>
        </Box>

        <Box
          sx={{
            backgroundColor: colors.primary[400],
            borderRadius: "12px",
            padding: "20px",
            border: `1px solid ${colors.primary[300]}`,
          }}
        >
          <Box color={colors.grey[300]} fontSize="0.9rem" fontWeight={600} mb={1}>
            TOP SENDER
          </Box>
          <Box color={colors.grey[100]} fontSize="1.1rem" fontWeight={800} mb={0.5}>
            {stats.topSenderName}
          </Box>
          <Box color={colors.grey[300]} fontSize="0.85rem">
            {stats.topSenderCount.toLocaleString()} messages
          </Box>
        </Box>
      </Box>

      <Box
        sx={{
          display: "flex",
          gap: 2,
          mb: 3,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <label style={{ color: colors.grey[100], fontSize: "0.9rem" }}>Lookback:</label>
          <Select
            value={lookbackMinutes}
            onChange={(e) => setLookbackMinutes(e.target.value)}
            sx={{
              backgroundColor: colors.primary[400],
              color: colors.grey[100],
              borderRadius: "8px",
              minWidth: "120px",
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: colors.primary[300],
              },
            }}
          >
            <MenuItem value={15}>Last 15 mins</MenuItem>
            <MenuItem value={30}>Last 30 mins</MenuItem>
            <MenuItem value={60}>Last 1 hour</MenuItem>
            <MenuItem value={360}>Last 6 hours</MenuItem>
            <MenuItem value={1440}>Last 24 hours</MenuItem>
          </Select>
        </Box>

        <Box display="flex" alignItems="center" gap={1}>
          <label style={{ color: colors.grey[100], fontSize: "0.9rem" }}>Auto-refresh:</label>
          <Select
            value={autoRefresh ? refreshInterval : 0}
            onChange={(e) => {
              const val = e.target.value;
              if (val === 0) {
                setAutoRefresh(false);
              } else {
                setAutoRefresh(true);
                setRefreshInterval(val);
              }
            }}
            sx={{
              backgroundColor: colors.primary[400],
              color: colors.grey[100],
              borderRadius: "8px",
              minWidth: "120px",
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: colors.primary[300],
              },
            }}
          >
            <MenuItem value={0}>Off</MenuItem>
            <MenuItem value={5000}>Every 5s</MenuItem>
            <MenuItem value={10000}>Every 10s</MenuItem>
            <MenuItem value={30000}>Every 30s</MenuItem>
          </Select>
        </Box>

        <Button
          variant="outlined"
          startIcon={<RefreshCw />}
          onClick={handleRefresh}
          disabled={loadingLoad || loadingSenders}
          sx={{
            borderColor: colors.greenAccent[500],
            color: colors.grey[100],
            "&:hover": {
              borderColor: colors.greenAccent[400],
              backgroundColor: "rgba(0, 0, 0, 0.04)",
            },
          }}
        >
          Refresh now
        </Button>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" },
          gap: "20px",
        }}
      >
        <Box
          sx={{
            backgroundColor: colors.primary[400],
            borderRadius: "12px",
            border: `1px solid ${colors.primary[300]}`,
            padding: "20px",
          }}
        >
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <TrendingUp style={{ width: 20, height: 20, color: colors.greenAccent[500] }} />
            <Box color={colors.grey[100]} fontWeight={800}>
              Message Load (last {lookbackMinutes} minutes)
            </Box>
          </Box>

          {loadingLoad ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
              <CircularProgress sx={{ color: colors.greenAccent[500] }} />
            </Box>
          ) : loadSummary.length === 0 ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px" color={colors.grey[300]}>
              No data available
            </Box>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={loadSummary} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.primary[300]} />
                <XAxis
                  dataKey="minute_bucket"
                  tick={{ fill: colors.grey[300], fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fill: colors.grey[300], fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: colors.primary[500],
                    border: `1px solid ${colors.primary[300]}`,
                    borderRadius: "8px",
                    color: colors.grey[100],
                  }}
                />
                <Legend wrapperStyle={{ color: colors.grey[300] }} />
                <Line
                  type="monotone"
                  dataKey="message_count"
                  stroke={colors.greenAccent[500]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                  name="Messages/min"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Box>

        <Box
          sx={{
            backgroundColor: colors.primary[400],
            borderRadius: "12px",
            border: `1px solid ${colors.primary[300]}`,
            padding: "20px",
          }}
        >
          <Box color={colors.grey[100]} fontWeight={800} mb={2}>
            Top Senders
          </Box>

          {loadingSenders ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
              <CircularProgress sx={{ color: colors.greenAccent[500] }} />
            </Box>
          ) : topSenders.length === 0 ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px" color={colors.grey[300]}>
              No sender data
            </Box>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topSenders.slice(0, 10)} margin={{ top: 5, right: 30, left: 0, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.primary[300]} />
                <XAxis
                  dataKey="person_name"
                  tick={{ fill: colors.grey[300], fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis tick={{ fill: colors.grey[300], fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: colors.primary[500],
                    border: `1px solid ${colors.primary[300]}`,
                    borderRadius: "8px",
                    color: colors.grey[100],
                  }}
                />
                <Bar dataKey="message_count" fill={colors.blueAccent[500]} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default AdminAnalytics;
